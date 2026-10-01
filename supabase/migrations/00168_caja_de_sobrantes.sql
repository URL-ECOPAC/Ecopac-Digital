-- ============================================================================
-- 00168: la caja, donde queda el sobrante que no vuelve a una donacion
-- ============================================================================
--
-- Al liquidar el sobrante de una jornada (00160), lo que vino de una donacion vuelve a quedar
-- libre en ella. Lo que vino de fondos propios, de un aporte externo o sin clasificar "salia de
-- la jornada" y no quedaba en ningun lado: el sistema perdia la cuenta de ese dinero.
--
-- Desde aqui ese sobrante entra a la caja, y la caja es un origen mas del presupuesto (00167): al
-- registrar un aporte se puede elegir "Caja" hasta lo que tenga.
--
-- movimientos_de_caja es el libro de la caja:
--   - entrada: el sobrante devuelto de un aporte que no es de una donacion. La escribe
--     fn_liquidar_sobrante_de_jornada.
--   - salida: un aporte con origen caja. La escribe un trigger al registrarlo; si el aporte se
--     quita, la salida se va con el (ON DELETE CASCADE) y el dinero vuelve a la caja.
-- El saldo es entradas menos salidas (saldo_de_caja). Nadie escribe la tabla a mano.
--
-- Un traspaso de sobrante a otra jornada (00160) no pasa por la caja: el dinero va de una
-- jornada a la otra. Si el aporte traspasado era de la caja, el nuevo tambien lo es, pero no
-- vuelve a sacar nada de ella.
-- ============================================================================

COMMENT ON COLUMN public.jornada_presupuesto_origen.origen IS
  'donacion: sale de una donacion de dinero (donacion_id). fondos_propios: dinero de la organizacion. aporte_externo: otra fuente que no pasa por el registro de donaciones. sin_clasificar: el presupuesto que existia antes de la 00135, o el de un INSERT de jornada que traia el monto ya puesto. caja: sale de la caja, donde queda el sobrante que no vuelve a una donacion (00168).';

CREATE TABLE public.movimientos_de_caja (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  tipo VARCHAR(10) NOT NULL,
  monto NUMERIC(12, 2) NOT NULL,
  aporte_id UUID NOT NULL REFERENCES public.jornada_presupuesto_origen(id) ON DELETE CASCADE,
  jornada_id UUID NOT NULL REFERENCES public.jornadas(id) ON DELETE CASCADE,
  descripcion VARCHAR(200),
  registrado_por UUID DEFAULT auth.uid() REFERENCES public.perfiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_movimientos_de_caja_tipo CHECK (tipo IN ('entrada', 'salida')),
  CONSTRAINT chk_movimientos_de_caja_monto_positivo CHECK (monto > 0)
);

-- Un aporte saca de la caja una sola vez.
CREATE UNIQUE INDEX uq_movimientos_de_caja_salida_por_aporte
  ON public.movimientos_de_caja (aporte_id) WHERE tipo = 'salida';
CREATE INDEX idx_movimientos_de_caja_aporte_id ON public.movimientos_de_caja (aporte_id);
CREATE INDEX idx_movimientos_de_caja_jornada_id ON public.movimientos_de_caja (jornada_id);

COMMENT ON TABLE public.movimientos_de_caja IS
  'Libro de la caja (00168): entra el sobrante devuelto de los aportes que no son de una donacion y sale lo que se asigna a una jornada con origen caja. Lo escriben fn_liquidar_sobrante_de_jornada y un trigger de jornada_presupuesto_origen; nadie a mano.';
COMMENT ON COLUMN public.movimientos_de_caja.id IS 'Identificador del movimiento.';
COMMENT ON COLUMN public.movimientos_de_caja.tipo IS
  'entrada: sobrante devuelto a la caja. salida: aporte a una jornada que sale de la caja.';
COMMENT ON COLUMN public.movimientos_de_caja.monto IS 'Cuanto entra o sale, en quetzales.';
COMMENT ON COLUMN public.movimientos_de_caja.aporte_id IS
  'En una entrada, el aporte cuyo sobrante se devolvio; en una salida, el aporte con origen caja.';
COMMENT ON COLUMN public.movimientos_de_caja.jornada_id IS
  'La jornada de ese aporte: de la que viene el sobrante o la que recibe el dinero.';
