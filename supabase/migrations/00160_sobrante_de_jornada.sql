-- ============================================================================
-- 00160: el sobrante del presupuesto de una jornada finalizada se devuelve o se traspasa
-- ============================================================================
--
-- Hasta aqui lo que una jornada no gastaba se quedaba en ella para siempre: seguia sumando en el
-- "Disponible" del sistema y una donacion con dinero sin usar no lo recuperaba. La administracion
-- decidio que, al cerrar, por cada aporte se elige que hacer con lo que sobro:
--
--   - devolverlo a su origen: si vino de una donacion, vuelve a quedar libre en ella para otra
--     jornada; si fue de fondos propios o de un aporte externo, sale de la jornada;
--   - traspasarlo a otra jornada del mismo proyecto que todavia no termino, como un aporte nuevo
--     del mismo origen (la misma donacion, la misma fuente).
--
-- Como se guarda. El aporte conserva su monto -es lo que se asigno- y lleva aparte `devuelto`: lo
-- que salio de la jornada al liquidarla. Lo que cuenta es monto - devuelto: el presupuesto de la
-- jornada, el saldo de una donacion y la proteccion de lo comprometido (00159) se recalculan con
-- eso. Un traspaso es un aporte nuevo en la otra jornada con `traspasado_desde` apuntando al que lo
-- cedio, asi que el rastro queda en las dos.
--
-- Que parte de cada aporte se uso. Lo comprometido (gastos pendientes y aprobados) se descuenta
-- primero de las donaciones y los aportes externos, que suelen venir con un destino, y al final de
-- los fondos propios; dentro de cada origen, del aporte mas antiguo al mas reciente. Asi lo que
-- sobra vuelve primero a la organizacion.
--
-- `devuelto` solo lo escribe fn_liquidar_sobrante_de_jornada(): la jornada tiene que estar
-- finalizada y sin gastos pendientes, para que el sobrante sea definitivo.
-- ============================================================================

ALTER TABLE public.jornada_presupuesto_origen
  ADD COLUMN devuelto NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN traspasado_desde UUID REFERENCES public.jornada_presupuesto_origen(id) ON DELETE RESTRICT,
  ADD CONSTRAINT chk_presupuesto_origen_devuelto CHECK (devuelto >= 0 AND devuelto <= monto);

COMMENT ON COLUMN public.jornada_presupuesto_origen.devuelto IS
  'Lo que salio de la jornada al liquidar su sobrante: devuelto a su origen o traspasado a otra jornada (00160). Lo que cuenta del aporte es monto - devuelto.';
COMMENT ON COLUMN public.jornada_presupuesto_origen.traspasado_desde IS
  'Si este aporte es el sobrante de otra jornada, el aporte del que salio (00160).';

CREATE INDEX idx_presupuesto_origen_traspasado_desde
  ON public.jornada_presupuesto_origen (traspasado_desde);

-- `devuelto` no se escribe a mano: solo desde la liquidacion.
CREATE FUNCTION public.fn_impedir_devuelto_a_mano()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_setting('ecopac.liquidando_sobrante', true) IS DISTINCT FROM 'on' THEN
    IF (TG_OP = 'INSERT' AND (NEW.devuelto <> 0 OR NEW.traspasado_desde IS NOT NULL))
       OR (TG_OP = 'UPDATE' AND (NEW.devuelto IS DISTINCT FROM OLD.devuelto
                                 OR NEW.traspasado_desde IS DISTINCT FROM OLD.traspasado_desde))
    THEN
      RAISE EXCEPTION 'Lo devuelto de un aporte se registra al liquidar el sobrante de la jornada.'
        USING ERRCODE = 'check_violation';
    END IF;
    -- Un aporte ya liquidado es historia: no se corrige ni se quita.
    IF TG_OP = 'UPDATE' AND OLD.devuelto > 0 THEN
      RAISE EXCEPTION 'Un aporte cuyo sobrante ya se liquido no se modifica.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_impedir_devuelto_a_mano() IS
  'Trigger de jornada_presupuesto_origen (00160): devuelto y traspasado_desde solo los escribe fn_liquidar_sobrante_de_jornada().';

CREATE TRIGGER trg_presupuesto_origen_impedir_devuelto_a_mano
BEFORE INSERT OR UPDATE ON public.jornada_presupuesto_origen
FOR EACH ROW
EXECUTE FUNCTION public.fn_impedir_devuelto_a_mano();

