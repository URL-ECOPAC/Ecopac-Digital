-- Ecopac Digital - Funciones auxiliares de autorizacion para RLS
-- Centralizan la logica que de otro modo repetiria cada politica RLS del sistema.

-- Devuelve el rol del perfil autenticado, o NULL si no hay sesion. SECURITY DEFINER
-- porque perfiles tiene RLS habilitado y esta funcion es la base de las politicas RLS
-- de todas las tablas: si dependiera de una politica sobre perfiles se generaria
-- recursion.
CREATE OR REPLACE FUNCTION rol_actual()
RETURNS rol_usuario
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT rol FROM public.perfiles WHERE id = auth.uid();
$$;

-- Indica si el usuario autenticado es administrador. No necesita SECURITY DEFINER
-- propio porque delega la lectura de perfiles en rol_actual().
CREATE OR REPLACE FUNCTION es_administrador()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(public.rol_actual() = 'administrador', FALSE);
$$;

-- Indica si el usuario autenticado tiene el permiso dado: primero revisa si hay una
-- concesion o revocacion puntual en usuario_permiso y, si no existe, cae al permiso
-- por defecto de su rol en rol_permiso.
CREATE OR REPLACE FUNCTION tiene_permiso(p_codigo TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (
      SELECT up.concedido
      FROM public.usuario_permiso up
      JOIN public.permisos p ON p.id = up.permiso_id
      WHERE up.perfil_id = auth.uid() AND p.clave = p_codigo
    ),
    (
      SELECT TRUE
      FROM public.rol_permiso rp
      JOIN public.permisos p ON p.id = rp.permiso_id
      WHERE rp.rol = public.rol_actual() AND p.clave = p_codigo
    ),
    FALSE
  );
$$;

-- Indica si el usuario autenticado participa en la jornada dada. jornada_personal se
-- crea en una migracion posterior de jornadas; check_function_bodies se desactiva
-- puntualmente para permitir esta referencia adelantada (el mismo patron que usa
-- pg_dump para dependencias circulares/adelantadas), y la referencia se resuelve
-- normalmente en la primera llamada, cuando la tabla ya existe.
SET check_function_bodies = off;

CREATE OR REPLACE FUNCTION participa_en_jornada(p_jornada_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.jornada_personal jp
    WHERE jp.jornada_id = p_jornada_id AND jp.perfil_id = auth.uid()
  );
$$;

SET check_function_bodies = on;
