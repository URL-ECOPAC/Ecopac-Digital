-- Un perfil desactivado deja de tener privilegios en la base (issue #529).
--
-- EL AGUJERO
--
-- `perfiles.activo` era hasta ahora un control de CLIENTE. La aplicacion lo respetaba
-- -api/sesion.js cierra la sesion, hooks/useSesion.js la corta al restaurar-, pero lo hacia
-- despues de que GoTrue ya emitio un JWT valido. Quien llamara a /auth/v1/token directamente con
-- la llave anonima no pasaba por la aplicacion en ningun momento.
--
-- Y la base no lo frenaba: rol_actual() (00004) resolvia el rol con
-- `SELECT rol FROM perfiles WHERE id = auth.uid()`, sin mirar `activo`. De esa funcion cuelgan
-- 77 de las 104 politicas del esquema, casi todas via es_administrador().
--
-- Reproducido contra el stack local antes de escribir esto, con las cuentas demo:
--
--   1. voluntario.demo desactivado leyo la tabla pacientes.
--   2. voluntario.demo desactivado SE REACTIVO SOLO con un PATCH a su propia fila (HTTP 200).
--   3. admin.demo desactivado modifico una bodega.
--   4. voluntario2.demo desactivado leyo el catalogo de medicamentos.
--
-- Es la misma leccion de la issue #508: la aplicacion decide que dibujar, el servidor decide
-- quien pasa.
--
-- POR QUE NO BASTA CON TOCAR rol_actual()
--
-- Habia cinco vias distintas, y la segunda anulaba el arreglo entero:
--
--   a) rol_actual(), de la que cuelga casi todo.
--   b) La politica de UPDATE de perfiles (00038), que es `es_administrador() OR id = auth.uid()`
--      y NO pasa por rol_actual(). Sumada a que impedir_autodesactivacion() (00072) solo bloquea
--      PONER activo = FALSE, un desactivado podia volver a activarse solo. Sin cerrar esto, el
--      resto del arreglo se deshace en una peticion.
--   c) tiene_permiso(), cuya primera rama lee usuario_permiso por auth.uid() sin pasar por
--      rol_actual(). Gobierna las politicas de escritura de jornadas (00039) y gastos (00052).
--   d) participa_en_jornada(), que resuelve por jornada_personal. Hoy ninguna politica la usa
--      sola -siempre acompanada de rol_actual() = 'medico'-, pero eso es una coincidencia del
--      esquema actual: la primera que la use sin acompanarla reabre el agujero en silencio.
--   e) Las politicas de la 00062 sobre bodegas y proveedores, que consultan perfiles a mano.
--
-- POR QUE SE BORRAN Y SE RECREAN LAS POLITICAS
--
-- Las politicas permisivas de Postgres se combinan con OR: anadir una mas estrecha junto a una
-- abierta no restringe nada. Es la Divergencia 10 de docs/PERMISOS.md. Las migraciones que las
-- crearon estan aplicadas y no se editan; se borran desde aqui y se recrean, como hicieron la
-- 00042, la 00054 y la 00075.
--
-- LO QUE SE CONSERVA A PROPOSITO
--
-- La politica de SELECT de perfiles NO se toca. Su rama `id = auth.uid()` deja que un perfil
-- desactivado lea su propia fila, y eso hace falta: es como evaluarPerfilDeSesion()
-- (packages/shared/api/sesion.js) averigua que la cuenta esta desactivada para poder decirlo.
-- Sin ella la aplicacion responderia "permiso denegado", que no explica nada a quien lo lee.

-- ============================================================================
-- 1. Las tres funciones de autorizacion
-- ============================================================================
-- Conservan firma, STABLE, SECURITY DEFINER y search_path: solo ganan la condicion de actividad.
-- es_administrador() no hace falta tocarla: envuelve a rol_actual() y su COALESCE ya devuelve
-- FALSE -y no NULL- cuando esta no resuelve nada.

CREATE OR REPLACE FUNCTION rol_actual()
RETURNS rol_usuario
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT rol FROM public.perfiles WHERE id = auth.uid() AND activo;
$$;

COMMENT ON FUNCTION rol_actual() IS
  'Rol del perfil de la sesion, o NULL si no hay sesion o el perfil esta desactivado (issue #529). De esta funcion cuelga casi toda la matriz RLS.';

