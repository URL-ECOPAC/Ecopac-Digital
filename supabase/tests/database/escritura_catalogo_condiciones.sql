-- Pruebas de la escritura del catalogo de condiciones cronicas (issue #850, migracion 00140).
-- Corre con: supabase test db
--
-- Cubre lo que agrega la 00140 y nada mas: quien inserta, quien mantiene, que nadie borra, y que
-- el indice normalizado impide el mismo nombre escrito de otra forma. La lectura del catalogo y
-- las politicas de padecimientos_cronicos ya las cubre politicas_rls_catalogos_y_seguimiento.sql.
--
-- LAS DOS FORMAS DE UNA NEGATIVA, QUE AQUI CONVIVEN
--
-- Un INSERT que no pasa el WITH CHECK **lanza** 42501, asi que se comprueba con throws_ok. Un
-- UPDATE que no pasa el USING no lanza: corre y afecta cero filas, asi que se comprueba con
-- is_empty sobre un RETURNING, y ademas leyendo el valor despues. Confundirlas es el error que la
-- cabecera de politicas_rls_catalogos_y_seguimiento.sql ya documenta.
--
-- Mismo patron de simulacion de rol que las suites vecinas: SET LOCAL ROLE authenticated +
-- SET LOCAL request.jwt.claim.sub. El setup corre como el rol dueno, exento de RLS.
--
-- Ningun dato real: las cinco cuentas son inventadas y los nombres de condicion son de prueba.
-- 'Hipertension' si es del catalogo que siembra la 00010, y se usa a proposito para el caso de
-- duplicado normalizado.

BEGIN;

SELECT plan(16);

-- ============================================================================
-- Setup: una cuenta por rol
-- ============================================================================
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000850001', 'admin850@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000850002', 'medico850@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000850003', 'voluntario850@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000850004', 'junta850@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000850005', 'socio850@test.ecopac.local');

ALTER TABLE perfiles DISABLE TRIGGER USER;
UPDATE perfiles SET rol = 'administrador'   WHERE id = '00000000-0000-0000-0000-000000850001';
UPDATE perfiles SET rol = 'medico'          WHERE id = '00000000-0000-0000-0000-000000850002';
UPDATE perfiles SET rol = 'junta directiva' WHERE id = '00000000-0000-0000-0000-000000850004';
UPDATE perfiles SET rol = 'socio fundador'  WHERE id = '00000000-0000-0000-0000-000000850005';
-- El voluntario se queda con el rol por defecto (voluntario general).
ALTER TABLE perfiles ENABLE TRIGGER USER;

SET LOCAL ROLE authenticated;

-- ============================================================================
-- Dar de alta: los tres roles que atienden
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000850001';

SELECT lives_ok(
  $$ INSERT INTO condiciones_cronicas (id, nombre)
     VALUES ('cc000000-0000-0000-0000-000000850001', 'Condicion de prueba de la administradora') $$,
  'POSITIVA INSERT: la administradora da de alta una condicion en el catalogo'
);

SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000850002';

SELECT lives_ok(
  $$ INSERT INTO condiciones_cronicas (id, nombre)
     VALUES ('cc000000-0000-0000-0000-000000850002', 'Condicion de prueba del medico') $$,
  'POSITIVA INSERT: el medico da de alta la condicion que le falto en jornada'
);

SELECT is(
  (SELECT es_vigente FROM condiciones_cronicas WHERE id = 'cc000000-0000-0000-0000-000000850002'),
  TRUE,
  'una condicion nueva nace vigente (DEFAULT TRUE de la 00115)'
);

SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000850003';

SELECT lives_ok(
  $$ INSERT INTO condiciones_cronicas (id, nombre)
     VALUES ('cc000000-0000-0000-0000-000000850003', 'Condicion de prueba del voluntario') $$,
  'POSITIVA INSERT: el voluntario general tambien atiende, y tambien da de alta'
);

-- ============================================================================
-- Los dos roles consultivos no escriben el catalogo (regla de la 00054: no tocan filas clinicas)
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000850004';

SELECT throws_ok(
  $$ INSERT INTO condiciones_cronicas (nombre) VALUES ('Condicion de la junta directiva') $$,
  '42501',
  NULL,
  'NEGATIVA INSERT: junta directiva no escribe el catalogo clinico'
);

SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000850005';

SELECT throws_ok(
  $$ INSERT INTO condiciones_cronicas (nombre) VALUES ('Condicion del socio fundador') $$,
  '42501',
  NULL,
  'NEGATIVA INSERT: socio fundador tampoco'
);

-- ============================================================================
-- Mantener el catalogo: renombrar y retirar, solo la administracion
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000850001';

SELECT isnt_empty(
  $$ UPDATE condiciones_cronicas SET nombre = 'Condicion del medico, corregida'
     WHERE id = 'cc000000-0000-0000-0000-000000850002' RETURNING id $$,
  'POSITIVA UPDATE: la administradora corrige el nombre de una condicion del catalogo'
);

SELECT isnt_empty(
  $$ UPDATE condiciones_cronicas SET es_vigente = FALSE
     WHERE id = 'cc000000-0000-0000-0000-000000850002' RETURNING id $$,
  'POSITIVA UPDATE: la administradora retira una condicion del catalogo'
);

SELECT is(
  (SELECT es_vigente FROM condiciones_cronicas WHERE id = 'cc000000-0000-0000-0000-000000850002'),
  FALSE,
  'y queda marcada como no vigente'
);

SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000850002';

SELECT is_empty(
  $$ UPDATE condiciones_cronicas SET es_vigente = TRUE
     WHERE id = 'cc000000-0000-0000-0000-000000850002' RETURNING id $$,
  'NEGATIVA UPDATE: el medico da de alta pero no mantiene el catalogo (el USING filtra: cero filas)'
);

SELECT is(
  (SELECT es_vigente FROM condiciones_cronicas WHERE id = 'cc000000-0000-0000-0000-000000850002'),
  FALSE,
  'y la condicion retirada sigue retirada'
);

SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000850003';

SELECT is_empty(
  $$ UPDATE condiciones_cronicas SET nombre = 'Nombre puesto por el voluntario'
     WHERE id = 'cc000000-0000-0000-0000-000000850002' RETURNING id $$,
  'NEGATIVA UPDATE: el voluntario tampoco renombra lo que ya citan otras fichas'
);

-- ============================================================================
-- Una condicion retirada sigue siendo legible: la politica de SELECT (00079) no mira es_vigente,
-- y las fichas que ya la citan tienen que poder mostrar su nombre.
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000850002';

SELECT isnt_empty(
  $$ SELECT 1 FROM condiciones_cronicas WHERE id = 'cc000000-0000-0000-0000-000000850002' $$,
  'POSITIVA SELECT: el medico sigue viendo la condicion retirada'
);

-- ============================================================================
-- Nadie borra: sin GRANT de DELETE, la sentencia muere antes de llegar a RLS
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000850001';

SELECT throws_ok(
  $$ DELETE FROM condiciones_cronicas WHERE id = 'cc000000-0000-0000-0000-000000850001' $$,
  '42501',
  NULL,
  'NEGATIVA DELETE: ni la administradora borra una condicion del catalogo (el retiro es logico)'
);

-- ============================================================================
-- El indice normalizado de la 00140: el mismo nombre escrito de otra forma no entra dos veces
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000850002';

-- 'Hipertension' la siembra la 00010. El UNIQUE de la columna cruda no la veria en minusculas.
SELECT throws_ok(
  $$ INSERT INTO condiciones_cronicas (nombre) VALUES ('hipertension') $$,
  '23505',
  NULL,
  'NEGATIVA duplicado: el mismo nombre en minusculas no entra dos veces'
);

SELECT throws_ok(
  $$ INSERT INTO condiciones_cronicas (nombre) VALUES ('  Hipertensión  ') $$,
  '23505',
  NULL,
  'NEGATIVA duplicado: ni con acento ni con espacios alrededor'
);

SELECT * FROM finish();

ROLLBACK;
