-- Ecopac Digital - Transiciones validas de estado de jornada (issue #171)
--
-- jornadas.estado no tenia ningun trigger de validacion de transiciones, a diferencia de
-- proyectos (00029_kanban_proyectos_historial.sql, seccion 4): esta migracion reproduce ese
-- mismo patron para jornadas, con el matiz de reapertura restringida a administrador que
-- proyectos no necesita (proyectos no reabre estados terminales).
--
-- La auditoria "quien y cuando cambio el estado" (criterio de aceptacion 5) ya esta resuelta
-- desde 00012_jornadas.sql: el trigger registrar_cambio_estado_jornada() (AFTER INSERT OR
-- UPDATE OF estado, SECURITY DEFINER) ya inserta en jornada_estado_historial en cada cambio.
-- Esta migracion no toca esa parte.
--
-- 'cancelada' (existe en el enum estado_jornada desde 00001, no aparece en ningun criterio de
-- la #171 y nada la usa hoy) queda fuera de alcance: el trigger nuevo no permite ninguna
-- transicion a/desde cancelada. No rompe nada existente (no hay filas ni codigo que la fije).
--
-- "Jornadas simultaneas prohibidas o documentadas" (otro criterio de la #171) tampoco se
-- implementa aqui: la propia issue lo marca como "Pending organizational decision on
-- concurrent shift execution across different communities... affects mobile app active-shift
-- resolution". Queda documentado como pendiente, sin bloquear ninguna transicion por eso.

-- ============================================================================
-- 1. Trigger de bloqueo de transiciones de estado invalidas
-- ============================================================================
-- Transiciones permitidas: planificada -> en curso, en curso -> finalizada, y la reapertura
-- finalizada -> en curso (solo administrador).
CREATE OR REPLACE FUNCTION fn_validar_transicion_estado_jornada()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.estado = 'planificada' AND NEW.estado = 'en curso' THEN
    RETURN NEW;
  ELSIF OLD.estado = 'en curso' AND NEW.estado = 'finalizada' THEN
    RETURN NEW;
  ELSIF OLD.estado = 'finalizada' AND NEW.estado = 'en curso' THEN
    IF NOT public.es_administrador() THEN
      RAISE EXCEPTION 'Solo un administrador puede reabrir una jornada finalizada.';
    END IF;
    RETURN NEW;
  ELSE
    RAISE EXCEPTION 'Transicion de estado invalida para jornadas: % -> %', OLD.estado, NEW.estado;
  END IF;
END;
$$;

COMMENT ON FUNCTION fn_validar_transicion_estado_jornada() IS
  'Bloquea cambios de estado de jornadas que no esten en la lista de transiciones permitidas '
  '(planificada->en curso, en curso->finalizada, finalizada->en curso). La reapertura '
  '(finalizada->en curso) exige ademas es_administrador(). No es SECURITY DEFINER: evalua con '
  'los privilegios de quien hace el UPDATE. Issue #171.';

CREATE TRIGGER tr_validar_transicion_estado_jornada
BEFORE UPDATE OF estado ON jornadas
FOR EACH ROW
WHEN (OLD.estado IS DISTINCT FROM NEW.estado)
EXECUTE FUNCTION fn_validar_transicion_estado_jornada();

COMMENT ON TRIGGER tr_validar_transicion_estado_jornada ON jornadas IS
  'Impide guardar un cambio de estado de jornada que no este en la lista de transiciones '
  'permitidas, o una reapertura hecha por alguien que no sea administrador. Issue #171.';

-- ============================================================================
-- 2. Conteo de atenciones incompletas, para advertir antes de finalizar
-- ============================================================================
-- "Incompleta" = una atencion registrada en la jornada que todavia no tiene consulta (flujo
-- registro -> triaje -> consulta -> receta, comentario de 00013_atenciones_triajes.sql).
-- Ninguna de las dos tablas es propiedad de jornadas/api.js: mismo motivo por el que
-- personal_registro_atenciones (00044) existe como funcion en vez de una consulta directa ahi.
CREATE OR REPLACE FUNCTION fn_contar_atenciones_incompletas(p_jornada_id UUID)
RETURNS INT AS $$
  SELECT count(*)::INT
  FROM atenciones a
  WHERE a.jornada_id = p_jornada_id
    AND NOT EXISTS (SELECT 1 FROM consultas c WHERE c.atencion_id = a.id);
$$ LANGUAGE sql STABLE;

GRANT EXECUTE ON FUNCTION fn_contar_atenciones_incompletas(UUID) TO authenticated;

COMMENT ON FUNCTION fn_contar_atenciones_incompletas(UUID) IS
  'Cuenta las atenciones de una jornada que todavia no tienen consulta asociada. '
  'jornadas/api.js la consulta antes de finalizar una jornada para advertir -sin bloquear- '
  'si hay atenciones incompletas (issue #171, criterio de aceptacion 4). No es SECURITY '
  'DEFINER: respeta las politicas de SELECT de atenciones/consultas (00033).';
