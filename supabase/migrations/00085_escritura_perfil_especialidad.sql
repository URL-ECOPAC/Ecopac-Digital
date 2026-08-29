-- Ecopac Digital - Escritura de perfil_especialidad y lectura para roles consultivos (issue #405)
--
-- La 00058 (issue #175) le dio a perfil_especialidad su primera politica: GRANT SELECT y
-- "administrador o el propio perfil leen sus especialidades". Quedo pendiente lo que esa
-- migracion no cubria: los roles consultivos (junta directiva, socio fundador) solo veian su
-- propia fila, y no existia ningun GRANT ni politica de escritura, asi que nadie -ni siquiera
-- administrador- podia registrar o borrar una especialidad. Se corrige hacia adelante, como
-- pide AGENTS.md para una migracion ya aplicada.
--
-- No hay politica de UPDATE: la PK es (perfil_id, nombre_especialidad), sin columna id propia,
-- asi que cambiar una especialidad es borrar la fila vieja e insertar la nueva, no actualizar.
--
-- Solo GRANT a authenticated: anon no tiene acceso a ninguna tabla del esquema publico desde la
-- 00049 (issue #408).

-- Amplia la politica de SELECT de la 00058 para sumar es_consultivo(). Se usa ALTER POLICY y no
-- una politica nueva al lado: las politicas permisivas se combinan con OR (mismo criterio que
-- 00075/00080/00082/00083), asi que agregar una mas angosta no restringiria nada.
ALTER POLICY "Administrador o el propio perfil leen sus especialidades"
  ON perfil_especialidad
  USING (public.es_administrador() OR public.es_consultivo() OR perfil_id = auth.uid());

GRANT INSERT, DELETE ON perfil_especialidad TO authenticated;

-- Administrador registra la especialidad de cualquier perfil; cualquier perfil registra las
-- suyas. Los roles consultivos no escriben: solo tienen la lectura ampliada de arriba.
CREATE POLICY "Administrador o el propio perfil registran sus especialidades"
  ON perfil_especialidad FOR INSERT TO authenticated
  WITH CHECK (public.es_administrador() OR perfil_id = auth.uid());

-- Misma regla que INSERT: administrador borra cualquiera, cada perfil borra las suyas.
CREATE POLICY "Administrador o el propio perfil borran sus especialidades"
  ON perfil_especialidad FOR DELETE TO authenticated
  USING (public.es_administrador() OR perfil_id = auth.uid());
