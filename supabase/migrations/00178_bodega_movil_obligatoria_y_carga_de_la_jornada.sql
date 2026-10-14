-- ============================================================================
-- 00178: toda jornada lleva bodega movil, se carga desde Insumos y se ve lo que consumio
-- ============================================================================
--
-- Hasta aqui la pestana Insumos de una jornada era una lista de lo previsto (jornada_insumos,
-- 00151) que no tocaba el inventario, y la bodega de botiquin (botiquin_bodega_id, 00036) era
-- opcional. No habia forma de saber cuanto se gasto de esos insumos. La organizacion pidio:
--
-- - Toda jornada lleva una bodega movil, elegida al crearla.
-- - Lo que se lleva a la jornada se carga a esa bodega desde la pestana Insumos, sacandolo de otra
--   bodega (normalmente la principal).
-- - Una vista de lo que la jornada consumio: lo cargado, lo entregado en sus recetas y lo que
--   sigue en la bodega, con su valor.
--
-- 1. Dos triggers exigen la bodega movil, con el mismo criterio que la 00169 uso para el proyecto:
--    al crear la jornada, y al cambiarle la bodega. No es un SET NOT NULL porque las bases ya
--    desplegadas tienen jornadas sin bodega; esas siguen funcionando (sus recetas salen de la
--    bodega principal, 00176) y el formulario les pide la bodega la proxima vez que se editen.
--    Se llaman trg_jornadas_requiere_bodega_movil_* para dispararse despues de los del proyecto
--    (los BEFORE corren en orden alfabetico).
-- 2. movimientos_inventario.jornada_id: la jornada para la que se movio el inventario. Lo llena
--    solo la carga de esta migracion; es lo que permite decir "esto se cargo para esta jornada"
--    aunque la bodega movil se reuse en otra.
-- 3. fn_cargar_insumo_a_bodega_de_jornada(): un traslado de un lote desde otra bodega a la de la
--    jornada, en una transaccion (ingreso en la movil y salida del origen).
-- 4. fn_consumo_de_insumos_de_jornada(): por lote, lo cargado, lo entregado y lo que queda.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. La bodega movil es obligatoria
-- ----------------------------------------------------------------------------
-- SECURITY DEFINER: lee bodegas, que cualquier autenticado ya lee (00062), pero un trigger no
-- deberia depender de la RLS de quien escribe la jornada para decidir.
CREATE FUNCTION public.fn_jornada_exige_bodega_movil()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.botiquin_bodega_id IS NULL THEN
    RAISE EXCEPTION 'Toda jornada lleva una bodega movil de botiquin: elige una.'
      USING ERRCODE = 'not_null_violation';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.bodegas b WHERE b.id = NEW.botiquin_bodega_id AND b.es_movil
  ) THEN
    RAISE EXCEPTION 'La bodega de botiquin de una jornada tiene que ser una bodega movil.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_jornada_exige_bodega_movil() IS
  'Rechaza crear una jornada sin bodega de botiquin, quitarsela, o darle una que no es movil (00178).';

REVOKE EXECUTE ON FUNCTION public.fn_jornada_exige_bodega_movil() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_jornadas_requiere_bodega_movil_al_crear
BEFORE INSERT ON public.jornadas
FOR EACH ROW
EXECUTE FUNCTION public.fn_jornada_exige_bodega_movil();

CREATE TRIGGER trg_jornadas_requiere_bodega_movil_al_cambiar
BEFORE UPDATE OF botiquin_bodega_id ON public.jornadas
FOR EACH ROW
WHEN (OLD.botiquin_bodega_id IS DISTINCT FROM NEW.botiquin_bodega_id)
EXECUTE FUNCTION public.fn_jornada_exige_bodega_movil();

