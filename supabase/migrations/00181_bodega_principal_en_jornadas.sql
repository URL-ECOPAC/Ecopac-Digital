-- ============================================================================
-- 00181: la bodega principal tambien puede ser la bodega de una jornada (issue #927, seccion 5)
-- ============================================================================
--
-- Desde la 00178 toda jornada lleva una bodega movil: se carga desde otra bodega, de ella salen las
-- entregas y lo que sobra se devuelve (00179). La organizacion pidio poder atender una jornada
-- directamente desde la bodega principal (`bodegas.es_principal`, 00176), sin botiquin.
--
-- 1. fn_jornada_exige_bodega_movil(): la bodega sigue siendo obligatoria, pero puede ser una movil
--    o la principal. Cualquier otra bodega fija se sigue rechazando.
-- 2. fn_jornada_bodega_movil_libre(): varias jornadas en curso pueden usar la principal a la vez;
--    la regla de una jornada en curso por botiquin solo aplica a las moviles.
-- 3. Cambiar la bodega de una jornada que ya tiene inventario cargado en su bodega movil se
--    rechaza hasta que se devuelva: si no, lo cargado se quedaria en el botiquin sin jornada.
-- 4. fn_cargar_insumo_a_bodega_de_jornada(): con la principal no hay nada que cargar (seria
--    trasladarla a si misma), y un origen igual al destino se rechaza con un mensaje claro.
-- 5. fn_devolver_de_bodega_de_jornada(): con la principal no hay nada que devolver.
-- 6. fn_consumo_de_insumos_de_jornada(): con la principal, "lo que queda en la bodega" no puede
--    ser la existencia de la bodega entera. Solo se muestra lo entregado en las recetas de la
--    jornada, con su valor; cargado, devuelto y en bodega salen en cero.
--
-- Las migraciones 00178 y 00179 ya estan aplicadas y no se editan: aqui se reemplazan sus funciones
-- con CREATE OR REPLACE (mismas firmas y mismos tipos de retorno), asi que los triggers y los GRANT
-- se conservan.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. La bodega de la jornada: movil o la principal
-- ----------------------------------------------------------------------------
-- El nombre de la funcion se queda (lo citan los triggers de la 00178 y las pruebas); lo que
-- cambia es la regla.
CREATE OR REPLACE FUNCTION public.fn_jornada_exige_bodega_movil()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.botiquin_bodega_id IS NULL THEN
    RAISE EXCEPTION 'Toda jornada lleva una bodega: elige una bodega movil o la bodega principal.'
      USING ERRCODE = 'not_null_violation';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.bodegas b
    WHERE b.id = NEW.botiquin_bodega_id AND (b.es_movil OR b.es_principal)
  ) THEN
    RAISE EXCEPTION 'La bodega de una jornada tiene que ser una bodega movil o la bodega principal.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_jornada_exige_bodega_movil() IS
  'Rechaza crear una jornada sin bodega, quitarsela, o darle una que no es movil ni la principal (00178; la principal se acepta desde la 00181).';

-- ----------------------------------------------------------------------------
-- 2. La principal no se "ocupa"
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_jornada_bodega_movil_libre()
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

  -- La principal no viaja: puede atender a varias jornadas en curso a la vez.
  IF EXISTS (
    SELECT 1 FROM public.bodegas b WHERE b.id = NEW.botiquin_bodega_id AND b.es_principal
  ) THEN
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
  'Rechaza que una jornada quede en curso con una bodega movil que ya esta en otra jornada en curso (00179). La bodega principal no tiene esa restriccion (00181).';

-- ----------------------------------------------------------------------------
-- 3. No se cambia de bodega con inventario cargado
-- ----------------------------------------------------------------------------
-- "Cargado" es lo que esta jornada traslado a su bodega movil y que sigue ahi: hubo al menos una
-- carga marcada con la jornada y la bodega todavia tiene existencias de esos lotes. Lo que la
-- bodega traiga de otra jornada no cuenta: no es de esta.
CREATE FUNCTION public.fn_jornada_sin_inventario_cargado_al_cambiar_bodega()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_bodega TEXT;
BEGIN
  IF OLD.botiquin_bodega_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT b.nombre INTO v_bodega
  FROM public.bodegas b
  WHERE b.id = OLD.botiquin_bodega_id
    AND EXISTS (
      SELECT 1
      FROM public.movimientos_inventario m
      JOIN public.existencias e
        ON e.lote_id = m.lote_id AND e.bodega_id = m.bodega_id AND e.cantidad_disponible > 0
      WHERE m.jornada_id = OLD.id
        AND m.bodega_id = OLD.botiquin_bodega_id
        AND m.tipo = 'ingreso'
        AND m.estado = 'aprobado'
    );

  IF v_bodega IS NOT NULL THEN
    RAISE EXCEPTION 'La bodega % todavia tiene inventario cargado para esta jornada: devuelvelo antes de cambiar de bodega.', v_bodega
      USING ERRCODE = 'object_not_in_prerequisite_state';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_jornada_sin_inventario_cargado_al_cambiar_bodega() IS
  'Rechaza cambiar la bodega de una jornada mientras su bodega movil conserve inventario que se cargo para ella; primero se devuelve (00181).';

