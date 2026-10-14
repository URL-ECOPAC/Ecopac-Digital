-- Ecopac Digital - Conceder EXECUTE de fn_crear_usuario_administrativo a service_role
-- Issue #523.
--
-- 00074 revoco EXECUTE de PUBLIC sobre fn_crear_usuario_administrativo() a proposito -nadie mas
-- que administrador debia poder invocarla desde la aplicacion-, pero nunca se lo concedio de
-- vuelta a service_role. El comentario de esa migracion ya decia que la Edge Function
-- invitar-usuario la llamaria "con la llave de servicio", pero sin este GRANT ese llamado muere
-- con 42501 (permission denied for function): service_role no es superusuario ni el dueno de la
-- funcion, solo bypasea RLS -eso es un privilegio distinto de poder ejecutar la funcion-.
--
-- No se habia notado porque, hasta ahora, la funcion solo se ejecutaba a mano desde el SQL
-- editor del Dashboard, conectado como postgres (el dueno), que nunca pasa por este chequeo.
-- Se encontro probando en vivo la Edge Function de la issue #523 contra Postgres real.
GRANT EXECUTE ON FUNCTION fn_crear_usuario_administrativo(TEXT, TEXT, TEXT, rol_usuario)
  TO service_role;

-- Mismo defecto, un nivel mas abajo: service_role tampoco tenia SELECT ni UPDATE sobre
-- perfiles. rolbypassrls = true no sustituye al GRANT de tabla -son dos permisos
-- independientes-, y ninguna migracion anterior le habia concedido nada en perfiles: cada una
-- otorgaba explicito a anon/authenticated (00038) porque hasta ahora nada llamaba a Postgres
-- como service_role. invitar-usuario necesita completar perfiles.telefono -que
-- fn_crear_usuario_administrativo no recibe como parametro- y leer de vuelta el perfil creado
-- para devolverlo en la respuesta.
GRANT SELECT, UPDATE ON perfiles TO service_role;
