-- Pruebas de la 00182: catalogo de areas de atencion, areas del paciente, registro con areas y
-- busqueda por area (issue #927, seccion 1). Corre con: supabase test db
--
-- Ningun dato real: las personas, la comunidad y los pacientes son inventados.

BEGIN;

SELECT plan(20);

-- ============================================================================
-- Setup
-- ============================================================================
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000182001', 'admin182@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000182002', 'medico182@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000182003', 'voluntario182@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000182004', 'otrovoluntario182@test.ecopac.local');

ALTER TABLE perfiles DISABLE TRIGGER USER;
UPDATE perfiles SET rol = 'administrador' WHERE id = '00000000-0000-0000-0000-000000182001';
UPDATE perfiles SET rol = 'medico' WHERE id = '00000000-0000-0000-0000-000000182002';
UPDATE perfiles SET rol = 'voluntario general'
WHERE id IN ('00000000-0000-0000-0000-000000182003', '00000000-0000-0000-0000-000000182004');
ALTER TABLE perfiles ENABLE TRIGGER USER;

INSERT INTO comunidades (id, municipio_id, nombre) VALUES
  ('10000000-0000-0000-0000-000000182001', 101, 'Comunidad de prueba 182');

-- El voluntario general edita pacientes por rol desde la 00148. Para probar la regla de "quien lo
-- registro", aqui se le quita ese permiso; el ROLLBACK del final lo devuelve.
DELETE FROM rol_permiso
WHERE rol = 'voluntario general'
  AND permiso_id = (SELECT id FROM permisos WHERE clave = 'pacientes.editar');

CREATE TEMP VIEW areas_182 AS
SELECT
  (SELECT id FROM areas_atencion WHERE nombre = 'Odontología') AS odontologia,
  (SELECT id FROM areas_atencion WHERE nombre = 'Psicología') AS psicologia,
  (SELECT id FROM areas_atencion WHERE nombre = 'Medicina General') AS medicina;
GRANT SELECT ON areas_182 TO authenticated;

-- ============================================================================
-- 1. El catalogo
-- ============================================================================
SELECT is(
  (SELECT count(*)::int FROM areas_atencion
    WHERE nombre IN ('Odontología', 'Psicología', 'Medicina General') AND es_vigente),
  3,
  'la migracion siembra Odontologia, Psicologia y Medicina General'
);

SELECT throws_ok(
  $$ INSERT INTO areas_atencion (nombre) VALUES ('  psicologia ') $$,
  '23505', NULL,
  'el nombre es unico sin distinguir mayusculas, acentos ni espacios'
);

SELECT is(
  has_table_privilege('anon', 'public.areas_atencion', 'SELECT'),
  false,
  'anon no lee areas_atencion'
);

SET LOCAL ROLE authenticated;

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000182002', TRUE);

SELECT ok(
  (SELECT count(*) FROM areas_atencion) >= 3,
  'el medico lee el catalogo'
);

SELECT throws_ok(
  $$ INSERT INTO areas_atencion (nombre) VALUES ('Nutricion 182') $$,
  '42501', NULL,
  'el medico no crea areas'
);

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000182001', TRUE);

SELECT lives_ok(
  $$ INSERT INTO areas_atencion (nombre, descripcion) VALUES ('Nutricion 182', 'Prueba') $$,
  'la administradora crea un area'
);

SELECT lives_ok(
  $$ UPDATE areas_atencion SET nombre = 'Nutricion infantil 182' WHERE nombre = 'Nutricion 182' $$,
  'la administradora la edita'
);

SELECT lives_ok(
  $$ UPDATE areas_atencion SET es_vigente = FALSE WHERE nombre = 'Nutricion infantil 182' $$,
  'la administradora la retira'
);

-- ============================================================================
-- 2. Registrar con areas
-- ============================================================================
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000182003', TRUE);

CREATE TEMP TABLE registrado_182 AS
SELECT id FROM fn_registrar_paciente(
  'Ana', 'Prueba182', DATE '1990-01-01', 'Femenino', '10000000-0000-0000-0000-000000182001',
  NULL, 'espanol', NULL, NULL, NULL, NULL,
  ARRAY[(SELECT odontologia FROM areas_182), (SELECT psicologia FROM areas_182),
        (SELECT odontologia FROM areas_182)]
);

SELECT is(
  (SELECT count(*)::int FROM paciente_area WHERE paciente_id = (SELECT id FROM registrado_182)),
  2,
  'el voluntario, sin permiso de editar pacientes, lo registra con dos areas en la misma llamada (un id repetido no falla)'
);

SELECT is(
  (SELECT registrado_por FROM pacientes WHERE id = (SELECT id FROM registrado_182)),
  '00000000-0000-0000-0000-000000182003'::uuid,
  'registrado_por queda con quien lo registro'
);

-- ============================================================================
-- 3. Asignar y quitar areas despues
-- ============================================================================
SELECT lives_ok(
  $$ INSERT INTO paciente_area (paciente_id, area_id)
     VALUES ((SELECT id FROM registrado_182), (SELECT medicina FROM areas_182)) $$,
  'quien lo registro le agrega un area despues'
);

SELECT lives_ok(
  $$ DELETE FROM paciente_area
     WHERE paciente_id = (SELECT id FROM registrado_182) AND area_id = (SELECT psicologia FROM areas_182) $$,
  'y le quita otra'
);

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000182004', TRUE);

SELECT throws_ok(
  $$ INSERT INTO paciente_area (paciente_id, area_id)
     VALUES ((SELECT id FROM registrado_182), (SELECT psicologia FROM areas_182)) $$,
  '42501', NULL,
  'otro voluntario sin permiso de editar pacientes, que no lo registro, no le asigna areas'
);

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000182002', TRUE);

SELECT lives_ok(
  $$ INSERT INTO paciente_area (paciente_id, area_id)
     VALUES ((SELECT id FROM registrado_182), (SELECT psicologia FROM areas_182)) $$,
  'el medico, que edita pacientes, si le asigna areas aunque no lo registro'
);

SELECT throws_ok(
  $$ INSERT INTO paciente_area (paciente_id, area_id)
     VALUES ((SELECT id FROM registrado_182),
             (SELECT id FROM areas_atencion WHERE nombre = 'Nutricion infantil 182')) $$,
  '23514', NULL,
  'un area retirada no se asigna'
);

-- ============================================================================
-- 4. Buscar por area
-- ============================================================================
SELECT ok(
  EXISTS (
    SELECT 1 FROM fn_buscar_pacientes(NULL, '10000000-0000-0000-0000-000000182001', 1, 100,
      NULL, NULL, NULL, NULL, (SELECT odontologia FROM areas_182))
    WHERE paciente_id = (SELECT id FROM registrado_182)
  ),
  'filtrar por Odontologia trae al paciente'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM fn_buscar_pacientes(NULL, NULL, 1, 100, NULL, NULL, NULL, NULL,
      (SELECT id FROM areas_atencion WHERE nombre = 'Nutricion infantil 182'))
  ),
  'un area sin pacientes no trae a nadie'
);

