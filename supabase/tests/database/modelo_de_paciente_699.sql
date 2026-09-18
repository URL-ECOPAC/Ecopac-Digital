-- Pruebas de las dos reglas que la 00132 le pone a pacientes (issue #699).
-- Corre con: supabase test db
--
--   1. sexo es el enum sexo_paciente: la inicial y las variantes de caja dejan de entrar.
--   2. dpi tiene un CHECK de 13 digitos, y sigue siendo opcional.
--
-- POR QUE HACEN FALTA, SI LAS DOS SON RESTRICCIONES DE LA BASE
--
-- Porque son justamente el tipo de regla que se pierde en una migracion futura sin que nada
-- avise. La 00095 documenta el precio de no tenerlas: el reporte de pacientes atendidos daba cero
-- hombres y cero mujeres para cualquier consulta, porque comparaba contra la inicial y la columna
-- guardaba la palabra completa, y nadie se entero hasta que alguien miro el reporte con datos.
--
-- Se prueban ademas las dos funciones que la 00132 recrea por el cambio de tipo: si el cast del
-- INSERT o el de la salida faltaran, fn_registrar_paciente y fn_buscar_pacientes fallarian en
-- tiempo de ejecucion y ninguna prueba de JavaScript lo veria -- el doble del cliente de Supabase
-- acepta cualquier consulta.
--
-- Ningun dato real: nombres, comunidad y DPI son inventados.

BEGIN;

SELECT plan(13);

-- ============================================================================
-- Setup
-- ============================================================================
INSERT INTO comunidades (id, municipio_id, nombre) VALUES
  ('10000000-0000-0000-0000-000000000699', 101, 'Comunidad de prueba 699');

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000000699', 'admin699@test.ecopac.local');

ALTER TABLE perfiles DISABLE TRIGGER trg_perfiles_impedir_cambio_de_rol_propio;
UPDATE perfiles SET rol = 'administrador' WHERE id = '00000000-0000-0000-0000-000000000699';
ALTER TABLE perfiles ENABLE TRIGGER trg_perfiles_impedir_cambio_de_rol_propio;

-- ============================================================================
-- 1. sexo: el enum sexo_paciente
-- ============================================================================
SELECT has_type('public', 'sexo_paciente', 'existe el tipo sexo_paciente');

SELECT is(
  (SELECT array_agg(e.enumlabel::TEXT ORDER BY e.enumsortorder)
     FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'sexo_paciente'),
  ARRAY['Femenino', 'Masculino'],
  'el enum tiene exactamente los dos valores que declara SEXOS en packages/shared/enums.js'
);

SELECT col_type_is('public', 'pacientes', 'sexo', 'sexo_paciente', 'pacientes.sexo usa el enum');

SELECT throws_ok(
  $$ INSERT INTO pacientes (nombres, apellidos, fecha_nacimiento, sexo, telefono_contacto, idioma)
     VALUES ('Uno', 'Inventado', '1990-01-01', 'F', '00000699', 'espanol') $$,
  '22P02',
  NULL,
  'la inicial ya no entra: es el valor que hacia que el reporte contara cero (00095)'
);

SELECT throws_ok(
  $$ INSERT INTO pacientes (nombres, apellidos, fecha_nacimiento, sexo, telefono_contacto, idioma)
     VALUES ('Dos', 'Inventado', '1990-01-01', 'femenino', '00000699', 'espanol') $$,
  '22P02',
  NULL,
  'tampoco entra la misma palabra en otra caja: el enum distingue mayusculas'
);

SELECT lives_ok(
  $$ INSERT INTO pacientes (id, nombres, apellidos, fecha_nacimiento, sexo, comunidad_id, telefono_contacto, idioma)
     VALUES ('20000000-0000-0000-0000-000000000699', 'Tres', 'Inventado', '1990-01-01',
             'Masculino', '10000000-0000-0000-0000-000000000699', '00000699', 'espanol') $$,
  'los dos valores del enum si entran'
);

-- ============================================================================
-- 2. dpi: 13 digitos, y opcional
-- ============================================================================
SELECT has_check('public', 'pacientes', 'pacientes tiene al menos un CHECK (el del DPI)');

SELECT throws_ok(
  $$ UPDATE pacientes SET dpi = '123456789012'
      WHERE id = '20000000-0000-0000-0000-000000000699' $$,
  '23514',
  NULL,
  'doce digitos no son un DPI'
);

SELECT throws_ok(
  $$ UPDATE pacientes SET dpi = '25478912301O1'
      WHERE id = '20000000-0000-0000-0000-000000000699' $$,
  '23514',
  NULL,
  'trece caracteres con una letra tampoco: el CHECK pide digitos'
);

SELECT lives_ok(
  $$ UPDATE pacientes SET dpi = '2547891230101'
      WHERE id = '20000000-0000-0000-0000-000000000699' $$,
  'trece digitos entran'
);

SELECT lives_ok(
  $$ UPDATE pacientes SET dpi = NULL WHERE id = '20000000-0000-0000-0000-000000000699' $$,
  'el DPI sigue siendo opcional: mucha poblacion rural no lo tiene'
);

-- ============================================================================
-- 3. Las funciones que la 00132 recrea siguen funcionando con el tipo nuevo
-- ============================================================================
--
-- fn_registrar_paciente castea p_sexo al enum al insertar y lo devuelve como VARCHAR, que es lo
-- que declara su RETURNS TABLE. Si faltara cualquiera de los dos casts, esto reventaria.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000699';

SELECT is(
  (SELECT sexo FROM fn_registrar_paciente(
     'Cuatro', 'Inventado', '1990-01-01', 'Femenino',
     '10000000-0000-0000-0000-000000000699', '00000699', 'espanol')),
  'Femenino'::VARCHAR,
  'fn_registrar_paciente guarda y devuelve el sexo con la columna convertida en enum'
);

SELECT is(
  (SELECT count(*)::INT FROM fn_buscar_pacientes(
     NULL, '10000000-0000-0000-0000-000000000699', 1, 20, NULL, 'Femenino')),
  1,
  'fn_buscar_pacientes filtra por sexo contra el enum y devuelve la fila'
);

SELECT * FROM finish();
ROLLBACK;
