-- Ecopac Digital - Politica RLS de perfil_especialidad (issue #175)
--
-- perfil_especialidad tiene RLS habilitado desde la 00002_perfiles_especialidades.sql pero
-- ninguna migracion posterior le agrego GRANT ni politica: 00038_politicas_rls_perfiles_permisos.sql
-- cubre perfiles, permisos, rol_permiso, usuario_permiso y eventos_auditoria, pero no esta
-- tabla. Con RLS activo y cero politicas, la 00030_rls_denegacion_por_defecto.sql la deja en
-- denegar todo: hoy nadie lee perfil_especialidad via PostgREST, ni siquiera administrador.
-- Se corrige hacia adelante, como pide AGENTS.md para una migracion ya aplicada.
--
-- La politica espeja exactamente la de la tabla base perfiles (00038, "Administrador o el
-- propio perfil leen perfiles"): administrador o el propio perfil. Es la misma relacion de
-- confianza que ya existe para el resto de los datos de un perfil, y evita inventar una regla
-- nueva para un dato que ya vive junto al perfil (misma llave primaria perfil_id).
--
-- Solo GRANT a authenticated: anon no tiene acceso a ninguna tabla del esquema publico desde
-- la 00049_retirar_privilegios_anon.sql (issue #408), asi que no se repite el patron viejo de
-- conceder tambien a anon "por costumbre", que es justo lo que esa migracion prohibe.

GRANT SELECT ON perfil_especialidad TO authenticated;

-- Espeja la politica de SELECT de la tabla base perfiles (00038): administrador ve las
-- especialidades de cualquier perfil, cualquier otro perfil solo las suyas. Un authenticated
-- sin fila propia coincidente recibe cero filas sin error (RLS filtra filas, no las anuncia);
-- un rol sin sesion (anon) recibe un error de privilegio porque no tiene el GRANT de arriba.
-- La usan listarUsuarios() y listarCatalogoEspecialidades() de packages/shared/usuarios/api.js
-- (issue #175).
CREATE POLICY "Administrador o el propio perfil leen sus especialidades"
  ON perfil_especialidad FOR SELECT TO authenticated
  USING (public.es_administrador() OR perfil_id = auth.uid());