COMMENT ON COLUMN public.movimientos_de_caja.descripcion IS 'Que fue, en palabras.';
COMMENT ON COLUMN public.movimientos_de_caja.registrado_por IS 'Quien hizo la operacion.';
COMMENT ON COLUMN public.movimientos_de_caja.created_at IS 'Cuando entro o salio el dinero.';

ALTER TABLE public.movimientos_de_caja ENABLE ROW LEVEL SECURITY;

-- Solo lectura: las filas las escriben funciones SECURITY DEFINER.
GRANT SELECT ON public.movimientos_de_caja TO authenticated;

-- La lee quien ve los aportes y su sobrante (sobrante_de_jornada, 00160).
CREATE POLICY "Leen la caja quien ve los aportes"
  ON public.movimientos_de_caja FOR SELECT TO authenticated
  USING (
    public.es_administrador()
    OR public.tiene_permiso('jornadas.gestionar')
    OR public.accede_a_modulo_por_matriz('jornadas')
    OR public.accede_a_modulo_por_matriz('presupuestos')
  );

-- ----------------------------------------------------------------------------------------------
-- Saldo
-- ----------------------------------------------------------------------------------------------
-- Sin RLS de por medio (SECURITY DEFINER): el trigger que valida una salida necesita el saldo
-- entero, lo vea o no quien registra. Para leerlo desde la pantalla, la misma condicion que la
-- politica de la tabla.
CREATE FUNCTION public.fn_saldo_de_caja_sin_filtro()
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(SUM(CASE WHEN m.tipo = 'entrada' THEN m.monto ELSE -m.monto END), 0)
  FROM public.movimientos_de_caja m;
$$;

COMMENT ON FUNCTION public.fn_saldo_de_caja_sin_filtro() IS
  'Saldo de la caja sin pasar por RLS (00168). Solo la usan los triggers; la pantalla lee saldo_de_caja().';

REVOKE EXECUTE ON FUNCTION public.fn_saldo_de_caja_sin_filtro() FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.saldo_de_caja()
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.fn_saldo_de_caja_sin_filtro()
  WHERE public.es_administrador()
     OR public.tiene_permiso('jornadas.gestionar')
     OR public.accede_a_modulo_por_matriz('jornadas')
     OR public.accede_a_modulo_por_matriz('presupuestos');
$$;

COMMENT ON FUNCTION public.saldo_de_caja() IS
  'Lo que hay en la caja: entradas menos salidas (00168). NULL para quien no ve los aportes.';

REVOKE EXECUTE ON FUNCTION public.saldo_de_caja() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.saldo_de_caja() TO authenticated;

-- ----------------------------------------------------------------------------------------------
-- Un aporte con origen caja saca de la caja
-- ----------------------------------------------------------------------------------------------
CREATE FUNCTION public.fn_validar_aporte_de_caja()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_saldo NUMERIC;
  v_ya_sacado NUMERIC := 0;
BEGIN
  -- Un traspaso de sobrante (00160) mueve dinero entre jornadas, no de la caja.
  IF NEW.origen <> 'caja' OR NEW.traspasado_desde IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.monto = OLD.monto AND OLD.origen = 'caja' THEN
      RETURN NEW;
    END IF;
    IF OLD.origen = 'caja' THEN
      v_ya_sacado := OLD.monto;
    END IF;
  END IF;

  v_saldo := public.fn_saldo_de_caja_sin_filtro() + v_ya_sacado;
  IF NEW.monto > v_saldo THEN
    RAISE EXCEPTION 'La caja tiene Q%: no alcanza para Q%.',
      to_char(v_saldo, 'FM999999990.00'),
      to_char(NEW.monto, 'FM999999990.00')
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_validar_aporte_de_caja() IS
  'Trigger de jornada_presupuesto_origen (00168): un aporte con origen caja no saca mas de lo que hay en ella.';

CREATE TRIGGER trg_presupuesto_origen_validar_caja
BEFORE INSERT OR UPDATE ON public.jornada_presupuesto_origen
FOR EACH ROW
EXECUTE FUNCTION public.fn_validar_aporte_de_caja();

COMMENT ON TRIGGER trg_presupuesto_origen_validar_caja ON public.jornada_presupuesto_origen IS
  'Un aporte de la caja no pasa del saldo de la caja (00168).';

