-- Pruebas de las columnas de token de auth.users (migracion 00069).
-- Corre con: supabase test db
--
-- GoTrue lee confirmation_token, recovery_token, email_change y email_change_token_new como
-- texto no nulo. auth.users no les pone DEFAULT '', asi que un INSERT escrito a mano que las
-- omite las deja en NULL y toda busqueda de usuario por correo aborta con
-- "converting NULL to string is unsupported": el login y "olvide mi contrasena" devuelven un
-- 500 y la app lo muestra como "Error de conexion con el servidor".
--
-- El bug estuvo vivo en los dos INSERT INTO auth.users escritos a mano del repositorio -la
-- 00063 y supabase/seed-demo.sql- sin que nada lo detectara, porque una migracion aplica sin
-- quejarse y el fallo solo aparece al intentar iniciar sesion. Esta suite es la guarda: mira
-- el estado real de la base tras reconstruirla desde cero, asi que un tercer INSERT que vuelva
-- a omitir las columnas pone el PR en rojo.
--
-- No usa fixtures ni impersonacion: lee las filas que dejaron las migraciones y los seeds.
--
-- La invariante que se comprueba es NOT NULL y no "cadena vacia": '' es solo el valor de
-- reposo. En cuanto alguien pide un correo de recuperacion, GoTrue escribe un token de verdad
-- en recovery_token, y esa fila sigue siendo perfectamente sana. Exigir '' pondria la suite en
-- rojo por usar la aplicacion.

BEGIN;

SELECT plan(3);

-- ============================================================================
-- 1. Ninguna fila con NULL, venga de donde venga
-- ============================================================================
SELECT is(
  (
    SELECT count(*)::int
    FROM auth.users
    WHERE confirmation_token IS NULL
       OR recovery_token IS NULL
       OR email_change IS NULL
       OR email_change_token_new IS NULL
  ),
  0,
  'ninguna fila de auth.users deja en NULL las columnas de token que GoTrue lee como texto'
);

-- ============================================================================
-- 2. Las siete cuentas de seed-demo.sql
-- ============================================================================
SELECT is(
  (
    SELECT count(*)::int
    FROM auth.users
    WHERE email LIKE '%.demo@ecopac.test'
      AND confirmation_token IS NOT NULL
      AND recovery_token IS NOT NULL
      AND email_change IS NOT NULL
      AND email_change_token_new IS NOT NULL
  ),
  7,
  'las siete cuentas demo tienen las cuatro columnas rellenas y pueden iniciar sesion'
);

-- ============================================================================
-- 3. El administrador que aprovisiona la 00063
-- ============================================================================
-- Es el caso que llega a ecopac-dev y a produccion: los seeds no corren en db push, asi que
-- esta es la unica fila afectada fuera de local. Ademas nace sin contrasena a proposito, de
-- modo que si su recovery_token queda en NULL no puede entrar NI usar el flujo de
-- recuperacion con el que docs/QUICKSTART.md espera que se le fije una.
SELECT is(
  (
    SELECT count(*)::int
    FROM auth.users
    WHERE email = 'admin@ecopac.org'
      AND confirmation_token IS NOT NULL
      AND recovery_token IS NOT NULL
      AND email_change IS NOT NULL
      AND email_change_token_new IS NOT NULL
  ),
  1,
  'el primer administrador queda con las columnas de token normalizadas'
);

SELECT * FROM finish();
ROLLBACK;
