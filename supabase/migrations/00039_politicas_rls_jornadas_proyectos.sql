-- Ecopac Digital - Politicas RLS de jornadas, personal asignado y proyectos
-- Issue #90. Matriz del DoD:
-- - Solo administrador crea jornadas y cambia su estado. Se escribe como
--   es_administrador() OR tiene_permiso('jornadas.gestionar'): el permiso fino se
--   sembro en 00003 justo para esto ("crear, editar o cerrar jornadas sin ser
--   administrador") y por defecto solo lo tiene administrador, asi que el DoD se
--   cumple y el mecanismo de excepciones queda funcional.
-- - Medico y voluntario leen UNICAMENTE las jornadas donde estan asignados, via
--   participa_en_jornada() (00004): es SECURITY DEFINER, asi que funciona aunque
--   el rol no tenga SELECT amplio sobre jornada_personal.
-- - Junta directiva tiene lectura sobre jornadas y proyectos. Socio fundador
--   queda fuera de las cinco tablas (lectura literal del DoD).
-- - Los historiales de estado (jornada_estado_historial de 00012 y
--   proyecto_estado_historial de 00029) son de solo lectura y SOLO para
--   administrador; la escritura la hace unicamente su trigger SECURITY DEFINER:
--   no se otorga GRANT de INSERT/UPDATE/DELETE a ningun rol de aplicacion, asi
--   que un intento directo muere con 42501 (insufficient_privilege) antes de que
--   RLS llegue a evaluarse — misma filosofia que el DELETE de pacientes (suite
--   de #88). El trigger escribe como owner, que bypasea RLS.
-- - proyecto_estado_historial no se nombra en la descripcion del issue pero es el
--   espejo exacto de jornada_estado_historial (00029): se gobierna con la misma
--   regla para no dejarla abierta por omission.
-- - Sin politicas de DELETE en ninguna tabla, como en el resto del esquema.

-- ============================================================================
-- GRANT: RLS no sustituye los privilegios SQL estandar (ver 00032/00033/00034)
-- ============================================================================
GRANT SELECT ON jornadas TO anon, authenticated;
GRANT INSERT, UPDATE ON jornadas TO authenticated;
GRANT SELECT ON jornada_personal TO anon, authenticated;
GRANT INSERT, UPDATE ON jornada_personal TO authenticated;
GRANT SELECT ON jornada_estado_historial TO anon, authenticated;
GRANT SELECT ON proyectos TO anon, authenticated;
GRANT INSERT, UPDATE ON proyectos TO authenticated;
GRANT SELECT ON proyecto_estado_historial TO anon, authenticated;

-- ============================================================================
-- jornadas
-- ============================================================================
CREATE POLICY "Administrador y junta directiva leen todas las jornadas; el personal asignado lee las suyas"
  ON jornadas FOR SELECT TO authenticated
  USING (
    public.es_administrador()
    OR public.rol_actual() = 'junta directiva'
    OR public.participa_en_jornada(id)
  );

CREATE POLICY "Solo administrador o quien tiene jornadas.gestionar crea jornadas"
  ON jornadas FOR INSERT TO authenticated
  WITH CHECK (public.es_administrador() OR public.tiene_permiso('jornadas.gestionar'));

-- UPDATE cubre el cambio de estado del kanban (auditado por el trigger de 00012),
-- el orden_kanban y las fechas reales de 00036.
CREATE POLICY "Solo administrador o quien tiene jornadas.gestionar actualiza jornadas"
  ON jornadas FOR UPDATE TO authenticated
  USING (public.es_administrador() OR public.tiene_permiso('jornadas.gestionar'))
  WITH CHECK (public.es_administrador() OR public.tiene_permiso('jornadas.gestionar'));

-- ============================================================================
-- jornada_personal: solo administrador asigna y marca asistencia (00036); cada
-- persona lee su propia fila (necesario para saber a que jornada esta asignada).
-- ============================================================================
CREATE POLICY "Administrador y junta directiva leen asignaciones; cada quien lee la suya"
  ON jornada_personal FOR SELECT TO authenticated
  USING (
    public.es_administrador()
    OR public.rol_actual() = 'junta directiva'
    OR perfil_id = auth.uid()
  );

CREATE POLICY "Solo administrador asigna personal a jornadas"
  ON jornada_personal FOR INSERT TO authenticated
  WITH CHECK (public.es_administrador());

CREATE POLICY "Solo administrador actualiza asignaciones de jornadas"
  ON jornada_personal FOR UPDATE TO authenticated
  USING (public.es_administrador())
  WITH CHECK (public.es_administrador());

-- ============================================================================
-- jornada_estado_historial: solo lectura de administrador; escribe el trigger.
-- ============================================================================
CREATE POLICY "Solo administrador lee jornada_estado_historial"
  ON jornada_estado_historial FOR SELECT TO authenticated
  USING (public.es_administrador());

-- ============================================================================
-- proyectos
-- ============================================================================
CREATE POLICY "Administrador y junta directiva leen proyectos"
  ON proyectos FOR SELECT TO authenticated
  USING (public.es_administrador() OR public.rol_actual() = 'junta directiva');

CREATE POLICY "Solo administrador crea proyectos"
  ON proyectos FOR INSERT TO authenticated
  WITH CHECK (public.es_administrador());

-- UPDATE cubre el cambio de estado del kanban de proyectos (00029).
CREATE POLICY "Solo administrador actualiza proyectos"
  ON proyectos FOR UPDATE TO authenticated
  USING (public.es_administrador())
  WITH CHECK (public.es_administrador());

-- ============================================================================
-- proyecto_estado_historial: solo lectura de administrador; escribe el trigger.
-- ============================================================================
CREATE POLICY "Solo administrador lee proyecto_estado_historial"
  ON proyecto_estado_historial FOR SELECT TO authenticated
  USING (public.es_administrador());