COMMENT ON TRIGGER trg_presupuesto_origen_impedir_devuelto_a_mano ON public.jornada_presupuesto_origen IS
  'Solo la liquidacion del sobrante escribe devuelto y traspasado_desde (00160).';

CREATE FUNCTION public.fn_impedir_quitar_aporte_liquidado()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.devuelto > 0 THEN
    RAISE EXCEPTION 'Un aporte cuyo sobrante ya se liquido no se quita.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN OLD;
END;
$$;

COMMENT ON FUNCTION public.fn_impedir_quitar_aporte_liquidado() IS
  'Trigger de jornada_presupuesto_origen (00160): un aporte con sobrante liquidado no se borra.';

CREATE TRIGGER trg_presupuesto_origen_impedir_quitar_liquidado
BEFORE DELETE ON public.jornada_presupuesto_origen
FOR EACH ROW
EXECUTE FUNCTION public.fn_impedir_quitar_aporte_liquidado();

COMMENT ON TRIGGER trg_presupuesto_origen_impedir_quitar_liquidado ON public.jornada_presupuesto_origen IS
  'Un aporte con sobrante liquidado es historia del presupuesto: no se borra (00160).';

-- El presupuesto de la jornada es la suma de lo que cuenta de cada aporte.
CREATE OR REPLACE FUNCTION public.fn_sincronizar_presupuesto_de_jornada()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_jornada_id UUID;
BEGIN
  -- Un UPDATE que mueve el origen de una jornada a otra tiene que recalcular las dos.
  FOR v_jornada_id IN
    SELECT DISTINCT unnest(ARRAY[
      CASE WHEN TG_OP <> 'INSERT' THEN OLD.jornada_id END,
      CASE WHEN TG_OP <> 'DELETE' THEN NEW.jornada_id END
    ])
  LOOP
    CONTINUE WHEN v_jornada_id IS NULL;

    PERFORM set_config('ecopac.sincronizando_presupuesto', 'on', true);
    UPDATE public.jornadas j
    SET presupuesto_asignado = (
      SELECT COALESCE(SUM(o.monto - o.devuelto), 0)
      FROM public.jornada_presupuesto_origen o
      WHERE o.jornada_id = v_jornada_id
    )
    WHERE j.id = v_jornada_id;
    PERFORM set_config('ecopac.sincronizando_presupuesto', 'off', true);
  END LOOP;

  RETURN NULL;
END;
$$;

-- Lo asignado desde una donacion es lo que sigue contando en las jornadas (monto - devuelto).
CREATE OR REPLACE FUNCTION public.fn_validar_origen_de_presupuesto()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tipo public.tipo_donacion;
  v_estado public.estado_donacion;
  v_total NUMERIC;
  v_ya_asignado NUMERIC;