CREATE FUNCTION public.fn_registrar_salida_de_caja()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_jornada TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.origen = 'caja' AND OLD.traspasado_desde IS NULL
     AND (NEW.origen <> 'caja' OR NEW.traspasado_desde IS NOT NULL) THEN
    DELETE FROM public.movimientos_de_caja WHERE aporte_id = NEW.id AND tipo = 'salida';
    RETURN NEW;
  END IF;

  IF NEW.origen <> 'caja' OR NEW.traspasado_desde IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT j.nombre INTO v_jornada FROM public.jornadas j WHERE j.id = NEW.jornada_id;

  INSERT INTO public.movimientos_de_caja
    (tipo, monto, aporte_id, jornada_id, descripcion, registrado_por)
  VALUES
    ('salida', NEW.monto, NEW.id, NEW.jornada_id, 'Aporte a la jornada ' || v_jornada,
     NEW.registrado_por)
  ON CONFLICT (aporte_id) WHERE tipo = 'salida'
  DO UPDATE SET monto = EXCLUDED.monto, jornada_id = EXCLUDED.jornada_id,
                descripcion = EXCLUDED.descripcion;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_registrar_salida_de_caja() IS
  'Trigger de jornada_presupuesto_origen (00168): un aporte con origen caja deja su salida en movimientos_de_caja.';

CREATE TRIGGER trg_presupuesto_origen_salida_de_caja
AFTER INSERT OR UPDATE ON public.jornada_presupuesto_origen
FOR EACH ROW
EXECUTE FUNCTION public.fn_registrar_salida_de_caja();

COMMENT ON TRIGGER trg_presupuesto_origen_salida_de_caja ON public.jornada_presupuesto_origen IS
  'Registra la salida de la caja de un aporte con origen caja (00168).';

REVOKE EXECUTE ON FUNCTION public.fn_validar_aporte_de_caja() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_registrar_salida_de_caja() FROM PUBLIC;

-- ----------------------------------------------------------------------------------------------
-- La liquidacion manda a la caja lo que no es de una donacion
-- ----------------------------------------------------------------------------------------------
-- Igual que en la 00160, salvo la entrada a la caja al devolver.
CREATE OR REPLACE FUNCTION public.fn_liquidar_sobrante_de_jornada(p_jornada_id UUID, p_decisiones JSONB)
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
    ELSIF v_aporte.origen <> 'donacion' THEN
      -- 00168: lo que no vuelve a una donacion entra a la caja.
      INSERT INTO public.movimientos_de_caja
        (tipo, monto, aporte_id, jornada_id, descripcion)
      VALUES
        ('entrada', v_sobrante, v_origen_id, p_jornada_id,
         'Sobrante de la jornada ' || v_jornada.nombre);
    END IF;

    v_liquidados := v_liquidados + 1;
  END LOOP;

  PERFORM set_config('ecopac.liquidando_sobrante', 'off', true);

  RETURN v_liquidados;
END;
$$;

COMMENT ON FUNCTION public.fn_liquidar_sobrante_de_jornada(UUID, JSONB) IS
  'Liquida el sobrante de una jornada finalizada sin gastos pendientes: por cada aporte elegido, lo devuelve a su origen o lo traspasa a otra jornada planificada o en curso del mismo proyecto (00160). Lo devuelto que no es de una donacion entra a la caja (00168). Administradora o jornadas.gestionar.';

-- ----------------------------------------------------------------------------------------------
-- Lo que ya se habia devuelto antes de la caja
-- ----------------------------------------------------------------------------------------------
-- Lo devuelto de un aporte que no es de una donacion, menos lo que se traspaso a otra jornada,
-- es lo que "salio de la jornada" sin ir a ningun lado: entra a la caja con la fecha en que se
-- liquido.
INSERT INTO public.movimientos_de_caja
  (tipo, monto, aporte_id, jornada_id, descripcion, registrado_por, created_at)
SELECT 'entrada',
       o.devuelto - COALESCE(t.traspasado, 0),
       o.id,
       o.jornada_id,
       'Sobrante de la jornada ' || j.nombre,
       NULL,
       o.updated_at
FROM public.jornada_presupuesto_origen o
JOIN public.jornadas j ON j.id = o.jornada_id
LEFT JOIN LATERAL (
  SELECT SUM(h.monto) AS traspasado
  FROM public.jornada_presupuesto_origen h
  WHERE h.traspasado_desde = o.id
) t ON TRUE
WHERE o.origen <> 'donacion'
  AND o.devuelto - COALESCE(t.traspasado, 0) > 0;

-- La caja se ve en tiempo real como el resto del presupuesto (00163).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.movimientos_de_caja;
  END IF;
END;
$$;
