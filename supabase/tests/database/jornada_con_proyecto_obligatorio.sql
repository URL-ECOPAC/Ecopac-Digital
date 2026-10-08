-- Pruebas de la 00169: toda jornada pertenece a un proyecto. Corre con:
-- supabase test db
--
-- Mismo patron que proyecto_cancelado_solo_lectura.sql: fixtures como postgres y despues
-- SET LOCAL ROLE authenticated + request.jwt.claim.sub para actuar como la administradora, que por
-- RLS SI puede escribir jornadas. Lo que la frena aqui es la falta de proyecto, no el rol.

BEGIN;

SELECT plan(10);

-- Desde la 00178 toda jornada nueva lleva una bodega movil. Estas pruebas no tratan de bodegas:
-- sus jornadas reciben una de prueba como DEFAULT de la columna, que el ROLLBACK del final deshace.
INSERT INTO bodegas (id, nombre, es_movil) VALUES
  ('5b000000-0000-0000-0000-000000000178', 'Bodega movil de prueba 00178', TRUE);
ALTER TABLE jornadas ALTER COLUMN botiquin_bodega_id SET DEFAULT '5b000000-0000-0000-0000-000000000178';

-- ============================================================================
-- Setup
-- ============================================================================
INSERT INTO comunidades (id, municipio_id, nombre) VALUES
  ('10000000-0000-0000-0000-000000001691', 101, 'Comunidad de prueba 1691');

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000016911', 'admin1691@test.ecopac.local');

ALTER TABLE perfiles DISABLE TRIGGER USER;
UPDATE perfiles SET rol = 'administrador' WHERE id = '00000000-0000-0000-0000-000000016911';
ALTER TABLE perfiles ENABLE TRIGGER USER;

INSERT INTO proyectos (id, nombre) VALUES
  ('50000000-0000-0000-0000-000000001691', 'Proyecto 1691'),
  ('50000000-0000-0000-0000-000000001692', 'Proyecto 1692');

INSERT INTO jornadas (id, nombre, fecha, comunidad_id, responsable_id, proyecto_id) VALUES
  ('40000000-0000-0000-0000-000000001691', 'Jornada con proyecto 1691', CURRENT_DATE + 30,
   '10000000-0000-0000-0000-000000001691', '00000000-0000-0000-0000-000000016911',
   '50000000-0000-0000-0000-000000001691');

-- Una jornada anterior a la 00169, que quedo sin proyecto. Se crea saltando el trigger porque es
-- justo lo que ya no se puede crear; lo que se prueba es que siga funcionando.
ALTER TABLE jornadas DISABLE TRIGGER trg_jornadas_proyecto_obligatorio_al_crear;
INSERT INTO jornadas (id, nombre, fecha, comunidad_id, responsable_id, proyecto_id) VALUES
  ('40000000-0000-0000-0000-000000001692', 'Jornada antigua 1692', CURRENT_DATE + 30,
   '10000000-0000-0000-0000-000000001691', '00000000-0000-0000-0000-000000016911', NULL);
ALTER TABLE jornadas ENABLE TRIGGER trg_jornadas_proyecto_obligatorio_al_crear;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000016911';

-- ============================================================================
-- Crear
-- ============================================================================
SELECT throws_ok(
  $$ INSERT INTO jornadas (nombre, fecha, comunidad_id, responsable_id)
     VALUES ('Sin proyecto 1691', CURRENT_DATE + 40, '10000000-0000-0000-0000-000000001691',
             '00000000-0000-0000-0000-000000016911') $$,
  '23502', NULL,
  'no se crea una jornada sin proyecto'
);

SELECT lives_ok(
  $$ INSERT INTO jornadas (nombre, fecha, comunidad_id, responsable_id, proyecto_id)
     VALUES ('Con proyecto 1691', CURRENT_DATE + 40, '10000000-0000-0000-0000-000000001691',
             '00000000-0000-0000-0000-000000016911', '50000000-0000-0000-0000-000000001691') $$,
  'con proyecto se crea'
);

-- ============================================================================
-- Cambiar de proyecto
-- ============================================================================
SELECT throws_ok(
  $$ UPDATE jornadas SET proyecto_id = NULL WHERE id = '40000000-0000-0000-0000-000000001691' $$,
  '23502', NULL,
  'a una jornada no se le quita el proyecto'
);

SELECT lives_ok(
  $$ UPDATE jornadas SET proyecto_id = '50000000-0000-0000-0000-000000001692'
      WHERE id = '40000000-0000-0000-0000-000000001691' $$,
  'una jornada si se pasa a otro proyecto'
);

-- ============================================================================
-- Jornadas anteriores a la 00169
-- ============================================================================
SELECT lives_ok(
  $$ UPDATE jornadas SET estado = 'en curso' WHERE id = '40000000-0000-0000-0000-000000001692' $$,
  'una jornada antigua sin proyecto se sigue moviendo en el kanban'
);

SELECT lives_ok(
  $$ UPDATE jornadas SET nombre = 'Jornada antigua renombrada', proyecto_id = NULL
      WHERE id = '40000000-0000-0000-0000-000000001692' $$,
  'y se sigue editando aunque el UPDATE mande el mismo proyecto_id NULL'
);

SELECT lives_ok(
  $$ UPDATE jornadas SET proyecto_id = '50000000-0000-0000-0000-000000001691'
      WHERE id = '40000000-0000-0000-0000-000000001692' $$,
  'y se le asigna un proyecto'
);

-- ============================================================================
-- Borrar un proyecto con jornadas
-- ============================================================================
RESET ROLE;

SELECT throws_ok(
  $$ DELETE FROM proyectos WHERE id = '50000000-0000-0000-0000-000000001692' $$,
  '23503', NULL,
  'un proyecto con jornadas no se borra: las dejaria sin proyecto'
);

SELECT is(
  (SELECT confdeltype FROM pg_constraint WHERE conname = 'jornadas_proyecto_id_fkey')::text,
  'r',
  'la llave foranea de jornadas.proyecto_id es ON DELETE RESTRICT'
);

-- ============================================================================
-- Privilegios
-- ============================================================================
SELECT is(
  has_function_privilege('authenticated', 'public.fn_jornada_exige_proyecto()', 'EXECUTE'),
  false,
  'nadie llama directo a la funcion del trigger'
);

SELECT * FROM finish();
ROLLBACK;
