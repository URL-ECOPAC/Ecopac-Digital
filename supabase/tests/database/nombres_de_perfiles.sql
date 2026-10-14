-- Pruebas de la 00161: nombres_de_perfiles pone nombre a las personas para toda persona activa,
-- sin datos de contacto, y sin abrir la tabla perfiles. Corre con: supabase test db
--
-- Ningun dato real: las personas son inventadas.

BEGIN;

SELECT plan(7);

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000016101', 'admin161@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000016102', 'voluntario161@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000016103', 'inactivo161@test.ecopac.local');

ALTER TABLE perfiles DISABLE TRIGGER USER;
UPDATE perfiles SET rol = 'administrador', nombres = 'Ana', apellidos = 'Prueba'
 WHERE id = '00000000-0000-0000-0000-000000016101';
UPDATE perfiles SET rol = 'voluntario general', nombres = 'Beto', apellidos = 'Prueba'
 WHERE id = '00000000-0000-0000-0000-000000016102';
UPDATE perfiles SET rol = 'voluntario general', activo = false
 WHERE id = '00000000-0000-0000-0000-000000016103';
ALTER TABLE perfiles ENABLE TRIGGER USER;

SELECT is(
  has_table_privilege('anon', 'public.nombres_de_perfiles', 'SELECT'), false,
  'anon no lee nombres_de_perfiles'
);

SELECT hasnt_column('public', 'nombres_de_perfiles', 'telefono', 'la vista no expone el telefono');
SELECT hasnt_column('public', 'nombres_de_perfiles', 'email', 'ni el correo');

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000016102';

SELECT is(
  (SELECT nombres || ' ' || apellidos FROM nombres_de_perfiles
    WHERE id = '00000000-0000-0000-0000-000000016101'),
  'Ana Prueba',
  'un voluntario ve el nombre de la administradora'
);

SELECT is(
  (SELECT activo FROM nombres_de_perfiles WHERE id = '00000000-0000-0000-0000-000000016103'),
  false,
  'y el de una persona inactiva, marcada como tal'
);

SELECT is(
  (SELECT count(*)::INT FROM perfiles WHERE id <> '00000000-0000-0000-0000-000000016102'),
  0,
  'la tabla perfiles le sigue cerrada: solo ve la suya'
);

SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000016103';

SELECT is(
  (SELECT count(*)::INT FROM nombres_de_perfiles),
  0,
  'una persona inactiva no ve ningun nombre'
);

SELECT * FROM finish();
ROLLBACK;
