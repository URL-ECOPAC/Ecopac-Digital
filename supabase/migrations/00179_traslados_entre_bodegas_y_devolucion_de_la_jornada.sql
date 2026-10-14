-- ============================================================================
-- 00179: traslados de verdad entre bodegas, devolucion de la bodega movil y una bodega por jornada
-- ============================================================================
--
-- Tres huecos de la revision del flujo de inventario y jornadas (misma issue que la 00178):
--
-- 1. "Traslado entre bodegas" en Registrar salida solo registraba la salida del origen: el
--    inventario desaparecia del sistema porque no entraba a ninguna otra bodega.
--    fn_trasladar_entre_bodegas() hace el traslado completo -ingreso en la destino y salida del
--    origen, en una transaccion- y la carga de la bodega de una jornada (00178) pasa a usarla.
-- 2. Lo que sobraba en la bodega movil al terminar la jornada no tenia como volver.
--    fn_devolver_de_bodega_de_jornada() lo traslada a una bodega fija, marcado con la jornada, y
--    fn_consumo_de_insumos_de_jornada() lo cuenta como devuelto.
-- 3. Una bodega movil podia estar en dos jornadas en curso a la vez: el botiquin es uno solo y no
--    esta en dos comunidades el mismo dia, y lo que se entrega en una se mezclaba con la otra. Un
--    trigger lo impide al iniciar la jornada o al cambiarle la bodega. Varias jornadas planificadas
--    si pueden compartir bodega: el botiquin se reusa una despues de otra.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Traslado entre bodegas
-- ----------------------------------------------------------------------------
-- Solo la administradora, por el mismo motivo que la 00178: sus movimientos nacen aprobados
-- (tr_autoaprobar_movimiento_inventario, 00028) y el traslado queda completo en el acto. Con otro
-- rol nacerian pendientes por separado, y aprobar uno sin el otro descuadraria el inventario.
--
-- SECURITY INVOKER: la administradora ya pasa la RLS de lotes, existencias y movimientos.
--
-- Primero el ingreso en la destino y despues la salida del origen (00143): al reves, el total del
-- articulo pasaria por cero y trg_existencias_notificar_sin_stock avisaria de un "sin stock" falso.
CREATE FUNCTION public.fn_trasladar_entre_bodegas(
  p_lote_id UUID,
  p_bodega_origen_id UUID,
  p_bodega_destino_id UUID,
  p_cantidad INT,
  p_motivo TEXT DEFAULT NULL,
  p_jornada_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_vence DATE;
  v_disponible INT;
  v_motivo TEXT;
  v_ingreso_id UUID;
BEGIN
  IF NOT public.es_administrador() THEN
    RAISE EXCEPTION 'Solo la administradora traslada inventario entre bodegas.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
    RAISE EXCEPTION 'La cantidad a trasladar tiene que ser mayor que cero.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_bodega_origen_id IS NULL OR p_bodega_destino_id IS NULL
     OR p_bodega_origen_id = p_bodega_destino_id THEN
    RAISE EXCEPTION 'Un traslado sale de una bodega y entra a otra distinta.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.bodegas b WHERE b.id = p_bodega_destino_id) THEN
    RAISE EXCEPTION 'La bodega destino no existe.' USING ERRCODE = 'no_data_found';
  END IF;

  SELECT l.fecha_vencimiento INTO v_vence FROM public.lotes l WHERE l.id = p_lote_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El lote indicado no existe.' USING ERRCODE = 'no_data_found';
  END IF;

  IF v_vence IS NOT NULL AND v_vence < CURRENT_DATE THEN
    RAISE EXCEPTION 'El lote vencio el %: se da de baja desde su alerta, no se traslada.', v_vence
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

  v_motivo := COALESCE(
    NULLIF(btrim(p_motivo), ''),
    'Traslado de ' || (SELECT b.nombre FROM public.bodegas b WHERE b.id = p_bodega_origen_id)
      || ' a ' || (SELECT b.nombre FROM public.bodegas b WHERE b.id = p_bodega_destino_id)
  );

  INSERT INTO public.movimientos_inventario (
    tipo, lote_id, bodega_id, cantidad, motivo, registrado_por, jornada_id
  )
  VALUES ('ingreso', p_lote_id, p_bodega_destino_id, p_cantidad, v_motivo, auth.uid(), p_jornada_id)
  RETURNING id INTO v_ingreso_id;

  INSERT INTO public.movimientos_inventario (
    tipo, lote_id, bodega_id, cantidad, motivo, registrado_por, jornada_id
  )
  VALUES ('salida', p_lote_id, p_bodega_origen_id, p_cantidad, v_motivo, auth.uid(), p_jornada_id);

  RETURN v_ingreso_id;
END;
$$;

COMMENT ON FUNCTION public.fn_trasladar_entre_bodegas(UUID, UUID, UUID, INT, TEXT, UUID) IS
  'Traslada p_cantidad de un lote de una bodega a otra: un ingreso en la destino y una salida del origen, aprobados y en una transaccion (00179). Solo la administradora. p_jornada_id marca la carga o la devolucion de la bodega movil de una jornada. Devuelve el id del ingreso.';

REVOKE EXECUTE ON FUNCTION public.fn_trasladar_entre_bodegas(UUID, UUID, UUID, INT, TEXT, UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_trasladar_entre_bodegas(UUID, UUID, UUID, INT, TEXT, UUID)
  TO authenticated;

-- La carga de la 00178, ahora sobre el traslado. Mismas comprobaciones de la jornada; las del lote y
-- la existencia las hace fn_trasladar_entre_bodegas.
CREATE OR REPLACE FUNCTION public.fn_cargar_insumo_a_bodega_de_jornada(
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
BEGIN
  IF NOT public.es_administrador() THEN
    RAISE EXCEPTION 'Solo la administradora carga la bodega de una jornada.'
      USING ERRCODE = 'insufficient_privilege';
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

  RETURN public.fn_trasladar_entre_bodegas(
    p_lote_id,
    p_bodega_origen_id,
    v_jornada.botiquin_bodega_id,
    p_cantidad,
    'Carga de la bodega ' || COALESCE(v_jornada.bodega_nombre, '') || ' para la jornada '
      || v_jornada.nombre,
    p_jornada_id
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. Devolver lo que sobra en la bodega movil
-- ----------------------------------------------------------------------------
-- A una bodega fija: devolver a otro botiquin seria cargar otra jornada, y eso se hace desde ella.
-- Se puede con la jornada finalizada -es justo cuando sobra- y con su proyecto cerrado: devolver
-- inventario no modifica el proyecto.
CREATE FUNCTION public.fn_devolver_de_bodega_de_jornada(
  p_jornada_id UUID,
  p_lote_id UUID,
  p_bodega_destino_id UUID,
  p_cantidad INT
)
RETURNS UUID
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_jornada RECORD;
BEGIN
  IF NOT public.es_administrador() THEN
    RAISE EXCEPTION 'Solo la administradora devuelve lo que queda en la bodega de una jornada.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT j.nombre, j.botiquin_bodega_id, b.nombre AS bodega_nombre
  INTO v_jornada
  FROM public.jornadas j
  LEFT JOIN public.bodegas b ON b.id = j.botiquin_bodega_id
  WHERE j.id = p_jornada_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La jornada indicada no existe.' USING ERRCODE = 'no_data_found';
  END IF;

  IF v_jornada.botiquin_bodega_id IS NULL THEN
    RAISE EXCEPTION 'La jornada no tiene bodega movil: no hay nada que devolver.'
      USING ERRCODE = 'object_not_in_prerequisite_state';
  END IF;

  IF EXISTS (SELECT 1 FROM public.bodegas b WHERE b.id = p_bodega_destino_id AND b.es_movil) THEN
    RAISE EXCEPTION 'Lo que sobra se devuelve a una bodega fija.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN public.fn_trasladar_entre_bodegas(
    p_lote_id,
    v_jornada.botiquin_bodega_id,
    p_bodega_destino_id,
    p_cantidad,
    'Devolucion de la bodega ' || COALESCE(v_jornada.bodega_nombre, '') || ' de la jornada '
      || v_jornada.nombre,
    p_jornada_id
  );
END;
$$;

COMMENT ON FUNCTION public.fn_devolver_de_bodega_de_jornada(UUID, UUID, UUID, INT) IS
  'Devuelve p_cantidad de un lote de la bodega movil de la jornada a una bodega fija (fn_trasladar_entre_bodegas, marcado con la jornada) (00179). Solo la administradora; tambien con la jornada finalizada.';

REVOKE EXECUTE ON FUNCTION public.fn_devolver_de_bodega_de_jornada(UUID, UUID, UUID, INT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_devolver_de_bodega_de_jornada(UUID, UUID, UUID, INT)
  TO authenticated;

-- El consumo gana `devuelto`. Lo cargado y lo devuelto se leen en la bodega de la jornada: los dos
-- movimientos de un traslado llevan jornada_id, y el de la otra bodega no es ni carga ni
-- devolucion.
DROP FUNCTION public.fn_consumo_de_insumos_de_jornada(UUID);

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
  devuelto BIGINT,
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
  WITH traslados AS (
    SELECT
      m.lote_id,
      SUM(m.cantidad) FILTER (WHERE m.tipo = 'ingreso')::BIGINT AS cargado,
      SUM(m.cantidad) FILTER (WHERE m.tipo = 'salida')::BIGINT AS devuelto
    FROM public.movimientos_inventario m
    WHERE m.jornada_id = p_jornada_id
      AND m.bodega_id = v_bodega_id
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
    SELECT traslados.lote_id FROM traslados
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
    COALESCE(t.cargado, 0),
    COALESCE(en.cantidad, 0),
    COALESCE(t.devuelto, 0),
    COALESCE(eb.cantidad, 0)
  FROM lotes_de_la_jornada lj
  JOIN public.lotes l ON l.id = lj.lote_id
  JOIN public.medicamentos m ON m.id = l.medicamento_id
  LEFT JOIN traslados t ON t.lote_id = l.id
  LEFT JOIN entregas en ON en.lote_id = l.id
  LEFT JOIN en_bodega eb ON eb.lote_id = l.id
  ORDER BY m.nombre, l.fecha_vencimiento NULLS LAST, l.numero_lote;
END;
$$;

COMMENT ON FUNCTION public.fn_consumo_de_insumos_de_jornada(UUID) IS
  'Por lote: lo cargado a la bodega movil de la jornada, lo entregado en sus recetas emitidas, lo devuelto y lo que queda en la bodega, con el costo unitario del lote (00178, devuelto desde la 00179). Lo ve quien ve los insumos de la jornada.';

REVOKE EXECUTE ON FUNCTION public.fn_consumo_de_insumos_de_jornada(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_consumo_de_insumos_de_jornada(UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- 3. Una bodega movil no esta en dos jornadas en curso
-- ----------------------------------------------------------------------------
-- SECURITY DEFINER: tiene que ver las otras jornadas aunque quien inicia esta no las lea por RLS.
CREATE FUNCTION public.fn_jornada_bodega_movil_libre()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_otra TEXT;
BEGIN
  IF NEW.estado <> 'en curso' OR NEW.botiquin_bodega_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT j.nombre INTO v_otra
  FROM public.jornadas j
  WHERE j.botiquin_bodega_id = NEW.botiquin_bodega_id
    AND j.estado = 'en curso'
    AND j.id <> NEW.id
  LIMIT 1;

  IF v_otra IS NOT NULL THEN
    RAISE EXCEPTION 'La bodega movil ya esta en la jornada %, que sigue en curso.', v_otra
      USING ERRCODE = 'object_not_in_prerequisite_state';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_jornada_bodega_movil_libre() IS
  'Rechaza que una jornada quede en curso con una bodega movil que ya esta en otra jornada en curso (00179).';

REVOKE EXECUTE ON FUNCTION public.fn_jornada_bodega_movil_libre() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_jornadas_requiere_bodega_movil_libre
BEFORE INSERT OR UPDATE OF estado, botiquin_bodega_id ON public.jornadas
FOR EACH ROW
EXECUTE FUNCTION public.fn_jornada_bodega_movil_libre();