-- Borrar la bodega dejaria a sus jornadas sin ella, justo lo que esto impide. Hoy ningun rol
-- borra bodegas (no hay politica DELETE sobre `bodegas`), asi que no cambia nada para nadie.
ALTER TABLE public.jornadas DROP CONSTRAINT jornadas_botiquin_bodega_id_fkey;
ALTER TABLE public.jornadas
  ADD CONSTRAINT jornadas_botiquin_bodega_id_fkey
  FOREIGN KEY (botiquin_bodega_id) REFERENCES public.bodegas (id) ON DELETE RESTRICT;

COMMENT ON COLUMN public.jornadas.botiquin_bodega_id IS
  'Bodega movil que viaja a la jornada: se carga desde la pestana Insumos y de ella salen las entregas. Obligatoria al crear la jornada y no se puede quitar (00178); solo las jornadas anteriores a la 00178 pueden no tenerla.';

-- ----------------------------------------------------------------------------
-- 2. Para que jornada se movio el inventario
-- ----------------------------------------------------------------------------
ALTER TABLE public.movimientos_inventario
  ADD COLUMN jornada_id UUID REFERENCES public.jornadas (id) ON DELETE RESTRICT;

CREATE INDEX idx_movimientos_inventario_jornada_id
  ON public.movimientos_inventario (jornada_id)
  WHERE jornada_id IS NOT NULL;

COMMENT ON COLUMN public.movimientos_inventario.jornada_id IS
  'Jornada para la que se movio el inventario: la carga de su bodega movil (fn_cargar_insumo_a_bodega_de_jornada, 00178). NULL en cualquier otro movimiento.';

-- ----------------------------------------------------------------------------
-- 3. Cargar la bodega de la jornada
-- ----------------------------------------------------------------------------
-- Solo la administradora, como la reubicacion de fn_atender_alerta_caducidad (00143): sus
-- movimientos nacen aprobados (tr_autoaprobar_movimiento_inventario) y el traslado queda completo
-- en el acto. Con otro rol nacerian pendientes por separado, y aprobar la salida sin el ingreso
-- haria desaparecer el inventario.
--
-- SECURITY INVOKER: la administradora ya pasa la RLS de jornadas, lotes, existencias y
-- movimientos_inventario; la funcion no necesita mas privilegios que los suyos.
--
-- Primero el ingreso en la movil y despues la salida del origen, como en la 00143: al reves, el
-- total del articulo pasaria por cero entre las dos sentencias y
-- trg_existencias_notificar_sin_stock avisaria de un "sin stock" que nunca ocurrio.
CREATE FUNCTION public.fn_cargar_insumo_a_bodega_de_jornada(
  p_jornada_id UUID,
  p_lote_id UUID,
  p_bodega_origen_id UUID,
  p_cantidad INT
)
RETURNS UUID
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_jornada RECORD;
  v_vence DATE;
  v_disponible INT;
  v_motivo TEXT;
  v_ingreso_id UUID;
