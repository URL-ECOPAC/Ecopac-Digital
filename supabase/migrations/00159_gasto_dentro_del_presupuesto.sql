-- ============================================================================
-- 00159: un gasto no pasa el presupuesto de su jornada, y un aporte no se quita si ya se gasto
-- ============================================================================
--
-- Hasta aqui el formulario de gasto avisaba "este gasto deja la jornada por encima de su
-- presupuesto asignado... El registro se permite igual", y la base no miraba el presupuesto. La
-- administracion pidio que no se permita, contando tambien lo que espera aprobacion: dos gastos
-- pendientes no pueden comprometer juntos mas de lo que la jornada tiene.
--
-- Cuatro reglas, todas en la base (el formulario las adelanta, pero quien protege es esto):
--
--   1. Un gasto pendiente o aprobado no deja lo comprometido de su jornada (gastos pendientes mas
--      aprobados) por encima de su presupuesto asignado. Se revisa cuando el gasto compromete mas
--      dinero -al entrar, al subir su monto, al cambiar de jornada-; aprobar uno que ya estaba
--      pendiente no compromete nada nuevo y no se vuelve a revisar.
--   2. La fecha de un gasto llega hasta el dia de su jornada aunque sea futuro -un gasto de
--      preparacion se registra antes- y, pasada la jornada, hasta hoy. Ya no hay limite hacia
--      atras: la preparacion empieza antes de la jornada.
--   3. Un aporte no se quita ni se rebaja si la jornada queda con menos presupuesto que lo que ya
--      tiene comprometido.
--   4. Una jornada finalizada no admite gastos nuevos: ya cerro. Sus gastos pendientes se siguen
--      aprobando o rechazando.
--
-- Las funciones son SECURITY DEFINER: quien registra un gasto en su jornada no ve por RLS los
-- gastos de los demas, y la suma tiene que verlos todos.
-- ============================================================================

-- Lo comprometido de una jornada: gastos pendientes y aprobados.
CREATE FUNCTION public.comprometido_de_jornada(p_jornada_id UUID, p_sin_gasto UUID DEFAULT NULL)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(SUM(g.monto), 0)
  FROM public.gastos g
  WHERE g.jornada_id = p_jornada_id
    AND g.estado IN ('pendiente', 'aprobado')
    AND g.id IS DISTINCT FROM p_sin_gasto;
$$;

COMMENT ON FUNCTION public.comprometido_de_jornada(UUID, UUID) IS
  'Suma de los gastos pendientes y aprobados de una jornada, sin contar p_sin_gasto (el que se esta revisando). SECURITY DEFINER para ver todos los gastos (00159).';

REVOKE EXECUTE ON FUNCTION public.comprometido_de_jornada(UUID, UUID) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.fn_validar_gasto_contra_presupuesto()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_asignado NUMERIC;
  v_fecha_jornada DATE;
  v_estado public.estado_jornada;
  v_comprometido NUMERIC;
  v_hoy DATE := (now() AT TIME ZONE 'America/Guatemala')::DATE;
  v_compromete_mas BOOLEAN;
