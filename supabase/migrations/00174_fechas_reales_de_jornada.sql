-- ============================================================================
-- 00174: inicio y cierre reales de una jornada se llenan solos
-- ============================================================================
--
-- La 00036 agrego jornadas.fecha_inicio_real y jornadas.fecha_fin_real, y la 00156 las documento
-- como "al pasarla a en curso" y "al finalizarla". Pero nadie las escribia: ni el cliente ni un
-- trigger. El detalle de la jornada mostraba "Inicio real: —" y "Cierre real: —" siempre.
--
-- Las llena un trigger, no el cliente: el cambio de estado llega por mas de un camino (kanban,
-- detalle, movil) y la hora tiene que ser la del servidor.
--
-- 1. Pasar a `en curso` fija el inicio real, si todavia no tiene. Reabrir una finalizada (00051,
--    finalizada -> en curso) no lo mueve: la jornada empezo cuando empezo.
-- 2. Pasar a `finalizada` fija el cierre real. Reabrirla lo borra: ya no esta cerrada, y el
--    siguiente cierre pone la hora nueva.
--
-- Y se rellenan las jornadas que ya cambiaron de estado, con la hora que dejo
-- jornada_estado_historial (00012).
-- ============================================================================

-- Solo mira OLD y NEW: no consulta otras tablas, asi que no necesita SECURITY DEFINER.
CREATE FUNCTION public.fn_fechas_reales_de_jornada()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_estado_anterior TEXT := CASE WHEN TG_OP = 'UPDATE' THEN OLD.estado::TEXT END;
BEGIN
  IF v_estado_anterior IS DISTINCT FROM NEW.estado::TEXT THEN
    IF NEW.estado = 'en curso' THEN
      NEW.fecha_inicio_real := COALESCE(NEW.fecha_inicio_real, NOW());
      NEW.fecha_fin_real := NULL;
    ELSIF NEW.estado = 'finalizada' THEN
      NEW.fecha_inicio_real := COALESCE(NEW.fecha_inicio_real, NOW());
      NEW.fecha_fin_real := NOW();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_fechas_reales_de_jornada() IS
  'Fija fecha_inicio_real al pasar una jornada a en curso y fecha_fin_real al finalizarla; reabrirla borra el cierre (00174).';

REVOKE EXECUTE ON FUNCTION public.fn_fechas_reales_de_jornada() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_jornadas_fechas_reales
BEFORE INSERT OR UPDATE OF estado ON public.jornadas
FOR EACH ROW
EXECUTE FUNCTION public.fn_fechas_reales_de_jornada();

-- ----------------------------------------------------------------------------
-- Las jornadas que ya cambiaron de estado
-- ----------------------------------------------------------------------------
-- El inicio es el primer paso a `en curso`; el cierre, el ultimo paso a `finalizada`. Una jornada
-- que llego a finalizada sin pasar por en curso en el historial toma el cierre como inicio.
UPDATE public.jornadas j
SET fecha_inicio_real = h.inicio
FROM (
  SELECT jornada_id, MIN(created_at) AS inicio
  FROM public.jornada_estado_historial
  WHERE estado_nuevo IN ('en curso', 'finalizada')
  GROUP BY jornada_id
) h
WHERE h.jornada_id = j.id
  AND j.estado IN ('en curso', 'finalizada')
  AND j.fecha_inicio_real IS NULL;

UPDATE public.jornadas j
SET fecha_fin_real = h.cierre
FROM (
  SELECT jornada_id, MAX(created_at) AS cierre
  FROM public.jornada_estado_historial
  WHERE estado_nuevo = 'finalizada'
  GROUP BY jornada_id
) h
WHERE h.jornada_id = j.id
  AND j.estado = 'finalizada'
  AND j.fecha_fin_real IS NULL;

COMMENT ON COLUMN public.jornadas.fecha_inicio_real IS
  'Cuando empezo de verdad: la fija un trigger al pasarla a en curso (00174).';
COMMENT ON COLUMN public.jornadas.fecha_fin_real IS
  'Cuando termino de verdad: la fija un trigger al finalizarla, y reabrirla la borra (00174).';
