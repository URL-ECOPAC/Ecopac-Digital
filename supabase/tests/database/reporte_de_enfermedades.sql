-- Pruebas de la 00177: reporte de enfermedades (issue #916). Corre con: supabase test db
--
-- Dos comunidades (A y B) y dos jornadas en meses distintos:
--   Jornada 1, en A, proyecto 1: seis pacientes de la comunidad B con la enfermedad X como
--     principal (cinco mujeres y un hombre), y dos pacientes sin comunidad con Y como principal y X
--     como secundario.
--   Jornada 2, en B, proyecto 2: cinco pacientes de la comunidad A con X como principal.
-- Todos los datos son inventados. La base de pruebas trae ademas seed-demo.sql, asi que cada
-- consulta se recorta a estas dos jornadas o a estos dos proyectos.

BEGIN;

SELECT plan(26);

-- ============================================================================
-- Setup
-- ============================================================================
INSERT INTO proyectos (id, nombre) VALUES
  ('5f000000-0000-0000-0000-000000177001', 'Proyecto 1 de prueba 00177'),
  ('5f000000-0000-0000-0000-000000177002', 'Proyecto 2 de prueba 00177');

INSERT INTO comunidades (id, municipio_id, nombre) VALUES
  ('10000000-0000-0000-0000-000000177001', 101, 'Comunidad A 177'),
  ('10000000-0000-0000-0000-000000177002', 101, 'Comunidad B 177');

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000177001', 'admin177@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000177002', 'medico177@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000177003', 'junta177@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000177004', 'socio177@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000177005', 'voluntario177@test.ecopac.local');

ALTER TABLE perfiles DISABLE TRIGGER USER;
UPDATE perfiles SET rol = 'administrador'      WHERE id = '00000000-0000-0000-0000-000000177001';
UPDATE perfiles SET rol = 'medico'             WHERE id = '00000000-0000-0000-0000-000000177002';
UPDATE perfiles SET rol = 'junta directiva'    WHERE id = '00000000-0000-0000-0000-000000177003';
UPDATE perfiles SET rol = 'socio fundador'     WHERE id = '00000000-0000-0000-0000-000000177004';
UPDATE perfiles SET rol = 'voluntario general' WHERE id = '00000000-0000-0000-0000-000000177005';
ALTER TABLE perfiles ENABLE TRIGGER USER;

INSERT INTO jornadas (id, nombre, fecha, comunidad_id, responsable_id, proyecto_id) VALUES
  ('40000000-0000-0000-0000-000000177001', 'Jornada 1 177', CURRENT_DATE + 1,
   '10000000-0000-0000-0000-000000177001', '00000000-0000-0000-0000-000000177001',
   '5f000000-0000-0000-0000-000000177001'),
  -- Cuarenta dias despues: siempre cae en otro mes.
  ('40000000-0000-0000-0000-000000177002', 'Jornada 2 177', CURRENT_DATE + 40,
   '10000000-0000-0000-0000-000000177002', '00000000-0000-0000-0000-000000177001',
   '5f000000-0000-0000-0000-000000177002');

INSERT INTO diagnosticos (id, codigo, nombre) VALUES
  ('90000000-0000-0000-0000-000000177001', 'Z99.177', 'Enfermedad X 177'),
  ('90000000-0000-0000-0000-000000177002', NULL, 'Enfermedad Y 177');

-- Trece pacientes. n = 1..6: de B, en la jornada 1, el 6 es hombre. n = 7..8: sin comunidad, en
-- la jornada 1. n = 9..13: de A, en la jornada 2.
INSERT INTO pacientes (id, nombres, apellidos, fecha_nacimiento, sexo, comunidad_id, idioma)
SELECT
  ('20000000-0000-0000-0000-000000177' || lpad(n::text, 3, '0'))::uuid,
  'Paciente ' || n, 'Inventado 177', DATE '1990-01-01',
  (CASE WHEN n = 6 THEN 'Masculino' ELSE 'Femenino' END)::sexo_paciente,
  CASE
    WHEN n <= 6 THEN '10000000-0000-0000-0000-000000177002'::uuid
    WHEN n <= 8 THEN NULL
    ELSE '10000000-0000-0000-0000-000000177001'::uuid
  END,
  'espanol'
FROM generate_series(1, 13) AS n;

INSERT INTO expedientes (paciente_id)
SELECT ('20000000-0000-0000-0000-000000177' || lpad(n::text, 3, '0'))::uuid
FROM generate_series(1, 13) AS n
ON CONFLICT (paciente_id) DO NOTHING;

-- Una atencion y una consulta solo se registran en una jornada en curso.
UPDATE jornadas SET estado = 'en curso'
WHERE id IN ('40000000-0000-0000-0000-000000177001', '40000000-0000-0000-0000-000000177002');

INSERT INTO atenciones (id, paciente_id, jornada_id)
SELECT
  ('50000000-0000-0000-0000-000000177' || lpad(n::text, 3, '0'))::uuid,
  ('20000000-0000-0000-0000-000000177' || lpad(n::text, 3, '0'))::uuid,
  CASE WHEN n <= 8 THEN '40000000-0000-0000-0000-000000177001'::uuid
       ELSE '40000000-0000-0000-0000-000000177002'::uuid END
FROM generate_series(1, 13) AS n;

INSERT INTO consultas (id, expediente_id, atencion_id, medico_id, jornada_id, motivo_consulta)
SELECT
  ('60000000-0000-0000-0000-000000177' || lpad(n::text, 3, '0'))::uuid,
  e.id,
  ('50000000-0000-0000-0000-000000177' || lpad(n::text, 3, '0'))::uuid,
  '00000000-0000-0000-0000-000000177002',
  CASE WHEN n <= 8 THEN '40000000-0000-0000-0000-000000177001'::uuid
       ELSE '40000000-0000-0000-0000-000000177002'::uuid END,
  'Motivo inventado'
FROM generate_series(1, 13) AS n
JOIN expedientes e ON e.paciente_id = ('20000000-0000-0000-0000-000000177' || lpad(n::text, 3, '0'))::uuid;

-- X principal en todos menos el 7 y el 8, que tienen Y principal y X secundario.
INSERT INTO consulta_diagnostico (consulta_id, diagnostico_id, es_principal)
SELECT ('60000000-0000-0000-0000-000000177' || lpad(n::text, 3, '0'))::uuid,
       '90000000-0000-0000-0000-000000177001', n NOT IN (7, 8)
FROM generate_series(1, 13) AS n;

INSERT INTO consulta_diagnostico (consulta_id, diagnostico_id, es_principal)
SELECT ('60000000-0000-0000-0000-000000177' || lpad(n::text, 3, '0'))::uuid,
       '90000000-0000-0000-0000-000000177002', TRUE
FROM generate_series(7, 8) AS n;

-- ============================================================================
-- Privilegios
-- ============================================================================
SELECT is(
  has_function_privilege('anon',
    'public.fn_reporte_enfermedades(text, date, date, uuid[], uuid[], integer, integer, uuid, uuid, boolean, text)',
    'EXECUTE'),
  false,
  'anon no ejecuta fn_reporte_enfermedades'
);

SELECT is(
  has_function_privilege('anon', 'public.fn_opciones_reporte_enfermedades()', 'EXECUTE'),
  false,
  'anon no ejecuta fn_opciones_reporte_enfermedades'
);

-- ============================================================================
-- Administrador
-- ============================================================================
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000177001';

-- Atajo de las dos jornadas de la prueba.
CREATE TEMP VIEW jornadas_177 AS
SELECT ARRAY['40000000-0000-0000-0000-000000177001',
             '40000000-0000-0000-0000-000000177002']::uuid[] AS ids;

SELECT is(
  (SELECT casos FROM fn_reporte_enfermedades('ninguno', p_jornada_ids => (SELECT ids FROM jornadas_177))
    WHERE diagnostico_id = '90000000-0000-0000-0000-000000177001'),
  11,
  'solo principales: X cuenta 11 casos'
);

SELECT is(
  (SELECT casos FROM fn_reporte_enfermedades('ninguno', p_jornada_ids => (SELECT ids FROM jornadas_177),
     p_solo_principales => false)
    WHERE diagnostico_id = '90000000-0000-0000-0000-000000177001'),
  13,
  'todos los diagnosticos: X cuenta tambien los dos secundarios'
);

SELECT ok(
  (SELECT casos IS NULL AND suprimido FROM fn_reporte_enfermedades('ninguno',
     p_jornada_ids => (SELECT ids FROM jornadas_177))
    WHERE diagnostico_id = '90000000-0000-0000-0000-000000177002'),
  'Y tiene 2 casos: la cifra sale NULL y marcada como suprimida'
);

SELECT is(
  (SELECT suprimido FROM fn_reporte_enfermedades('ninguno', p_jornada_ids => (SELECT ids FROM jornadas_177))
    WHERE diagnostico_id = '90000000-0000-0000-0000-000000177001'),
  false,
  'una cifra de 5 o mas no se suprime'
);

SELECT is(
  (SELECT orden_diagnostico FROM fn_reporte_enfermedades('ninguno', p_jornada_ids => (SELECT ids FROM jornadas_177))
    WHERE diagnostico_id = '90000000-0000-0000-0000-000000177001'),
  1,
  'la enfermedad mas frecuente lleva el puesto 1'
);

SELECT results_eq(
  $$ SELECT grupo_id, casos FROM fn_reporte_enfermedades('jornada',
       p_jornada_ids => (SELECT ids FROM jornadas_177))
     WHERE diagnostico_id = '90000000-0000-0000-0000-000000177001' ORDER BY grupo_fecha $$,
  $$ VALUES ('40000000-0000-0000-0000-000000177001'::text, 6),
            ('40000000-0000-0000-0000-000000177002'::text, 5) $$,
  'por jornada: 6 casos de X en la jornada 1 y 5 en la jornada 2'
);

SELECT results_eq(
  $$ SELECT grupo_id, casos FROM fn_reporte_enfermedades('comunidad',
       p_jornada_ids => (SELECT ids FROM jornadas_177))
     WHERE diagnostico_id = '90000000-0000-0000-0000-000000177001' ORDER BY grupo $$,
  $$ VALUES ('10000000-0000-0000-0000-000000177001'::text, 6),
            ('10000000-0000-0000-0000-000000177002'::text, 5) $$,
  'comunidad de la jornada: los 6 de la jornada 1 cuentan en A, donde se atendio'
);

SELECT results_eq(
  $$ SELECT grupo_id, casos FROM fn_reporte_enfermedades('comunidad',
       p_jornada_ids => (SELECT ids FROM jornadas_177), p_comunidad_de => 'paciente')
     WHERE diagnostico_id = '90000000-0000-0000-0000-000000177001' ORDER BY grupo $$,
  $$ VALUES ('10000000-0000-0000-0000-000000177001'::text, 5),
            ('10000000-0000-0000-0000-000000177002'::text, 6) $$,
  'comunidad del paciente: los 6 de la jornada 1 cuentan en B, de donde vienen'
);

SELECT is(
  (SELECT grupo_id FROM fn_reporte_enfermedades('comunidad',
     p_jornada_ids => (SELECT ids FROM jornadas_177), p_comunidad_de => 'paciente')
    WHERE diagnostico_id = '90000000-0000-0000-0000-000000177002'),
  '10000000-0000-0000-0000-000000177001',
  'el paciente sin comunidad cae en la de la jornada'
);

SELECT is(
  (SELECT count(*) FROM fn_reporte_enfermedades('mes', p_jornada_ids => (SELECT ids FROM jornadas_177))
    WHERE diagnostico_id = '90000000-0000-0000-0000-000000177001')::int,
  2,
  'por mes: X aparece en dos meses'
);

SELECT is(
  (SELECT grupo_fecha FROM fn_reporte_enfermedades('mes', p_jornada_ids => (SELECT ids FROM jornadas_177))
    WHERE diagnostico_id = '90000000-0000-0000-0000-000000177001' ORDER BY grupo_fecha LIMIT 1),
  date_trunc('month', CURRENT_DATE + 1)::date,
  'el grupo de un mes trae su primer dia como fecha'
);

SELECT results_eq(
  $$ SELECT mujeres, hombres, adultos, menores FROM fn_reporte_enfermedades('jornada',
       p_jornada_ids => ARRAY['40000000-0000-0000-0000-000000177001']::uuid[])
     WHERE diagnostico_id = '90000000-0000-0000-0000-000000177001' $$,
  $$ VALUES (NULL::int, NULL::int, 6, 0) $$,
  'desglose: 1 hombre suprime todo el desglose por sexo (5 mujeres de 6 casos lo delataria); la edad, sin cifras bajas, sale exacta'
);

SELECT is(
  (SELECT casos FROM fn_reporte_enfermedades('ninguno',
     p_proyecto_id => '5f000000-0000-0000-0000-000000177002')
    WHERE diagnostico_id = '90000000-0000-0000-0000-000000177001'),
  5,
  'filtrar por proyecto deja solo la jornada 2'
);

SELECT is(
  (SELECT casos FROM fn_reporte_enfermedades('ninguno', p_jornada_ids => (SELECT ids FROM jornadas_177),
     p_comunidad_ids => ARRAY['10000000-0000-0000-0000-000000177002']::uuid[], p_comunidad_de => 'paciente')
    WHERE diagnostico_id = '90000000-0000-0000-0000-000000177001'),
  6,
  'filtrar por comunidad usa la comunidad elegida (aqui, la del paciente)'
);

SELECT is(
  (SELECT count(*) FROM fn_reporte_enfermedades('ninguno', p_jornada_ids => (SELECT ids FROM jornadas_177),
     p_departamento_id => -1))::int,
  0,
  'un departamento sin comunidades no trae nada'
);

SELECT is(
  (SELECT casos FROM fn_reporte_enfermedades('ninguno', p_jornada_ids => (SELECT ids FROM jornadas_177),
     p_municipio_id => 101)
    WHERE diagnostico_id = '90000000-0000-0000-0000-000000177001'),
  11,
  'filtrar por el municipio de las dos comunidades trae todo'
);

SELECT is(
  (SELECT count(DISTINCT diagnostico_id) FROM fn_reporte_enfermedades('mes',
     p_jornada_ids => (SELECT ids FROM jornadas_177),
     p_diagnostico_id => '90000000-0000-0000-0000-000000177002'))::int,
  1,
  'evolucion: filtrar por una enfermedad trae solo esa'
);

SELECT throws_ok(
  $$ SELECT * FROM fn_reporte_enfermedades('paciente') $$,
  '22023',
  NULL,
  'una agrupacion desconocida se rechaza'
);

SELECT ok(
  (SELECT fn_opciones_reporte_enfermedades() -> 'jornadas')
    @> '[{"id": "40000000-0000-0000-0000-000000177001"}]'::jsonb
  AND (SELECT fn_opciones_reporte_enfermedades() -> 'diagnosticos')
    @> '[{"id": "90000000-0000-0000-0000-000000177002"}]'::jsonb
  AND (SELECT fn_opciones_reporte_enfermedades() -> 'proyectos')
    @> '[{"id": "5f000000-0000-0000-0000-000000177001"}]'::jsonb,
  'las opciones traen las jornadas y diagnosticos con casos y los proyectos con jornadas'
);

-- ============================================================================
-- Roles consultivos: leen el agregado aunque no lean las tablas clinicas
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000177003';

SELECT is(
  (SELECT casos FROM fn_reporte_enfermedades('ninguno', p_jornada_ids => (SELECT ids FROM jornadas_177))
    WHERE diagnostico_id = '90000000-0000-0000-0000-000000177001'),
  11,
  'junta directiva consulta el reporte'
);

SELECT ok(
  jsonb_array_length(fn_opciones_reporte_enfermedades() -> 'jornadas') >= 2,
  'junta directiva recibe las jornadas para elegir, aunque no lea la tabla'
);

SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000177004';

SELECT is(
  (SELECT casos FROM fn_reporte_enfermedades('ninguno', p_jornada_ids => (SELECT ids FROM jornadas_177))
    WHERE diagnostico_id = '90000000-0000-0000-0000-000000177001'),
  11,
  'socio fundador consulta el reporte'
);

-- ============================================================================
-- Medico y voluntario: fuera
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000177002';

SELECT throws_ok(
  $$ SELECT * FROM fn_reporte_enfermedades() $$,
  '42501',
  NULL,
  'el medico no consulta el reporte de enfermedades'
);

SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000177005';

SELECT throws_ok(
  $$ SELECT fn_opciones_reporte_enfermedades() $$,
  '42501',
  NULL,
  'el voluntario no recibe las opciones'
);

SELECT * FROM finish();
ROLLBACK;
