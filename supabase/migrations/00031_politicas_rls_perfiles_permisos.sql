-- Ecopac Digital - Politicas RLS de perfiles, permisos y auditoria
-- Implementa la matriz de roles del entregable Semana 6 para perfiles, permisos,
-- rol_permiso, usuario_permiso y eventos_auditoria. eventos_auditoria ya tiene su
-- politica desde la 00026 ("Solo administrador lee eventos_auditoria", sin politicas
-- de escritura): no se toca aqui, se deja como referencia en los comentarios.

-- ============================================================================
-- pgTAP: extension de pruebas
-- ============================================================================
-- Solo para supabase/tests/database/*.sql (supabase test db). No se usa en tiempo de
-- ejecucion de la aplicacion.
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

-- ============================================================================
-- perfiles
-- ============================================================================
-- El rol no se cambia por RLS porque una politica no puede comparar el valor viejo
-- contra el nuevo: eso es trabajo de un trigger. Se permite el UPDATE del resto de las
-- columnas de la fila propia, pero si NEW.rol difiere de OLD.rol y quien ejecuta el
-- UPDATE no es administrador, la operacion falla.
CREATE OR REPLACE FUNCTION impedir_cambio_de_rol_propio()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.rol IS DISTINCT FROM OLD.rol AND NOT public.es_administrador() THEN
    RAISE EXCEPTION 'Solo un administrador puede cambiar el rol de un perfil.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION impedir_cambio_de_rol_propio() IS
  'Bloquea que un perfil se auto-asigne o auto-revoque un rol distinto al que tiene. Solo administrador puede cambiar rol.';

CREATE TRIGGER trg_perfiles_impedir_cambio_de_rol_propio
BEFORE UPDATE ON perfiles
FOR EACH ROW
EXECUTE FUNCTION impedir_cambio_de_rol_propio();

-- Lectura de la TABLA BASE: solo administrador y el propio perfil. Junta directiva NO
-- esta aqui a proposito: si tuviera acceso de fila a perfiles, podria saltarse la
-- vista de abajo y leer telefono/email en crudo con un SELECT directo, porque RLS
-- filtra filas, no columnas. Junta directiva lee exclusivamente via
-- perfiles_directorio.
CREATE POLICY "Administrador o el propio perfil leen perfiles"
  ON perfiles FOR SELECT
  USING (public.es_administrador() OR id = auth.uid());

-- Creacion manual de perfiles (el alta normal ocurre via el trigger
-- crear_perfil_nuevo_usuario de la 00002, que corre SECURITY DEFINER y no pasa por
-- esta politica). Esta es para cuando un administrador da de alta un perfil a mano.
CREATE POLICY "Solo administrador crea perfiles"
  ON perfiles FOR INSERT
  WITH CHECK (public.es_administrador());

-- Edicion: administrador edita cualquier perfil; cualquier perfil edita el suyo (sus
-- datos de contacto y demas columnas, salvo el rol, que bloquea el trigger de arriba).
-- "Desactivar" un perfil es un UPDATE de activo a false, por eso no hace falta una
-- politica de DELETE: la 00030 ya deniega el borrado por defecto.
CREATE POLICY "Administrador o el propio perfil editan perfiles"
  ON perfiles FOR UPDATE
  USING (public.es_administrador() OR id = auth.uid())
  WITH CHECK (public.es_administrador() OR id = auth.uid());

-- Vista de columnas no sensibles de perfiles, para junta directiva. RLS filtra filas,
-- no columnas, asi que enmascarar telefono/email para un rol necesita una vista con su
-- propia logica de filas y columnas. A proposito SIN security_invoker: la vista corre
-- con los privilegios de quien la crea (el rol de la migracion, que es dueno de
-- perfiles y por lo tanto exento de su RLS, igual que documenta la 00026 para
-- eventos_auditoria), y es el WHERE de aqui abajo el que decide que filas se devuelven
-- para cada quien. auth.uid()/rol_actual()/es_administrador() siguen identificando
-- correctamente a quien consulta: no dependen de RLS, dependen del JWT de la sesion.
CREATE VIEW perfiles_directorio AS
SELECT
  id,
  nombres,
  apellidos,
  rol,
  activo,
  fecha_ingreso,
  created_at,
  updated_at,
  CASE WHEN public.es_administrador() OR id = auth.uid() THEN telefono END AS telefono,
  CASE WHEN public.es_administrador() OR id = auth.uid() THEN email END AS email
FROM perfiles
WHERE public.es_administrador() OR public.rol_actual() = 'junta directiva' OR id = auth.uid();

COMMENT ON VIEW perfiles_directorio IS
  'Perfiles sin datos de contacto sensibles (telefono, email) salvo para administrador y para el propio perfil. Junta directiva lee perfiles exclusivamente por aqui: la politica de SELECT sobre la tabla base perfiles no le da acceso de fila, para que no pueda saltarse la mascara con un SELECT directo a la tabla.';

GRANT SELECT ON perfiles_directorio TO authenticated;

-- ============================================================================
-- permisos y rol_permiso: catalogos de solo lectura para cualquier autenticado
-- ============================================================================
-- Son catalogos (que permisos existen, que permisos trae cada rol por defecto), no
-- datos de una persona: igual que departamentos/municipios/comunidades, lectura
-- publica para autenticados y sin politicas de escritura todavia (las gestiona un
-- administrador directamente hasta que exista una pantalla dedicada).
CREATE POLICY "Autenticados leen permisos"
  ON permisos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Autenticados leen rol_permiso"
  ON rol_permiso FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- usuario_permiso: concesiones puntuales, mas sensible que el catalogo
-- ============================================================================
-- A diferencia de permisos/rol_permiso, cada fila aqui identifica a una persona y el
-- motivo de una excepcion de acceso: solo administrador y el propio perfil la leen, y
-- solo administrador la escribe (otorgar o revocar un permiso puntual es una decision
-- administrativa, ver usuarios.gestionar_permisos sembrado en la 00003).
CREATE POLICY "Administrador o el propio perfil leen usuario_permiso"
  ON usuario_permiso FOR SELECT
  USING (public.es_administrador() OR perfil_id = auth.uid());

CREATE POLICY "Solo administrador escribe usuario_permiso"
  ON usuario_permiso FOR INSERT
  WITH CHECK (public.es_administrador());

CREATE POLICY "Solo administrador actualiza usuario_permiso"
  ON usuario_permiso FOR UPDATE
  USING (public.es_administrador())
  WITH CHECK (public.es_administrador());

CREATE POLICY "Solo administrador borra usuario_permiso"
  ON usuario_permiso FOR DELETE
  USING (public.es_administrador());
