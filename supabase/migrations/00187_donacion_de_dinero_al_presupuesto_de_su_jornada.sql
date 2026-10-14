-- ============================================================================
-- 00187: una donacion de dinero recibida para una jornada entra sola a su presupuesto
-- ============================================================================
--
-- Desde la 00153 una donacion se puede registrar para una jornada (donaciones.jornada_id), y desde
-- la 00135 una donacion de dinero puede ser origen del presupuesto de una jornada
-- (jornada_presupuesto_origen). Las dos cosas no estaban unidas: la jornada elegida al donar solo
-- servia para ordenar la donacion primero en el selector de "Registrar un aporte", y habia que ir
-- al presupuesto de la jornada y volver a asignarla a mano. Quien registraba la donacion la veia
-- "para la jornada" y en el presupuesto de la jornada no aparecia.
--
-- Desde aqui el aporte se crea solo: al registrar una donacion de dinero para una jornada, su
-- monto entra al presupuesto de esa jornada como un aporte de origen "donacion".
--
-- DECISIONES
--
-- - Es un trigger de donacion_detalle y no un paso de fn_registrar_donacion: el monto de una
--   donacion es la suma de sus renglones, que se insertan despues de la donacion, y un trigger
--   vale para cualquier camino que escriba un renglon. El primer renglon con monto crea el
--   aporte; los siguientes lo suben.
-- - SECURITY DEFINER: quien registra donaciones (donaciones.registrar) puede no gestionar
--   jornadas, y la politica de INSERT de jornada_presupuesto_origen pide jornadas.gestionar. El
--   aporte es consecuencia de la donacion, no una decision aparte: no puede depender de un
--   segundo permiso. Solo escribe el aporte de ESA donacion en SU jornada, por el monto donado.
-- - Solo en una jornada planificada o en curso. En una finalizada o cancelada el presupuesto ya
--   no se mueve (la pantalla tampoco deja registrar aportes): la donacion queda con su saldo
--   libre, como antes.
-- - El aporte automatico es un aporte como cualquier otro: se puede quitar desde la jornada (el
--   dinero vuelve a quedar libre en la donacion) y su sobrante se liquida igual (00160).
-- - registrado_por es quien registro la donacion: dentro de una peticion lo fija
--   trg_presupuesto_origen_registrado_por con auth.uid(), y fuera de una (seed, migraciones) se
--   respeta el que se manda, que es el de la donacion.
-- ============================================================================

CREATE FUNCTION public.fn_aportar_donacion_a_su_jornada()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_donacion RECORD;
  v_estado_de_la_jornada public.estado_jornada;
  v_aporte_id UUID;
BEGIN
  IF NEW.monto IS NULL OR NEW.monto <= 0 THEN
    RETURN NULL;
  END IF;

  SELECT d.tipo, d.estado, d.jornada_id, d.registrado_por INTO v_donacion
  FROM public.donaciones d
  WHERE d.id = NEW.donacion_id;

  IF v_donacion.jornada_id IS NULL
     OR v_donacion.tipo IS DISTINCT FROM 'dinero'::public.tipo_donacion
     OR v_donacion.estado IS DISTINCT FROM 'registrada'::public.estado_donacion
  THEN
    RETURN NULL;
  END IF;

  SELECT j.estado INTO v_estado_de_la_jornada
  FROM public.jornadas j
  WHERE j.id = v_donacion.jornada_id;

  IF v_estado_de_la_jornada IS NULL
     OR v_estado_de_la_jornada NOT IN ('planificada', 'en curso')
  THEN
    RETURN NULL;
  END IF;

  -- El aporte que esta donacion ya tiene en su jornada, si un renglon anterior lo creo. Uno ya
  -- liquidado o que llego por traspaso (00160) es historia y no se toca.
  SELECT o.id INTO v_aporte_id
  FROM public.jornada_presupuesto_origen o
  WHERE o.donacion_id = NEW.donacion_id
    AND o.jornada_id = v_donacion.jornada_id
    AND o.traspasado_desde IS NULL
    AND o.devuelto = 0
  ORDER BY o.created_at, o.id
  LIMIT 1
  FOR UPDATE;

  IF v_aporte_id IS NULL THEN
    INSERT INTO public.jornada_presupuesto_origen
      (jornada_id, origen, donacion_id, monto, descripcion, registrado_por)
    VALUES
      (v_donacion.jornada_id, 'donacion', NEW.donacion_id, NEW.monto,
       'Recibida para esta jornada', v_donacion.registrado_por);
  ELSE
    UPDATE public.jornada_presupuesto_origen
    SET monto = monto + NEW.monto
    WHERE id = v_aporte_id;
  END IF;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.fn_aportar_donacion_a_su_jornada() IS
  'Trigger de donacion_detalle (00187): el monto de una donacion de dinero registrada para una jornada planificada o en curso entra a su presupuesto como aporte de origen donacion. DEFINER: quien registra donaciones puede no gestionar jornadas.';

REVOKE EXECUTE ON FUNCTION public.fn_aportar_donacion_a_su_jornada() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_donacion_detalle_aportar_a_su_jornada
AFTER INSERT ON public.donacion_detalle
FOR EACH ROW
EXECUTE FUNCTION public.fn_aportar_donacion_a_su_jornada();

COMMENT ON TRIGGER trg_donacion_detalle_aportar_a_su_jornada ON public.donacion_detalle IS
  'El dinero donado para una jornada entra solo a su presupuesto (00187).';

-- ----------------------------------------------------------------------------------------------
-- Las donaciones que ya se registraron para una jornada y nunca se asignaron
-- ----------------------------------------------------------------------------------------------
-- Solo las que no tienen NINGUN aporte, en ninguna jornada: una donacion que ya se repartio a
-- mano, o cuyo aporte se quito o se liquido, refleja una decision que no se pisa. Y solo en
-- jornadas planificadas o en curso, igual que el trigger. Fuera de una peticion auth.uid() es
-- NULL y trg_presupuesto_origen_registrado_por respeta el registrado_por que se manda: quien
-- registro la donacion.
INSERT INTO public.jornada_presupuesto_origen
  (jornada_id, origen, donacion_id, monto, descripcion, registrado_por)
SELECT d.jornada_id, 'donacion', d.id, t.total, 'Recibida para esta jornada', d.registrado_por
FROM public.donaciones d
JOIN public.jornadas j ON j.id = d.jornada_id
JOIN LATERAL (
  SELECT COALESCE(SUM(dd.monto), 0) AS total
  FROM public.donacion_detalle dd
  WHERE dd.donacion_id = d.id
) t ON TRUE
WHERE d.tipo = 'dinero'
  AND d.estado = 'registrada'
  AND j.estado IN ('planificada', 'en curso')
  AND t.total > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.jornada_presupuesto_origen o WHERE o.donacion_id = d.id
  );