BEGIN
  IF NOT public.es_administrador() THEN
    RAISE EXCEPTION 'Solo la administradora carga la bodega de una jornada.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
    RAISE EXCEPTION 'La cantidad a cargar tiene que ser mayor que cero.'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT j.nombre, j.estado, j.botiquin_bodega_id, b.nombre AS bodega_nombre,
         p.estado AS estado_proyecto
  INTO v_jornada
  FROM public.jornadas j
  LEFT JOIN public.bodegas b ON b.id = j.botiquin_bodega_id
  LEFT JOIN public.proyectos p ON p.id = j.proyecto_id
  WHERE j.id = p_jornada_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La jornada indicada no existe.' USING ERRCODE = 'no_data_found';
  END IF;

  IF v_jornada.estado = 'finalizada' THEN
    RAISE EXCEPTION 'La jornada ya finalizo: su bodega ya no se carga.'
      USING ERRCODE = 'object_not_in_prerequisite_state';
  END IF;

  IF v_jornada.estado_proyecto IN ('cancelado', 'finalizado') THEN
    RAISE EXCEPTION 'El proyecto esta %: ya no se puede modificar.', v_jornada.estado_proyecto
      USING ERRCODE = 'object_not_in_prerequisite_state';
  END IF;

  IF v_jornada.botiquin_bodega_id IS NULL THEN
    RAISE EXCEPTION 'La jornada no tiene bodega movil: asignale una antes de cargarla.'
      USING ERRCODE = 'object_not_in_prerequisite_state';
  END IF;

  IF p_bodega_origen_id IS NULL OR p_bodega_origen_id = v_jornada.botiquin_bodega_id THEN
    RAISE EXCEPTION 'Elige de que otra bodega sale lo que se carga.'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT l.fecha_vencimiento INTO v_vence FROM public.lotes l WHERE l.id = p_lote_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El lote indicado no existe.' USING ERRCODE = 'no_data_found';
  END IF;

  IF v_vence IS NOT NULL AND v_vence < CURRENT_DATE THEN
    RAISE EXCEPTION 'El lote vencio el %: no se lleva a una jornada.', v_vence
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT e.cantidad_disponible INTO v_disponible
  FROM public.existencias e
  WHERE e.lote_id = p_lote_id AND e.bodega_id = p_bodega_origen_id
  FOR UPDATE;

  IF COALESCE(v_disponible, 0) < p_cantidad THEN
    RAISE EXCEPTION 'Existencia insuficiente en la bodega de origen. Disponible: %, solicitado: %.',
      COALESCE(v_disponible, 0), p_cantidad
      USING ERRCODE = 'check_violation';
  END IF;

  v_motivo := 'Carga de la bodega ' || COALESCE(v_jornada.bodega_nombre, '')
    || ' para la jornada ' || v_jornada.nombre;

  INSERT INTO public.movimientos_inventario (
    tipo, lote_id, bodega_id, cantidad, motivo, registrado_por, jornada_id
  )
  VALUES (
    'ingreso', p_lote_id, v_jornada.botiquin_bodega_id, p_cantidad, v_motivo, auth.uid(),
    p_jornada_id
  )
  RETURNING id INTO v_ingreso_id;

  INSERT INTO public.movimientos_inventario (
    tipo, lote_id, bodega_id, cantidad, motivo, registrado_por, jornada_id
  )
  VALUES (
    'salida', p_lote_id, p_bodega_origen_id, p_cantidad, v_motivo, auth.uid(), p_jornada_id
  );

  RETURN v_ingreso_id;
END;
$$;

COMMENT ON FUNCTION public.fn_cargar_insumo_a_bodega_de_jornada(UUID, UUID, UUID, INT) IS
  'Traslada p_cantidad de un lote desde p_bodega_origen_id a la bodega movil de la jornada: un ingreso y una salida aprobados, con jornada_id (00178). Solo la administradora. Devuelve el id del ingreso.';