BEGIN
  -- Sin donacion_id la fila la rechaza chk_presupuesto_origen_donacion_coherente, con su propio
  -- mensaje: este trigger corre antes que el CHECK y no tiene que adelantarse a decir otra cosa.
  IF NEW.origen <> 'donacion' OR NEW.donacion_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT d.tipo, d.estado INTO v_tipo, v_estado
  FROM public.donaciones d
  WHERE d.id = NEW.donacion_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La donacion elegida no existe.' USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF v_tipo <> 'dinero' THEN
    RAISE EXCEPTION 'Solo una donacion de dinero puede ser origen de presupuesto.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_estado <> 'registrada' THEN
    RAISE EXCEPTION 'Una donacion anulada no puede ser origen de presupuesto.'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT COALESCE(SUM(dd.monto), 0) INTO v_total
  FROM public.donacion_detalle dd
  WHERE dd.donacion_id = NEW.donacion_id;

  SELECT COALESCE(SUM(o.monto - o.devuelto), 0) INTO v_ya_asignado
  FROM public.jornada_presupuesto_origen o
  WHERE o.donacion_id = NEW.donacion_id
    AND o.id IS DISTINCT FROM NEW.id;

  IF v_ya_asignado + (NEW.monto - NEW.devuelto) > v_total THEN
    RAISE EXCEPTION 'La donacion es de Q% y ya se asignaron Q%: quedan Q% para asignar.',
      v_total, v_ya_asignado, v_total - v_ya_asignado
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- La proteccion de lo comprometido (00159) cuenta tambien con lo devuelto, y no estorba a la
-- liquidacion: esa ya comprueba que lo que sale es sobrante.
CREATE OR REPLACE FUNCTION public.fn_proteger_presupuesto_comprometido()
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
  IF current_setting('ecopac.liquidando_sobrante', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Solo importa si la jornada de OLD pierde dinero.
  IF TG_OP = 'UPDATE' AND NEW.jornada_id = OLD.jornada_id
     AND (NEW.monto - NEW.devuelto) >= (OLD.monto - OLD.devuelto)
  THEN
    RETURN NEW;
  END IF;

  SELECT j.presupuesto_asignado INTO v_asignado
  FROM public.jornadas j
  WHERE j.id = OLD.jornada_id;

  -- La jornada se esta borrando (ON DELETE CASCADE): no hay presupuesto que proteger.
  IF NOT FOUND THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_quedaria := v_asignado - (OLD.monto - OLD.devuelto)
    + CASE WHEN TG_OP = 'UPDATE' AND NEW.jornada_id = OLD.jornada_id
           THEN NEW.monto - NEW.devuelto ELSE 0 END;
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

-- ----------------------------------------------------------------------------------------------
-- Sobrante por aporte
-- ----------------------------------------------------------------------------------------------
CREATE FUNCTION public.sobrante_de_jornada(p_jornada_id UUID)
RETURNS TABLE(
  origen_id UUID,
  origen public.origen_de_presupuesto,
  monto NUMERIC,
  devuelto NUMERIC,
  usado NUMERIC,
  sobrante NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH aportes AS (
    SELECT o.id,
           o.origen,
           o.monto,
           o.devuelto,
           o.monto - o.devuelto AS cuenta,
           -- Lo que cuentan los aportes que se gastan antes que este.
           COALESCE(SUM(o.monto - o.devuelto) OVER (
             ORDER BY CASE o.origen
                        WHEN 'donacion' THEN 1
                        WHEN 'aporte_externo' THEN 2
                        WHEN 'sin_clasificar' THEN 3
                        ELSE 4
                      END,
                      o.created_at, o.id
             ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
           ), 0) AS antes
    FROM public.jornada_presupuesto_origen o
    WHERE o.jornada_id = p_jornada_id
  ),
  gastado AS (
    SELECT public.comprometido_de_jornada(p_jornada_id) AS total
  )
  SELECT a.id,
         a.origen,
         a.monto,
         a.devuelto,
         LEAST(a.cuenta, GREATEST(g.total - a.antes, 0)),
         a.cuenta - LEAST(a.cuenta, GREATEST(g.total - a.antes, 0))
  FROM aportes a CROSS JOIN gastado g
  WHERE public.es_administrador()
     OR public.tiene_permiso('jornadas.gestionar')
     OR public.accede_a_modulo_por_matriz('jornadas')
     OR public.accede_a_modulo_por_matriz('presupuestos')
  ORDER BY CASE a.origen
             WHEN 'donacion' THEN 1
             WHEN 'aporte_externo' THEN 2
             WHEN 'sin_clasificar' THEN 3
             ELSE 4
           END;
$$;

COMMENT ON FUNCTION public.sobrante_de_jornada(UUID) IS
  'Por cada aporte de una jornada: lo que cuenta, lo usado por los gastos pendientes y aprobados (primero donaciones y aportes externos, al final fondos propios) y lo que sobra (00160). La ve quien ve los aportes.';

REVOKE EXECUTE ON FUNCTION public.sobrante_de_jornada(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sobrante_de_jornada(UUID) TO authenticated;

-- ----------------------------------------------------------------------------------------------
-- Liquidacion
-- ----------------------------------------------------------------------------------------------
-- p_decisiones: [{ "origen_id": uuid, "destino": "devolver" | "traspasar",
--                  "jornada_destino_id": uuid (solo al traspasar) }, ...]
-- Cada aporte elegido entrega todo su sobrante.
CREATE FUNCTION public.fn_liquidar_sobrante_de_jornada(p_jornada_id UUID, p_decisiones JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_jornada RECORD;
  v_destino RECORD;
  v_decision JSONB;
  v_origen_id UUID;
  v_tipo TEXT;
  v_destino_id UUID;
  v_sobrante NUMERIC;
  v_aporte RECORD;
  v_liquidados INTEGER := 0;
BEGIN
  IF NOT (public.es_administrador() OR public.tiene_permiso('jornadas.gestionar')) THEN
    RAISE EXCEPTION 'Solo quien gestiona jornadas liquida el sobrante de una.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT j.id, j.nombre, j.estado, j.proyecto_id INTO v_jornada
  FROM public.jornadas j
  WHERE j.id = p_jornada_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La jornada no existe.' USING ERRCODE = 'no_data_found';
  END IF;

  IF v_jornada.estado <> 'finalizada' THEN
    RAISE EXCEPTION 'El sobrante se liquida cuando la jornada esta finalizada.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.gastos g WHERE g.jornada_id = p_jornada_id AND g.estado = 'pendiente'
  ) THEN
    RAISE EXCEPTION 'La jornada tiene gastos pendientes de aprobar: el sobrante todavia puede cambiar.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_decisiones IS NULL OR jsonb_typeof(p_decisiones) <> 'array' OR jsonb_array_length(p_decisiones) = 0 THEN
    RAISE EXCEPTION 'Indica que hacer con el sobrante de al menos un aporte.'
      USING ERRCODE = 'check_violation';
  END IF;

  PERFORM set_config('ecopac.liquidando_sobrante', 'on', true);

  FOR v_decision IN SELECT * FROM jsonb_array_elements(p_decisiones) LOOP
    v_origen_id := (v_decision->>'origen_id')::UUID;
    v_tipo := v_decision->>'destino';

    -- El sobrante se calcula de nuevo en cada vuelta: la anterior pudo cambiarlo.
    SELECT s.sobrante INTO v_sobrante
    FROM public.sobrante_de_jornada(p_jornada_id) s
    WHERE s.origen_id = v_origen_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Ese aporte no es de esta jornada.' USING ERRCODE = 'check_violation';
    END IF;

    IF v_sobrante <= 0 THEN
      RAISE EXCEPTION 'A ese aporte no le sobra nada.' USING ERRCODE = 'check_violation';
    END IF;

    SELECT o.* INTO v_aporte
    FROM public.jornada_presupuesto_origen o
    WHERE o.id = v_origen_id
    FOR UPDATE;

    IF v_tipo = 'traspasar' THEN
      v_destino_id := (v_decision->>'jornada_destino_id')::UUID;

      SELECT j.id, j.estado, j.proyecto_id INTO v_destino
      FROM public.jornadas j
      WHERE j.id = v_destino_id;

      IF NOT FOUND
         OR v_destino_id = p_jornada_id
         OR v_jornada.proyecto_id IS NULL
         OR v_destino.proyecto_id IS DISTINCT FROM v_jornada.proyecto_id
      THEN
        RAISE EXCEPTION 'El sobrante se traspasa a otra jornada del mismo proyecto.'
          USING ERRCODE = 'check_violation';
      END IF;

      IF v_destino.estado NOT IN ('planificada', 'en curso') THEN
        RAISE EXCEPTION 'La jornada que recibe el sobrante tiene que estar planificada o en curso.'
          USING ERRCODE = 'check_violation';
      END IF;
    ELSIF v_tipo IS DISTINCT FROM 'devolver' THEN
      RAISE EXCEPTION 'El destino del sobrante es devolver o traspasar.'
        USING ERRCODE = 'check_violation';
    END IF;

    -- Primero sale de esta jornada; despues entra en la otra. En ese orden, el saldo de la
    -- donacion (fn_validar_origen_de_presupuesto) nunca cuenta el mismo dinero dos veces.
    UPDATE public.jornada_presupuesto_origen
    SET devuelto = devuelto + v_sobrante
    WHERE id = v_origen_id;

    IF v_tipo = 'traspasar' THEN
      INSERT INTO public.jornada_presupuesto_origen
        (jornada_id, origen, donacion_id, fuente_id, monto, descripcion, traspasado_desde)
      VALUES
        (v_destino_id, v_aporte.origen, v_aporte.donacion_id, v_aporte.fuente_id, v_sobrante,
         'Sobrante de la jornada ' || v_jornada.nombre, v_origen_id);
    END IF;

    v_liquidados := v_liquidados + 1;
  END LOOP;

  PERFORM set_config('ecopac.liquidando_sobrante', 'off', true);

  RETURN v_liquidados;
END;
$$;

COMMENT ON FUNCTION public.fn_liquidar_sobrante_de_jornada(UUID, JSONB) IS
  'Liquida el sobrante de una jornada finalizada sin gastos pendientes: por cada aporte elegido, lo devuelve a su origen o lo traspasa a otra jornada planificada o en curso del mismo proyecto (00160). Administradora o jornadas.gestionar.';

REVOKE EXECUTE ON FUNCTION public.fn_liquidar_sobrante_de_jornada(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_liquidar_sobrante_de_jornada(UUID, JSONB) TO authenticated;
