-- ============================================================================
-- 00165: "hoy" de un gasto no depende de la zona horaria del servidor
-- ============================================================================
--
-- fn_validar_gasto_contra_presupuesto (00159) acepta la fecha de un gasto hasta el dia de su
-- jornada o, si ya paso, hasta hoy, y calculaba "hoy" con la hora de Guatemala. Pero
-- gastos.fecha toma por defecto CURRENT_DATE, que es el dia del servidor (UTC). Entre las 18:00 y
-- la medianoche de Guatemala el servidor ya va un dia adelante: un gasto registrado sin fecha
-- quedaba con la fecha de "manana" y se rechazaba como futuro. Lo encontro el CI corriendo a las
-- 00:00 UTC.
--
-- "Hoy" pasa a ser el mas tardio de los dos dias. Asi se acepta el gasto del dia en cualquiera de
-- las dos zonas, y lo que de verdad es futuro (despues de la jornada y de manana en UTC) se sigue
-- rechazando. Solo cambia esa linea; el resto de la funcion es la de la 00159.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_validar_gasto_contra_presupuesto()
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
  -- El dia mas tardio entre el del servidor (UTC, el de gastos.fecha DEFAULT CURRENT_DATE) y el
  -- de Guatemala: desde las 18:00 de Guatemala el servidor ya esta en el dia siguiente, y un gasto
  -- registrado sin fecha se rechazaba como futuro.
  v_hoy DATE := GREATEST(CURRENT_DATE, (now() AT TIME ZONE 'America/Guatemala')::DATE);
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