BEGIN
  SELECT j.presupuesto_asignado, j.fecha, j.estado INTO v_asignado, v_fecha_jornada, v_estado
  FROM public.jornadas j
  WHERE j.id = NEW.jornada_id;

  -- Sin jornada, la llave foranea es la que responde.
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Una jornada que ya cerro no admite gastos nuevos. Aprobar o rechazar los pendientes si: es lo
  -- que hace falta para liquidar su sobrante (00160).
  IF v_estado = 'finalizada'
     AND (TG_OP = 'INSERT'
          OR NEW.jornada_id IS DISTINCT FROM OLD.jornada_id
          OR NEW.monto > OLD.monto)
  THEN
    RAISE EXCEPTION 'La jornada ya cerro: no admite gastos nuevos.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF (TG_OP = 'INSERT' OR NEW.fecha IS DISTINCT FROM OLD.fecha)
     AND NEW.fecha > GREATEST(v_hoy, v_fecha_jornada)
  THEN
    RAISE EXCEPTION 'La fecha de un gasto llega hasta el dia de su jornada (%) o hasta hoy si ya paso.',
      to_char(v_fecha_jornada, 'DD/MM/YYYY')
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.estado NOT IN ('pendiente', 'aprobado') THEN
    RETURN NEW;
  END IF;

  v_compromete_mas :=
    TG_OP = 'INSERT'
    OR NEW.monto > OLD.monto
    OR NEW.jornada_id IS DISTINCT FROM OLD.jornada_id
    OR OLD.estado NOT IN ('pendiente', 'aprobado');

  IF NOT v_compromete_mas THEN
    RETURN NEW;
  END IF;

  v_comprometido := public.comprometido_de_jornada(NEW.jornada_id, NEW.id);

  IF v_comprometido + NEW.monto > v_asignado THEN
    RAISE EXCEPTION 'Este gasto pasa el presupuesto de la jornada: tiene Q% y ya hay Q% comprometidos, quedan Q%.',
      to_char(v_asignado, 'FM999999990.00'),
      to_char(v_comprometido, 'FM999999990.00'),
      to_char(GREATEST(v_asignado - v_comprometido, 0), 'FM999999990.00')
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_validar_gasto_contra_presupuesto() IS
  'Trigger de gastos (00159): una jornada finalizada no admite gastos nuevos, la fecha llega hasta el dia de la jornada o hasta hoy, y un gasto que compromete mas dinero no deja lo comprometido (pendiente + aprobado) por encima del presupuesto asignado.';

REVOKE EXECUTE ON FUNCTION public.fn_validar_gasto_contra_presupuesto() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_gastos_validar_contra_presupuesto
BEFORE INSERT OR UPDATE ON public.gastos
FOR EACH ROW
EXECUTE FUNCTION public.fn_validar_gasto_contra_presupuesto();

COMMENT ON TRIGGER trg_gastos_validar_contra_presupuesto ON public.gastos IS
  'Sin gastos nuevos en una jornada finalizada, fecha del gasto hasta el dia de su jornada (o hoy) y lo comprometido dentro del presupuesto asignado (00159).';

-- 3. Un aporte no se quita ni se rebaja por debajo de lo comprometido.
CREATE FUNCTION public.fn_proteger_presupuesto_comprometido()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_asignado NUMERIC;
  v_quedaria NUMERIC;
  v_comprometido NUMERIC;
BEGIN
  -- Solo importa si la jornada de OLD pierde dinero.
  IF TG_OP = 'UPDATE' AND NEW.jornada_id = OLD.jornada_id AND NEW.monto >= OLD.monto THEN
    RETURN NEW;
  END IF;

  SELECT j.presupuesto_asignado INTO v_asignado
  FROM public.jornadas j
  WHERE j.id = OLD.jornada_id;

  -- La jornada se esta borrando (ON DELETE CASCADE): no hay presupuesto que proteger.
  IF NOT FOUND THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_quedaria := v_asignado - OLD.monto
    + CASE WHEN TG_OP = 'UPDATE' AND NEW.jornada_id = OLD.jornada_id THEN NEW.monto ELSE 0 END;
  v_comprometido := public.comprometido_de_jornada(OLD.jornada_id);

  IF v_quedaria < v_comprometido THEN
    RAISE EXCEPTION 'La jornada ya tiene Q% comprometidos en gastos: sin este aporte le quedarian Q%.',
      to_char(v_comprometido, 'FM999999990.00'),
      to_char(v_quedaria, 'FM999999990.00')
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION public.fn_proteger_presupuesto_comprometido() IS
  'Trigger de jornada_presupuesto_origen (00159): quitar o rebajar un aporte no puede dejar la jornada con menos presupuesto que lo comprometido en gastos.';

REVOKE EXECUTE ON FUNCTION public.fn_proteger_presupuesto_comprometido() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_presupuesto_origen_proteger_comprometido
BEFORE DELETE OR UPDATE ON public.jornada_presupuesto_origen
FOR EACH ROW
EXECUTE FUNCTION public.fn_proteger_presupuesto_comprometido();

COMMENT ON TRIGGER trg_presupuesto_origen_proteger_comprometido ON public.jornada_presupuesto_origen IS
  'Impide quitar o rebajar un aporte por debajo de lo que la jornada ya comprometio en gastos (00159).';