REVOKE EXECUTE ON FUNCTION public.fn_jornada_sin_inventario_cargado_al_cambiar_bodega()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_jornadas_sin_inventario_cargado_al_cambiar_bodega
BEFORE UPDATE OF botiquin_bodega_id ON public.jornadas
FOR EACH ROW
WHEN (OLD.botiquin_bodega_id IS DISTINCT FROM NEW.botiquin_bodega_id)
EXECUTE FUNCTION public.fn_jornada_sin_inventario_cargado_al_cambiar_bodega();

-- ----------------------------------------------------------------------------
-- 4. Cargar la bodega de la jornada
-- ----------------------------------------------------------------------------
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
         COALESCE(b.es_principal, FALSE) AS es_principal, p.estado AS estado_proyecto
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

  IF v_jornada.es_principal THEN
    RAISE EXCEPTION 'La jornada usa la bodega principal: entrega directo de ella y no hay nada que cargar.'
      USING ERRCODE = 'object_not_in_prerequisite_state';
  END IF;

  IF p_bodega_origen_id = v_jornada.botiquin_bodega_id THEN
    RAISE EXCEPTION 'La bodega de origen es la misma de la jornada: elige otra bodega para cargarla.'
      USING ERRCODE = 'check_violation';
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
-- 5. Devolver lo que sobra
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_devolver_de_bodega_de_jornada(
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

  SELECT j.nombre, j.botiquin_bodega_id, b.nombre AS bodega_nombre,
         COALESCE(b.es_principal, FALSE) AS es_principal
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

  IF v_jornada.es_principal THEN
    RAISE EXCEPTION 'La jornada usa la bodega principal: no hay nada que devolver.'
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

-- ----------------------------------------------------------------------------
-- 6. Consumo de la jornada
-- ----------------------------------------------------------------------------
-- Con la principal no hay carga ni devolucion (4 y 5), y su existencia es la de toda la
-- organizacion: lo unico que es de la jornada es lo entregado en sus recetas.
CREATE OR REPLACE FUNCTION public.fn_consumo_de_insumos_de_jornada(p_jornada_id UUID)
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

  -- La bodega solo cuenta para cargado, devuelto y en bodega cuando no es la principal.
  SELECT j.botiquin_bodega_id INTO v_bodega_id
  FROM public.jornadas j
  LEFT JOIN public.bodegas b ON b.id = j.botiquin_bodega_id
  WHERE j.id = p_jornada_id
    AND NOT COALESCE(b.es_principal, FALSE);

  RETURN QUERY
  WITH traslados AS (
    SELECT
      m.lote_id,
      SUM(m.cantidad) FILTER (WHERE m.tipo = 'ingreso')::BIGINT AS cargado,
      SUM(m.cantidad) FILTER (WHERE m.tipo = 'salida')::BIGINT AS devuelto
    FROM public.movimientos_inventario m
    WHERE v_bodega_id IS NOT NULL
      AND m.jornada_id = p_jornada_id
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
  'Por lote: lo cargado a la bodega movil de la jornada, lo entregado en sus recetas emitidas, lo devuelto y lo que queda en la bodega, con el costo unitario del lote (00178, devuelto desde la 00179). Con la bodega principal solo cuenta lo entregado (00181). Lo ve quien ve los insumos de la jornada.';

COMMENT ON COLUMN public.jornadas.botiquin_bodega_id IS
  'Bodega de la que salen las entregas de la jornada: una bodega movil, que viaja a la jornada y se carga desde la pestana Insumos, o la bodega principal, que entrega directo y no se carga ni se devuelve (00181). Obligatoria al crear la jornada y no se puede quitar (00178); solo las jornadas anteriores a la 00178 pueden no tenerla.';