REVOKE EXECUTE ON FUNCTION public.fn_cargar_insumo_a_bodega_de_jornada(UUID, UUID, UUID, INT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_cargar_insumo_a_bodega_de_jornada(UUID, UUID, UUID, INT)
  TO authenticated;

-- ----------------------------------------------------------------------------
-- 4. Lo que consumio la jornada
-- ----------------------------------------------------------------------------
-- Por lote:
--   cargado    los ingresos aprobados a su bodega movil hechos para ella (jornada_id).
--   entregado  lo entregado en las recetas emitidas de sus consultas, con la cantidad corregida si
--              alguien la ajusto (cantidad_ajustada, 00128). Una receta anulada no cuenta.
--   en_bodega  lo que hay hoy en su bodega movil.
-- costo_unitario es el del lote (00121); NULL si no se conoce, y el cliente no lo cuenta como cero.
--
-- SECURITY DEFINER: quien ve los insumos de una jornada no necesariamente lee sus recetas (son
-- datos clinicos). La funcion solo devuelve cantidades por lote, nada del paciente, y comprueba
-- ella misma la misma condicion que la politica de SELECT de jornada_insumos (00151).
CREATE FUNCTION public.fn_consumo_de_insumos_de_jornada(p_jornada_id UUID)
RETURNS TABLE (
  lote_id UUID,
  medicamento_id UUID,
  articulo TEXT,
  concentracion TEXT,
  numero_lote TEXT,
  fecha_vencimiento DATE,
  costo_unitario NUMERIC,
  cargado BIGINT,
  entregado BIGINT,
  en_bodega BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_bodega_id UUID;
BEGIN
  IF NOT (
    public.es_administrador()
    OR public.tiene_permiso('jornadas.gestionar')
    OR public.tiene_permiso('proyectos.gestionar')
    OR public.accede_a_modulo_por_matriz('jornadas')
    OR public.accede_a_modulo_por_matriz('proyectos')
  ) THEN
    RAISE EXCEPTION 'No tienes permiso para ver los insumos de esta jornada.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT j.botiquin_bodega_id INTO v_bodega_id FROM public.jornadas j WHERE j.id = p_jornada_id;

  RETURN QUERY
  WITH cargas AS (
    SELECT m.lote_id, SUM(m.cantidad)::BIGINT AS cantidad
    FROM public.movimientos_inventario m
    WHERE m.jornada_id = p_jornada_id
      AND m.tipo = 'ingreso'
      AND m.estado = 'aprobado'
    GROUP BY m.lote_id
  ),
  entregas AS (
    SELECT rd.lote_id, SUM(COALESCE(rd.cantidad_ajustada, rd.cantidad_entregada))::BIGINT AS cantidad
    FROM public.receta_detalle rd
    JOIN public.recetas r ON r.id = rd.receta_id
    JOIN public.consultas c ON c.id = r.consulta_id
    JOIN public.atenciones a ON a.id = c.atencion_id
    WHERE a.jornada_id = p_jornada_id
      AND r.estado = 'emitida'
      AND rd.lote_id IS NOT NULL
    GROUP BY rd.lote_id
  ),
  en_bodega AS (
    SELECT e.lote_id, SUM(e.cantidad_disponible)::BIGINT AS cantidad
    FROM public.existencias e
    WHERE v_bodega_id IS NOT NULL
      AND e.bodega_id = v_bodega_id
      AND e.cantidad_disponible > 0
    GROUP BY e.lote_id
  ),
  lotes_de_la_jornada AS (
    SELECT cargas.lote_id FROM cargas
    UNION
    SELECT entregas.lote_id FROM entregas
    UNION
    SELECT en_bodega.lote_id FROM en_bodega
  )
  SELECT
    l.id,
    m.id,
    m.nombre::TEXT,
    m.concentracion::TEXT,
    l.numero_lote::TEXT,
    l.fecha_vencimiento,
    l.costo_unitario,
    COALESCE(ca.cantidad, 0),
    COALESCE(en.cantidad, 0),
    COALESCE(eb.cantidad, 0)
  FROM lotes_de_la_jornada lj
  JOIN public.lotes l ON l.id = lj.lote_id
  JOIN public.medicamentos m ON m.id = l.medicamento_id
  LEFT JOIN cargas ca ON ca.lote_id = l.id
  LEFT JOIN entregas en ON en.lote_id = l.id
  LEFT JOIN en_bodega eb ON eb.lote_id = l.id
  ORDER BY m.nombre, l.fecha_vencimiento NULLS LAST, l.numero_lote;
END;
$$;

COMMENT ON FUNCTION public.fn_consumo_de_insumos_de_jornada(UUID) IS
  'Por lote: lo cargado a la bodega movil de la jornada, lo entregado en sus recetas emitidas y lo que queda en la bodega, con el costo unitario del lote (00178). Lo ve quien ve los insumos de la jornada.';

REVOKE EXECUTE ON FUNCTION public.fn_consumo_de_insumos_de_jornada(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_consumo_de_insumos_de_jornada(UUID) TO authenticated;