CREATE OR REPLACE FUNCTION tiene_permiso(p_codigo TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (
      -- La concesion individual tampoco sobrevive a la baja: sin este EXISTS, un perfil
      -- desactivado con un permiso puntual conservaba la escritura de jornadas y gastos.
      SELECT up.concedido
      FROM public.usuario_permiso up
      JOIN public.permisos p ON p.id = up.permiso_id
      WHERE up.perfil_id = auth.uid()
        AND p.clave = p_codigo
        AND EXISTS (
          SELECT 1 FROM public.perfiles pe WHERE pe.id = auth.uid() AND pe.activo
        )
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
    JOIN public.perfiles pe ON pe.id = jp.perfil_id
    WHERE jp.jornada_id = p_jornada_id AND jp.perfil_id = auth.uid() AND pe.activo
  );
$$;

-- ============================================================================
-- 2. La via de escape: reactivarse a si mismo
-- ============================================================================
DROP POLICY "Administrador o el propio perfil editan perfiles" ON perfiles;

CREATE POLICY "Administrador, o el propio perfil si sigue activo, editan perfiles"
  ON perfiles FOR UPDATE
  USING (public.es_administrador() OR (id = auth.uid() AND activo))
  WITH CHECK (public.es_administrador() OR (id = auth.uid() AND activo));

-- ============================================================================
-- 3. Bodegas y proveedores: se retiran las politicas duplicadas de la 00062
-- ============================================================================
-- La 00062 (que a su vez repetia la 00061) creo cuatro politicas sobre tablas que la 00034 ya
-- gobierna. Las de escritura preguntaban por el rol consultando perfiles a mano, sin `activo`, y
-- las de lectura duplicaban las de la 00034. Es la Divergencia 12 de docs/PERMISOS.md, que este
-- PR resuelve: al borrarlas, mandan las de la 00034, que si pasan por es_administrador() y por
-- tanto heredan el arreglo de arriba.

DROP POLICY IF EXISTS "Solo Administrador puede modificar bodegas" ON bodegas;
DROP POLICY IF EXISTS "Solo Administrador puede modificar proveedores" ON proveedores;
DROP POLICY IF EXISTS "Lectura de bodegas para usuarios autenticados" ON bodegas;
DROP POLICY IF EXISTS "Lectura de proveedores para usuarios autenticados" ON proveedores;

-- ============================================================================
-- 4. Las lecturas abiertas: de "cualquier sesion" a "sesion con perfil activo"
-- ============================================================================
-- Quince politicas de SELECT con USING (true) dejaban leer catalogos e inventario a cualquier
-- JWT valido, activo o no. El predicado nuevo, `rol_actual() IS NOT NULL`, es exactamente "hay
-- sesion y su perfil esta activo": no distingue rol, que es lo que estas politicas quieren.

-- Catalogo geografico (00006, 00008). Nota: el GRANT de lectura lo dio la 00073 (issue #179);
-- aqui solo se acota la politica, el GRANT no se toca.
DROP POLICY "Lectura publica departamentos" ON departamentos;
CREATE POLICY "Sesion activa lee departamentos"
  ON departamentos FOR SELECT USING (public.rol_actual() IS NOT NULL);

DROP POLICY "Lectura publica municipios" ON municipios;
CREATE POLICY "Sesion activa lee municipios"
  ON municipios FOR SELECT USING (public.rol_actual() IS NOT NULL);

DROP POLICY "Lectura publica comunidades" ON comunidades;
CREATE POLICY "Sesion activa lee comunidades"
  ON comunidades FOR SELECT USING (public.rol_actual() IS NOT NULL);

-- Catalogo clinico (00010).
DROP POLICY "Lectura publica condiciones_cronicas" ON condiciones_cronicas;
CREATE POLICY "Sesion activa lee condiciones_cronicas"
  ON condiciones_cronicas FOR SELECT USING (public.rol_actual() IS NOT NULL);

-- Inventario (00034). La de lotes_existencias no esta: esa tabla desaparecio con la 00047, que
-- unifico los modelos de inventario, y su politica se fue con ella.
DROP POLICY "Autenticados leen medicamentos" ON medicamentos;
CREATE POLICY "Sesion activa lee medicamentos"
  ON medicamentos FOR SELECT TO authenticated USING (public.rol_actual() IS NOT NULL);

DROP POLICY "Autenticados leen principios_activos" ON principios_activos;
CREATE POLICY "Sesion activa lee principios_activos"
  ON principios_activos FOR SELECT TO authenticated USING (public.rol_actual() IS NOT NULL);

DROP POLICY "Autenticados leen medicamento_principio" ON medicamento_principio;
CREATE POLICY "Sesion activa lee medicamento_principio"
  ON medicamento_principio FOR SELECT TO authenticated USING (public.rol_actual() IS NOT NULL);

DROP POLICY "Autenticados leen proveedores" ON proveedores;
CREATE POLICY "Sesion activa lee proveedores"
  ON proveedores FOR SELECT TO authenticated USING (public.rol_actual() IS NOT NULL);

DROP POLICY "Autenticados leen bodegas" ON bodegas;
CREATE POLICY "Sesion activa lee bodegas"
  ON bodegas FOR SELECT TO authenticated USING (public.rol_actual() IS NOT NULL);

DROP POLICY "Autenticados leen lotes" ON lotes;
CREATE POLICY "Sesion activa lee lotes"
  ON lotes FOR SELECT TO authenticated USING (public.rol_actual() IS NOT NULL);

DROP POLICY "Autenticados leen existencias" ON existencias;
CREATE POLICY "Sesion activa lee existencias"
  ON existencias FOR SELECT TO authenticated USING (public.rol_actual() IS NOT NULL);

DROP POLICY "Autenticados leen alertas_caducidad" ON alertas_caducidad;
CREATE POLICY "Sesion activa lee alertas_caducidad"
  ON alertas_caducidad FOR SELECT TO authenticated USING (public.rol_actual() IS NOT NULL);

DROP POLICY "Autenticados leen movimientos_inventario" ON movimientos_inventario;
CREATE POLICY "Sesion activa lee movimientos_inventario"
  ON movimientos_inventario FOR SELECT TO authenticated USING (public.rol_actual() IS NOT NULL);

-- Catalogo de permisos (00038). Son las definiciones, no las concesiones: quien puede que.
DROP POLICY "Autenticados leen permisos" ON permisos;
CREATE POLICY "Sesion activa lee permisos"
  ON permisos FOR SELECT TO authenticated USING (public.rol_actual() IS NOT NULL);

DROP POLICY "Autenticados leen rol_permiso" ON rol_permiso;
CREATE POLICY "Sesion activa lee rol_permiso"
  ON rol_permiso FOR SELECT TO authenticated USING (public.rol_actual() IS NOT NULL);
