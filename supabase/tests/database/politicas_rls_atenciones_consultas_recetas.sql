-- Pruebas de las politicas RLS de atenciones, triaje, consultas y recetas (issue #89).
-- Corre con: supabase test db
--
-- Mismo patron que las suites de #87/#88: SET LOCAL ROLE authenticated + SET LOCAL
-- request.jwt.claim.sub simula cada rol.

BEGIN;

SELECT plan(30);

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

-- Fixtures para las pruebas de IDOR de la issue #237: un segundo paciente (nueva atencion),
-- un diagnostico y un medicamento, para no reusar filas que las pruebas de anulacion de mas
-- abajo (issue #510) van a modificar.
INSERT INTO pacientes (id, nombres, apellidos, fecha_nacimiento, sexo, comunidad_id, telefono_contacto, idioma)
VALUES (
  '20000000-0000-0000-0000-000000000102',
  'Paciente', 'Prueba89b', '1998-01-01', 'M',
  '10000000-0000-0000-0000-000000000002', '5555-2002', 'espanol'
);

INSERT INTO diagnosticos (id, nombre) VALUES
  ('90000000-0000-0000-0000-000000000001', 'Diagnostico de prueba 89');

INSERT INTO medicamentos (id, nombre, concentracion, presentacion, marca) VALUES
  ('70000000-0000-0000-0000-000000000001', 'Medicamento de prueba 89', '500mg', 'tableta', 'Generico');

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

-- issue #237: mismo agujero que arriba, pero en atenciones (00033 nunca la exigio).
SELECT throws_ok(
  $$ INSERT INTO atenciones (paciente_id, jornada_id)
     VALUES ('20000000-0000-0000-0000-000000000102', '30000000-0000-0000-0000-000000000001') $$,
  '42501',
  NULL,
  'un medico no asignado a la jornada no puede registrar una atencion ahi (issue #237)'
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

-- issue #237: el mismo medico asignado si puede registrar una atencion nueva ahi.
SELECT lives_ok(
  $$ INSERT INTO atenciones (id, paciente_id, jornada_id)
     VALUES ('50000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000102',
             '30000000-0000-0000-0000-000000000001') $$,
  'un medico asignado a la jornada si puede registrar una atencion ahi (issue #237)'
);

-- issue #237: ni el propio medico asignado puede firmar el triaje con la identidad de otra
-- persona (tomado_por no ataba con la sesion).
SELECT throws_ok(
  $$ INSERT INTO triajes (atencion_id, presion_sistolica, presion_diastolica, frecuencia_cardiaca, tomado_por)
     VALUES ('50000000-0000-0000-0000-000000000002', 110, 70, 80, '00000000-0000-0000-0000-000000000203') $$,
  '42501',
  NULL,
  'un medico no puede firmar un triaje con la identidad de otra persona (issue #237)'
);

-- issue #237: medico89b no esta asignado a la jornada de la atencion2 tampoco.
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000203';

SELECT throws_ok(
  $$ INSERT INTO triajes (atencion_id, presion_sistolica, presion_diastolica, frecuencia_cardiaca, tomado_por)
     VALUES ('50000000-0000-0000-0000-000000000002', 110, 70, 80, '00000000-0000-0000-0000-000000000203') $$,
  '42501',
  NULL,
  'un medico no asignado a la jornada no puede registrar el triaje, ni firmandolo como si mismo (issue #237)'
);

SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000202';

SELECT lives_ok(
  $$ INSERT INTO triajes (atencion_id, presion_sistolica, presion_diastolica, frecuencia_cardiaca, tomado_por)
     VALUES ('50000000-0000-0000-0000-000000000002', 110, 70, 80, '00000000-0000-0000-0000-000000000202') $$,
  'un medico asignado a la jornada si registra el triaje firmandolo como si mismo (issue #237)'
);

SELECT ok(
  (SELECT count(*) FROM consultas) > 0,
  'medico89a puede leer consultas'
);

-- El id va explicito porque los asserts de anulacion de mas abajo (issue #510) tienen que
-- referirse a esta misma receta.
SELECT lives_ok(
  $$ INSERT INTO recetas (id, consulta_id, medico_id) VALUES ('80000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000202') $$,
  'el medico que atendio la consulta puede emitir una receta como si mismo'
);

-- issue #237: el medico dueno de la consulta si diagnostica y prescribe.
SELECT lives_ok(
  $$ INSERT INTO consulta_diagnostico (consulta_id, diagnostico_id)
     VALUES ('60000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001') $$,
  'el medico dueno de la consulta puede adjuntarle un diagnostico (issue #237)'
);

SELECT lives_ok(
  $$ INSERT INTO receta_detalle (receta_id, medicamento_id, dosis, frecuencia, duracion, cantidad_entregada)
     VALUES ('80000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001',
             '1 tableta', 'cada 8 horas', '5 dias', 15) $$,
  'el medico dueno de la receta puede agregarle un renglon de medicamento (issue #237)'
);

-- issue #237: medico89b no es dueno ni de la consulta ni de la receta de medico89a.
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000203';

SELECT throws_ok(
  $$ INSERT INTO consulta_diagnostico (consulta_id, diagnostico_id)
     VALUES ('60000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001') $$,
  '42501',
  NULL,
  'un medico no puede adjuntar un diagnostico a la consulta de otro medico (issue #237)'
);

SELECT throws_ok(
  $$ INSERT INTO receta_detalle (receta_id, medicamento_id, dosis, frecuencia, duracion, cantidad_entregada)
     VALUES ('80000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001',
             '1 tableta', 'cada 8 horas', '5 dias', 15) $$,
  '42501',
  NULL,
  'un medico no puede agregar un renglon a la receta de otro medico (issue #237)'
);

SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000202';

SELECT lives_ok(
  $$ UPDATE consultas SET observaciones = 'Reevaluado' WHERE id = '60000000-0000-0000-0000-000000000001' $$,
  'el medico que creo la consulta puede editarla'
);

-- ============================================================================
-- Anulacion de recetas (issue #510, migracion 00075)
-- ============================================================================
-- Las dos mitades de la politica fallan distinto, y por eso se comprueban distinto:
-- el USING excluye la fila y el UPDATE corre sin afectar nada; el WITH CHECK si lanza 42501.

-- medico89a es el dueno, pero no puede registrar a otro como responsable de la anulacion.
SELECT throws_ok(
  $$ UPDATE recetas
     SET estado = 'anulada', motivo_anulacion = 'En nombre de otro',
         anulada_por = '00000000-0000-0000-0000-000000000203', anulada_en = NOW()
     WHERE id = '80000000-0000-0000-0000-000000000001' $$,
  '42501',
  NULL,
  'ni el dueno puede anular registrando a otra persona como quien la anulo'
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

-- El bug de la issue #510: hasta la 00075 este UPDATE anulaba la receta de otro medico.
UPDATE recetas
SET estado = 'anulada', motivo_anulacion = 'Intento ajeno',
    anulada_por = '00000000-0000-0000-0000-000000000203', anulada_en = NOW()
WHERE id = '80000000-0000-0000-0000-000000000001';

SELECT is(
  (SELECT estado::text FROM recetas WHERE id = '80000000-0000-0000-0000-000000000001'),
  'emitida',
  'un medico distinto al que firmo la receta no puede anularla'
);

-- ============================================================================
-- medico89a: anula la suya una vez, y no la vuelve a tocar (issue #510)
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000202';

UPDATE recetas
SET estado = 'anulada', motivo_anulacion = 'Dosis equivocada',
    anulada_por = '00000000-0000-0000-0000-000000000202', anulada_en = NOW()
WHERE id = '80000000-0000-0000-0000-000000000001';

SELECT is(
  (SELECT estado::text FROM recetas WHERE id = '80000000-0000-0000-0000-000000000001'),
  'anulada',
  'el medico que firmo la receta si puede anularla'
);

-- Ya anulada, la clausula USING deja de alcanzarla: anular es un hecho registrado y reescribirlo
-- destruiria la trazabilidad. Si hubo un error, lo corrige la administradora.
UPDATE recetas
SET motivo_anulacion = 'Motivo reescrito por el medico'
WHERE id = '80000000-0000-0000-0000-000000000001';

SELECT is(
  (SELECT motivo_anulacion FROM recetas WHERE id = '80000000-0000-0000-0000-000000000001'),
  'Dosis equivocada',
  'una vez anulada, el medico ya no la vuelve a tocar'
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