RESET ROLE;
INSERT INTO pacientes (id, nombres, apellidos, fecha_nacimiento, sexo, comunidad_id, idioma)
VALUES ('20000000-0000-0000-0000-000000182002', 'Beto', 'Sinarea182', '1985-05-05', 'Masculino',
        '10000000-0000-0000-0000-000000182001', 'espanol');
SET LOCAL ROLE authenticated;

SELECT ok(
  EXISTS (
    SELECT 1 FROM fn_buscar_pacientes(NULL, '10000000-0000-0000-0000-000000182001', 1, 100)
    WHERE paciente_id = '20000000-0000-0000-0000-000000182002'
  ),
  'sin filtrar por area, un paciente sin area sigue saliendo'
);

RESET ROLE;

-- ============================================================================
-- 5. Auditoria y privilegios
-- ============================================================================
SELECT ok(
  EXISTS (
    SELECT 1 FROM eventos_auditoria
    WHERE tabla_afectada = 'paciente_area' AND fila_id = (SELECT id FROM registrado_182)
  ),
  'asignar un area queda en la bitacora, con el paciente como fila'
);

SELECT is(
  has_function_privilege('anon',
    'public.fn_buscar_pacientes(text, uuid, integer, integer, uuid, text, integer, integer, uuid)',
    'EXECUTE'),
  false,
  'anon no ejecuta fn_buscar_pacientes'
);

SELECT * FROM finish();
ROLLBACK;
