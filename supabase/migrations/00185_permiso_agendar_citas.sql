-- ============================================================================
-- 00185: agendar citas es un permiso fino (issue #927)
-- ============================================================================
--
-- La 00184 dejo agendar, editar y cancelar citas al rol: la administradora, quien tiene
-- jornadas.gestionar y el personal de campo (medico y voluntario general) de la jornada. La
-- administracion pidio poder cambiarlo por persona, como los demas permisos finos: quitarselo a
-- un voluntario, o darselo a alguien que no es personal de campo.
--
-- 1. Permiso citas.agendar (modulo pacientes, donde vive la agenda). Por defecto lo tienen los
--    mismos de antes: administrador, medico y voluntario general. Se concede o revoca por persona
--    en Colaboradores > Permisos (usuario_permiso), y tiene_permiso() ya resuelve las dos cosas.
-- 2. INSERT de citas: la administradora, jornadas.gestionar, o citas.agendar y pertenecer a la
--    jornada. Ver las citas no cambia (00184).
-- 3. UPDATE: la politica sigue abierta al personal de campo de la jornada, porque Atender es un
--    UPDATE (creada -> en atencion) y lo hace quien atiende aunque no agende. Sin citas.agendar
--    solo se cambia el estado entre creada y en atencion (Atender y Regresar a creada): ni
--    reagendar, ni cancelar, ni las notas. Lo hace cumplir un trigger, porque una politica no
--    distingue que columnas cambian.
--
-- Los cambios que no hace una persona sino el sistema no pasan por la regla: la consulta que deja
-- la cita atendida (ecopac.cita_atendida_por_consulta), la fusion de pacientes
-- (ecopac.fusionando_pacientes) y el cierre o la cancelacion de la jornada, que hace quien
-- gestiona jornadas.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. El permiso
-- ----------------------------------------------------------------------------
INSERT INTO public.permisos (clave, modulo, descripcion) VALUES
  ('citas.agendar', 'pacientes',
   'Agendar, reagendar y cancelar citas en las jornadas a las que se pertenece.');

INSERT INTO public.rol_permiso (rol, permiso_id)
SELECT r.rol::public.rol_usuario, p.id
FROM public.permisos p
CROSS JOIN (VALUES ('administrador'), ('medico'), ('voluntario general')) AS r (rol)
WHERE p.clave = 'citas.agendar';

-- ----------------------------------------------------------------------------
-- 2. Quien agenda
-- ----------------------------------------------------------------------------
DROP POLICY "Administracion, gestion de jornadas y su personal de campo agendan citas"
  ON public.citas;

CREATE POLICY "Administracion, gestion de jornadas o permiso de agenda en su jornada agendan citas"
  ON public.citas FOR INSERT
  WITH CHECK (
    public.es_administrador()
    OR public.tiene_permiso('jornadas.gestionar')
    OR (public.tiene_permiso('citas.agendar') AND public.pertenece_a_jornada(jornada_id))
  );

-- ----------------------------------------------------------------------------
-- 3. Sin el permiso, solo Atender y Regresar a creada
-- ----------------------------------------------------------------------------
CREATE FUNCTION public.fn_cita_exige_permiso_de_agenda()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF current_setting('ecopac.cita_atendida_por_consulta', TRUE) = 'on'
     OR current_setting('ecopac.fusionando_pacientes', TRUE) = 'on'
     OR public.es_administrador()
     OR public.tiene_permiso('jornadas.gestionar')
     OR public.tiene_permiso('citas.agendar') THEN
    RETURN NEW;
  END IF;

  -- Solo el estado, y solo entre creada y en atencion.
  IF (to_jsonb(NEW) - 'estado' - 'updated_at') IS NOT DISTINCT FROM (to_jsonb(OLD) - 'estado' - 'updated_at')
     AND OLD.estado IN ('creada', 'en_atencion')
     AND NEW.estado IN ('creada', 'en_atencion') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Sin el permiso de agendar citas solo se abre la cita (Atender) o se regresa a creada.'
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

COMMENT ON FUNCTION public.fn_cita_exige_permiso_de_agenda() IS
  'Sin citas.agendar (ni administracion ni jornadas.gestionar), una cita solo cambia de estado entre creada y en atencion: Atender y Regresar a creada (00185). Los cambios del sistema (consulta, fusion) no pasan por la regla.';

REVOKE EXECUTE ON FUNCTION public.fn_cita_exige_permiso_de_agenda() FROM PUBLIC, anon, authenticated;

-- Antes de fn_validar_cita (trg_citas_validar): los triggers del mismo evento corren en orden
-- alfabetico, y "trg_citas_exige..." va antes que "trg_citas_validar".
CREATE TRIGGER trg_citas_exige_permiso_de_agenda
BEFORE UPDATE ON public.citas
FOR EACH ROW EXECUTE FUNCTION public.fn_cita_exige_permiso_de_agenda();
