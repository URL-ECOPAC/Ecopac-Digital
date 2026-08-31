-- Normaliza a '' las columnas de token de auth.users que quedaron en NULL.
--
-- QUE ROMPE UN NULL EN ESAS COLUMNAS
--
-- GoTrue esta escrito en Go y lee confirmation_token, recovery_token, email_change y
-- email_change_token_new como texto no nulo. auth.users no les pone DEFAULT '', asi que un
-- INSERT escrito a mano que las omite las deja en NULL, y a partir de ahi cualquier busqueda
-- de usuario por correo aborta antes de mirar la contrasena:
--
--   error finding user: sql: Scan error on column index 3, name "confirmation_token":
--   converting NULL to string is unsupported
--
-- El cliente solo ve un 500 con {"code":500,"error_code":"unexpected_failure",
-- "msg":"Database error querying schema"}, que la app traduce a "Error de conexion con el
-- servidor". No es un problema de conexion ni de credenciales.
--
-- POR QUE HACE FALTA ESTA MIGRACION
--
-- La 00063 aprovisiona a admin@ecopac.org con un INSERT INTO auth.users que omite las cuatro
-- columnas. Donde haya entrado por esa rama, el administrador queda con las cuatro en NULL.
-- El agravante es que la 00063 crea al usuario SIN contrasena a proposito -para no versionar
-- una credencial- y docs/QUICKSTART.md senala "olvide mi contrasena" como el camino normal
-- para fijarsela en ecopac-dev y en produccion. Ese flujo empieza por el mismo find user, asi
-- que tambien devuelve 500: el administrador no puede entrar y tampoco arreglarlo por si
-- mismo. Sin esta migracion el criterio de la issue #111 no se cumple en ninguna base.
--
-- La 00063 ya esta aplicada y AGENTS.md prohibe editarla, asi que se corrige hacia adelante.
--
-- POR QUE UN BACKFILL Y NO UN TRIGGER NI UN DEFAULT
--
-- GoTrue rellena esas columnas por su cuenta en las altas que hace el (registro, invitacion,
-- panel de Supabase). El hueco solo lo abre el SQL escrito a mano de este repositorio, que son
-- dos sitios contados: la 00063, que esta migracion repara, y supabase/seed-demo.sql, que en
-- el mismo PR pasa a insertarlas explicitas. Poner un DEFAULT o un trigger sobre una tabla del
-- esquema auth seria tocar territorio que administra Supabase para cubrir un caso que ya no se
-- va a repetir; la guarda contra la regresion vive donde corresponde, en
-- supabase/tests/database/tokens_auth_users.sql.
--
-- Es idempotente y no-op donde no aplica: solo alcanza filas que tengan alguna columna en NULL.
-- En ecopac-dev, donde segun la cabecera de la 00063 el correo ya existia creado por GoTrue,
-- no deberia tocar ninguna fila.

UPDATE auth.users
SET confirmation_token     = COALESCE(confirmation_token, ''),
    recovery_token         = COALESCE(recovery_token, ''),
    email_change           = COALESCE(email_change, ''),
    email_change_token_new = COALESCE(email_change_token_new, '')
WHERE confirmation_token IS NULL
   OR recovery_token IS NULL
   OR email_change IS NULL
   OR email_change_token_new IS NULL;
