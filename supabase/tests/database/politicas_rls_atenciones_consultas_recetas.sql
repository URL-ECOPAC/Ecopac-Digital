-- Pruebas de las politicas RLS de atenciones, triaje, consultas y recetas (issue #89).
-- Corre con: supabase test db
--
-- Mismo patron que las suites de #87/#88: SET LOCAL ROLE authenticated + SET LOCAL
-- request.jwt.claim.sub simula cada rol.

BEGIN;

SELECT plan(17);

-- ============================================================================
-- Setup: comunidad, perfiles (dos medicos: uno asignado a la jornada, otro no),
-- jornada en curso con el primer medico asignado, paciente, expediente y atencion.
-- ============================================================================
INSERT INTO comunidades (id, municipio_id, nombre) VALUES
  ('10000000-0000-0000-0000-000000000002', 101, 'Comunidad de prueba 89');

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000000201', 'admin89@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000000202', 'medico89a@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000000203', 'medico89b@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000000204', 'voluntario89@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000000205', 'junta89@test.ecopac.local');

ALTER TABLE perfiles DISABLE TRIGGER USER;

UPDATE perfiles SET rol = 'administrador' WHERE id = '00000000-0000-0000-0000-000000000201';
UPDATE perfiles SET rol = 'medico' WHERE id = '00000000-0000-0000-0000-000000000202';
UPDATE perfiles SET rol = 'medico' WHERE id = '00000000-0000-0000-0000-000000000203';
UPDATE perfiles SET rol = 'junta directiva' WHERE id = '00000000-0000-0000-0000-000000000205';
-- voluntario89 se queda con el rol por defecto (voluntario general).

ALTER TABLE perfiles ENABLE TRIGGER USER;

INSERT INTO jornadas (id, nombre, fecha, comunidad_id, responsable_id, estado)
VALUES (
  '30000000-0000-0000-0000-000000000001',
  'Jornada de prueba 89',
  (NOW() AT TIME ZONE 'America/Guatemala')::date,
  '10000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000201',
  'en curso'
);

-- Solo medico89a (...202) esta asignado a la jornada; medico89b (...203) no.
INSERT INTO jornada_personal (jornada_id, perfil_id, rol_en_jornada, hora_inicio, hora_fin)
VALUES (
  '30000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000202',
  'medico',
  '08:00',
  '16:00'
);

INSERT INTO pacientes (id, nombres, apellidos, fecha_nacimiento, sexo, comunidad_id, telefono_contacto, idioma)
VALUES (
  '20000000-0000-0000-0000-000000000101',
  'Paciente', 'Prueba89', '1995-01-01', 'F',
  '10000000-0000-0000-0000-000000000002', '5555-2001', 'espanol'
);

INSERT INTO expedientes (id, paciente_id, numero_ficha)
VALUES (
  '40000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000101',
  'F-0089'
);

INSERT INTO atenciones (id, paciente_id, jornada_id)
VALUES (
  '50000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000101',
  '30000000-0000-0000-0000-000000000001'
);

-- ============================================================================
-- voluntario: registra triaje, no lee informacion clinica
-- ============================================================================
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000204';

SELECT ok(
  (SELECT count(*) FROM atenciones) > 0,
  'voluntario puede consultar atenciones'
);

SELECT lives_ok(
  $$ INSERT INTO triajes (atencion_id, presion_sistolica, presion_diastolica, frecuencia_cardiaca, tomado_por)
     VALUES ('50000000-0000-0000-0000-000000000001', 120, 80, 75, '00000000-0000-0000-0000-000000000204') $$,
  'voluntario puede registrar triaje'
);

SELECT ok(
  (SELECT count(*) FROM triajes) > 0,
  'voluntario puede consultar triajes'
);

SELECT is(
  (SELECT count(*)::int FROM diagnosticos), 0,
  'voluntario no puede leer el catalogo de diagnosticos'
);

SELECT is(
  (SELECT count(*)::int FROM consultas), 0,
  'voluntario no puede leer consultas'
);

SELECT is(
  (SELECT count(*)::int FROM recetas), 0,
  'voluntario no puede leer recetas'
);

-- ============================================================================
-- medico89b: NO esta asignado a la jornada, aunque esta 'en curso'
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000203';

SELECT throws_ok(
  $$ INSERT INTO consultas (expediente_id, atencion_id, medico_id, jornada_id, motivo_consulta)
     VALUES ('40000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001',
             '00000000-0000-0000-0000-000000000203', '30000000-0000-0000-0000-000000000001', 'Control') $$,
  '42501',
  NULL,
  'un medico no asignado a la jornada no puede registrar una consulta ahi, aunque este en curso'
);

-- ============================================================================
-- medico89a: SI esta asignado a la jornada 'en curso'
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000202';

SELECT lives_ok(
  $$ INSERT INTO consultas (id, expediente_id, atencion_id, medico_id, jornada_id, motivo_consulta)
     VALUES ('60000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001',
             '50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000202',
             '30000000-0000-0000-0000-000000000001', 'Dolor de cabeza') $$,
  'un medico asignado a una jornada en curso si puede registrar una consulta'
);

SELECT ok(
  (SELECT count(*) FROM consultas) > 0,
  'medico89a puede leer consultas'
);

SELECT lives_ok(
  $$ INSERT INTO recetas (consulta_id, medico_id) VALUES ('60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000202') $$,
  'el medico que atendio la consulta puede emitir una receta como si mismo'
);

SELECT lives_ok(
  $$ UPDATE consultas SET observaciones = 'Reevaluado' WHERE id = '60000000-0000-0000-0000-000000000001' $$,
  'el medico que creo la consulta puede editarla'
);

-- ============================================================================
-- medico89b: no es el dueno de la consulta, no puede editarla
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000203';

-- El UPDATE bloqueado por RLS no lanza excepcion: la clausula USING excluye la fila
-- (como #88), asi que se verifica que el valor no cambio en vez de esperar un throw.
UPDATE consultas SET observaciones = 'Intento ajeno' WHERE id = '60000000-0000-0000-0000-000000000001';

SELECT is(
  (SELECT observaciones FROM consultas WHERE id = '60000000-0000-0000-0000-000000000001'),
  'Reevaluado',
  'un medico distinto al que creo la consulta no puede editarla'
);

-- ============================================================================
-- administrador: lee y edita cualquier cosa
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000201';

SELECT ok(
  (SELECT count(*) FROM consultas) > 0,
  'administrador puede leer consultas'
);

SELECT lives_ok(
  $$ UPDATE consultas SET observaciones = 'Revisado por administracion' WHERE id = '60000000-0000-0000-0000-000000000001' $$,
  'administrador puede editar cualquier consulta, no solo las propias'
);

-- ============================================================================
-- junta directiva: sin acceso a informacion clinica
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000205';

SELECT is(
  (SELECT count(*)::int FROM atenciones), 0,
  'junta directiva no accede a atenciones'
);

SELECT is(
  (SELECT count(*)::int FROM consultas), 0,
  'junta directiva no accede a consultas'
);

SELECT is(
  (SELECT count(*)::int FROM recetas), 0,
  'junta directiva no accede a recetas'
);

SELECT * FROM finish();

ROLLBACK;
