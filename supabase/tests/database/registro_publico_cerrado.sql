-- Pruebas del cierre del registro publico de cuentas (issue #508, migracion 00073).
-- Corre con: supabase test db
--
-- QUE COMPRUEBA Y QUE NO
--
-- La regla vive en alta_de_cuenta_permitida(), que recibe el usuario de sesion como parametro en
-- vez de leerlo de la sesion. Esa forma es lo que hace posible esta suite: en el stack local el
-- rol `postgres` **no puede** hacer `SET SESSION AUTHORIZATION supabase_auth_admin` ni
-- `SET ROLE supabase_auth_admin` -las dos dan "permission denied"-, asi que una prueba pgTAP no
-- puede suplantar a GoTrue. Si la regla leyera `session_user` por dentro, esta suite solo podria
-- comprobar el caso que ya funciona y daria una sensacion de cobertura falsa.
--
-- Lo que si se comprueba aqui: la regla en sus cuatro combinaciones, que el trigger la usa, que
-- las altas de migracion siguen pasando, y que fn_crear_usuario_administrativo() deja la cuenta
-- utilizable.
--
-- Lo que NO se puede comprobar aqui, y donde si se comprobo: que un POST /auth/v1/signup real
-- se rechace. Eso atraviesa GoTrue y esta verificado a mano contra el stack local; queda en el
-- PR con su salida.
--
-- Ningun dato real: correos y nombres son inventados.

BEGIN;

SELECT plan(11);

-- ============================================================================
-- 1. La regla, en sus cuatro combinaciones
-- ============================================================================
-- El caso del agujero: GoTrue, sin marca.
SELECT ok(
  NOT alta_de_cuenta_permitida('supabase_auth_admin', '{"provider": "email", "providers": ["email"]}'::jsonb),
  'un alta de GoTrue sin marca administrativa se rechaza: es el registro publico'
);

-- La Admin API, que si puede escribir raw_app_meta_data.
SELECT ok(
  alta_de_cuenta_permitida('supabase_auth_admin', '{"provider": "email", "alta": "administrativa"}'::jsonb),
  'un alta de GoTrue con la marca administrativa pasa: es la Admin API'
);

-- Migraciones y seeds.
SELECT ok(
  alta_de_cuenta_permitida('postgres', '{"provider": "email"}'::jsonb),
  'un alta que no viene de GoTrue pasa: migraciones y seeds'
);

-- Un app_meta ausente no debe colarse por un COALESCE mal puesto.
SELECT ok(
  NOT alta_de_cuenta_permitida('supabase_auth_admin', NULL),
  'un alta de GoTrue sin raw_app_meta_data se rechaza'
);

-- Y la marca tiene que ser exactamente esa: un valor parecido no vale.
SELECT ok(
  NOT alta_de_cuenta_permitida('supabase_auth_admin', '{"alta": "publica"}'::jsonb),
  'una marca con otro valor no abre la puerta'
);

-- ============================================================================
-- 2. El trigger sigue creando el perfil cuando el alta es legitima
-- ============================================================================
-- Este INSERT corre como el rol dueno, o sea que es el caso "no viene de GoTrue". Es tambien el
-- patron que usan los fixtures de las otras suites: si esta prueba se rompe, se rompen aquellas.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000508001', 'alta508@test.ecopac.local');

SELECT is(
  (SELECT count(*)::int FROM perfiles WHERE id = '00000000-0000-0000-0000-000000508001'),
  1,
  'el trigger de la 00002 sigue creando el perfil de un alta legitima'
);

SELECT is(
  (SELECT rol::text FROM perfiles WHERE id = '00000000-0000-0000-0000-000000508001'),
  'voluntario general',
  'y sigue dejando el rol por defecto, que es lo que la 00073 no cambia'
);

-- ============================================================================
-- 3. El camino de alta administrativa
-- ============================================================================
SELECT lives_ok(
  $$ SELECT fn_crear_usuario_administrativo('medica508@test.ecopac.local', 'Nombre', 'Inventado', 'medico') $$,
  'fn_crear_usuario_administrativo() da de alta sin que el trigger la rechace'
);

SELECT is(
  (SELECT rol::text FROM perfiles WHERE email = 'medica508@test.ecopac.local'),
  'medico',
  'la cuenta nueva queda con el rol que se pidio, no con el de por defecto'
);

-- La leccion de la issue #496: si estas cuatro columnas quedan en NULL, GoTrue falla al buscar
-- CUALQUIER usuario por correo y se cae el login de todo el mundo, no solo el de esta cuenta.
SELECT is(
  (
    SELECT count(*)::int FROM auth.users
    WHERE email = 'medica508@test.ecopac.local'
      AND confirmation_token IS NOT NULL
      AND recovery_token IS NOT NULL
      AND email_change IS NOT NULL
      AND email_change_token_new IS NOT NULL
  ),
  1,
  'la cuenta nueva no deja en NULL las columnas de token que GoTrue lee como texto'
);

-- Sin fila en auth.identities el usuario existe pero no puede autenticarse por correo.
SELECT is(
  (
    SELECT count(*)::int FROM auth.identities i
    JOIN auth.users u ON u.id = i.user_id
    WHERE u.email = 'medica508@test.ecopac.local' AND i.provider = 'email'
  ),
  1,
  'la cuenta nueva tiene su identidad de correo, sin la cual no podria iniciar sesion'
);

SELECT * FROM finish();
ROLLBACK;
