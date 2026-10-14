-- Pruebas de la 00184: agenda de citas por jornada con consulta agendada (issue #927, seccion 3 y
-- 4). Corre con: supabase test db
--
-- Una clinica con 2 salas, dos jornadas (una en curso hoy, otra planificada en 10 dias), dos
-- medicos y un voluntario en el cuadro de turnos de la de hoy, un medico fuera de el, la
-- administradora y una persona de la junta directiva. Ningun dato real.
--
-- La concurrencia de dos sesiones agendando a la vez no se puede simular en una sola transaccion:
-- aqui se prueba la cuenta; el bloqueo (pg_advisory_xact_lock por clinica) lo explica la 00184.

BEGIN;

SELECT plan(48);

-- ============================================================================
-- Setup
-- ============================================================================
INSERT INTO proyectos (id, nombre) VALUES ('5f000000-0000-0000-0000-000000184001', 'Proyecto 184');
ALTER TABLE jornadas ALTER COLUMN proyecto_id SET DEFAULT '5f000000-0000-0000-0000-000000184001';
INSERT INTO bodegas (id, nombre, es_movil) VALUES
  ('5b000000-0000-0000-0000-000000184001', 'Botiquin 184', TRUE);
ALTER TABLE jornadas ALTER COLUMN botiquin_bodega_id SET DEFAULT '5b000000-0000-0000-0000-000000184001';
ALTER TABLE jornadas DISABLE TRIGGER trg_jornadas_requiere_bodega_movil_libre;

INSERT INTO comunidades (id, municipio_id, nombre) VALUES
  ('10000000-0000-0000-0000-000000184001', 101, 'Comunidad 184');

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000184001', 'admin184@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000184002', 'medico1-184@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000184003', 'medico2-184@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000184004', 'medico3-184@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000184005', 'voluntario184@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000184006', 'junta184@test.ecopac.local');

ALTER TABLE perfiles DISABLE TRIGGER USER;
UPDATE perfiles SET rol = 'administrador' WHERE id = '00000000-0000-0000-0000-000000184001';
UPDATE perfiles SET rol = 'medico' WHERE id IN (
  '00000000-0000-0000-0000-000000184002', '00000000-0000-0000-0000-000000184003',
  '00000000-0000-0000-0000-000000184004');
UPDATE perfiles SET rol = 'voluntario general' WHERE id = '00000000-0000-0000-0000-000000184005';
UPDATE perfiles SET rol = 'junta directiva' WHERE id = '00000000-0000-0000-0000-000000184006';
ALTER TABLE perfiles ENABLE TRIGGER USER;

-- J1 hoy (se pone en curso), J2 planificada en 10 dias.
INSERT INTO jornadas (id, nombre, fecha, comunidad_id, responsable_id) VALUES
  ('40000000-0000-0000-0000-000000184001', 'Jornada hoy 184', (now() AT TIME ZONE 'America/Guatemala')::date,
   '10000000-0000-0000-0000-000000184001', '00000000-0000-0000-0000-000000184001'),
  ('40000000-0000-0000-0000-000000184002', 'Jornada futura 184', (now() AT TIME ZONE 'America/Guatemala')::date + 10,
   '10000000-0000-0000-0000-000000184001', '00000000-0000-0000-0000-000000184001');
UPDATE jornadas SET estado = 'en curso' WHERE id = '40000000-0000-0000-0000-000000184001';

INSERT INTO jornada_personal (jornada_id, perfil_id, rol_en_jornada, hora_inicio, hora_fin) VALUES
  ('40000000-0000-0000-0000-000000184001', '00000000-0000-0000-0000-000000184002', 'medico', '08:00', '16:00'),
  ('40000000-0000-0000-0000-000000184001', '00000000-0000-0000-0000-000000184003', 'medico', '08:00', '16:00'),
  ('40000000-0000-0000-0000-000000184001', '00000000-0000-0000-0000-000000184005', 'voluntario general', '08:00', '16:00'),
  ('40000000-0000-0000-0000-000000184002', '00000000-0000-0000-0000-000000184002', 'medico', '08:00', '16:00');

INSERT INTO pacientes (id, nombres, apellidos, fecha_nacimiento, sexo, comunidad_id, idioma)
SELECT ('20000000-0000-0000-0000-000000184' || lpad(n::text, 3, '0'))::uuid,
       'Paciente ' || n, 'Prueba184', DATE '1990-01-01', 'Femenino',
       '10000000-0000-0000-0000-000000184001', 'espanol'
FROM generate_series(1, 6) AS n;
INSERT INTO expedientes (paciente_id)
SELECT ('20000000-0000-0000-0000-000000184' || lpad(n::text, 3, '0'))::uuid FROM generate_series(1, 6) AS n
ON CONFLICT (paciente_id) DO NOTHING;

INSERT INTO clinicas (id, nombre, salas_disponibles) VALUES
  ('c0000000-0000-0000-0000-000000184001', 'Clinica 184', 2),
  ('c0000000-0000-0000-0000-000000184002', 'Clinica retirada 184', 1);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000184001', TRUE);
UPDATE clinicas SET es_vigente = FALSE WHERE id = 'c0000000-0000-0000-0000-000000184002';

-- Horas de hoy y de J2, en Guatemala.
CREATE TEMP VIEW h AS SELECT
  (((now() AT TIME ZONE 'America/Guatemala')::date + TIME '09:00') AT TIME ZONE 'America/Guatemala') AS hoy9,
  (((now() AT TIME ZONE 'America/Guatemala')::date + 10 + TIME '09:00') AT TIME ZONE 'America/Guatemala') AS fut9,
  (SELECT id FROM areas_atencion WHERE nombre = 'Odontología') AS odonto,
  (SELECT id FROM areas_atencion WHERE nombre = 'Medicina General') AS general;
GRANT SELECT ON h TO authenticated;

-- Una cita como la administradora: cita(id, paciente, jornada, inicio, minutos, profesional)
CREATE FUNCTION pg_temp.cita(p_id TEXT, p_paciente INT, p_jornada INT, p_inicio TIMESTAMPTZ,
                             p_minutos INT DEFAULT 30, p_profesional UUID DEFAULT NULL,
                             p_area UUID DEFAULT NULL)
RETURNS VOID LANGUAGE sql AS $$
  INSERT INTO citas (id, paciente_id, jornada_id, clinica_id, area_id, profesional_id, inicia_en, termina_en)
  VALUES (('ca000000-0000-0000-0000-000000184' || p_id)::uuid,
          ('20000000-0000-0000-0000-000000184' || lpad(p_paciente::text, 3, '0'))::uuid,
          ('40000000-0000-0000-0000-00000018400' || p_jornada)::uuid,
          'c0000000-0000-0000-0000-000000184001',
          COALESCE(p_area, (SELECT odonto FROM h)), p_profesional,
          p_inicio, p_inicio + make_interval(mins => p_minutos));
$$;

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000184001', TRUE);

-- ============================================================================
-- 1. Cupo de la clinica (2 salas)
-- ============================================================================
SELECT lives_ok($$ SELECT pg_temp.cita('001', 1, 1, (SELECT hoy9 FROM h)) $$,
  'primera cita a las 9');
SELECT lives_ok($$ SELECT pg_temp.cita('002', 2, 1, (SELECT hoy9 FROM h)) $$,
  'segunda a la misma hora: cabe, hay dos salas');
SELECT throws_like($$ SELECT pg_temp.cita('003', 3, 1, (SELECT hoy9 FROM h)) $$,
  'La clinica ya tiene sus 2 salas ocupadas el %',
  'la tercera a la misma hora se rechaza y dice cuando');
SELECT throws_ok($$ SELECT pg_temp.cita('004', 3, 1, (SELECT hoy9 FROM h) + interval '20 minutes') $$,
  '23514', NULL,
  'un traslape parcial con las dos tambien llena la clinica');
SELECT lives_ok($$ SELECT pg_temp.cita('005', 3, 1, (SELECT hoy9 FROM h) + interval '30 minutes') $$,
  'justo al terminar las dos, cabe');

UPDATE citas SET estado = 'cancelada', motivo_cancelacion = 'prueba'
WHERE id = 'ca000000-0000-0000-0000-000000184002';
SELECT lives_ok($$ SELECT pg_temp.cita('006', 4, 1, (SELECT hoy9 FROM h)) $$,
  'una cita cancelada libera su sala');
SELECT is((SELECT cancelada_por FROM citas WHERE id = 'ca000000-0000-0000-0000-000000184002'),
  '00000000-0000-0000-0000-000000184001'::uuid, 'la cancelada guarda quien la cancelo');

-- ============================================================================
-- 2. Traslapes de paciente y profesional; el cuadro de turnos
-- ============================================================================
SELECT throws_like($$ SELECT pg_temp.cita('007', 1, 1, (SELECT hoy9 FROM h) + interval '10 minutes', 30, NULL, (SELECT general FROM h)) $$,
  'El paciente ya tiene otra cita a esa hora.',
  'un paciente no tiene dos citas que se traslapen, aunque sean de areas distintas');
SELECT lives_ok($$ SELECT pg_temp.cita('008', 1, 1, (SELECT hoy9 FROM h) + interval '2 hours', 30, NULL, (SELECT general FROM h)) $$,
  'pero si dos citas en la misma jornada a distinta hora y en otra area');
SELECT lives_ok($$ SELECT pg_temp.cita('009', 5, 1, (SELECT hoy9 FROM h) + interval '3 hours', 30, '00000000-0000-0000-0000-000000184002') $$,
  'una cita con un medico del cuadro de turnos');
SELECT throws_like($$ SELECT pg_temp.cita('010', 6, 1, (SELECT hoy9 FROM h) + interval '3 hours', 30, '00000000-0000-0000-0000-000000184002') $$,
  'El profesional ya tiene otra cita a esa hora.',
  'el mismo profesional no tiene dos citas que se traslapen');
SELECT throws_like($$ SELECT pg_temp.cita('011', 6, 1, (SELECT hoy9 FROM h) + interval '4 hours', 30, '00000000-0000-0000-0000-000000184004') $$,
  'El profesional tiene que estar como medico en el cuadro de turnos de la jornada.',
  'un medico fuera del cuadro de turnos no es profesional de la cita');
SELECT throws_like($$ SELECT pg_temp.cita('012', 6, 1, (SELECT hoy9 FROM h) + interval '4 hours', 30, '00000000-0000-0000-0000-000000184005') $$,
  'El profesional tiene que estar como medico%',
  'un voluntario del cuadro de turnos tampoco');

-- ============================================================================
-- 3. Jornada, fecha, paciente, clinica y area
-- ============================================================================
SELECT throws_like($$ SELECT pg_temp.cita('013', 6, 2, (SELECT fut9 FROM h) - interval '1 day') $$,
  'La cita no puede ser antes de la fecha de la jornada%',
  'no se agenda antes de la fecha de la jornada');
SELECT lives_ok($$ SELECT pg_temp.cita('014', 6, 2, (SELECT fut9 FROM h)) $$,
  'en una jornada planificada si se agenda');
SELECT throws_ok($$
  INSERT INTO citas (paciente_id, jornada_id, clinica_id, area_id, inicia_en)
  VALUES ('20000000-0000-0000-0000-000000184006', '40000000-0000-0000-0000-000000184002',
          'c0000000-0000-0000-0000-000000184002', (SELECT odonto FROM h), (SELECT fut9 FROM h) + interval '1 hour') $$,
  '23514', 'La clinica esta retirada: no se agenda en ella.',
  'no se agenda en una clinica retirada');
SELECT is(
  (SELECT termina_en - inicia_en FROM citas WHERE id = 'ca000000-0000-0000-0000-000000184014'),
  interval '30 minutes', 'termina_en por defecto: 30 minutos despues');

UPDATE pacientes SET fecha_baja = CURRENT_DATE WHERE id = '20000000-0000-0000-0000-000000184006';
SELECT throws_like($$ SELECT pg_temp.cita('015', 6, 2, (SELECT fut9 FROM h) + interval '2 hours') $$,
  'El paciente esta dado de baja%', 'no se agenda a un paciente dado de baja');
UPDATE pacientes SET fecha_baja = NULL WHERE id = '20000000-0000-0000-0000-000000184006';

-- ============================================================================
-- 4. Transiciones
-- ============================================================================
SELECT throws_like($$ UPDATE citas SET estado = 'atendida' WHERE id = 'ca000000-0000-0000-0000-000000184001' $$,
  'Una cita no pasa de creada a atendida.', 'creada no pasa directo a atendida');
SELECT throws_like($$ UPDATE citas SET estado = 'en_atencion' WHERE id = 'ca000000-0000-0000-0000-000000184014' $$,
  'Una cita se atiende con la jornada en curso.', 'no se atiende con la jornada planificada');
SELECT lives_ok($$ UPDATE citas SET estado = 'en_atencion' WHERE id = 'ca000000-0000-0000-0000-000000184005' $$,
  'se abre una cita de la jornada en curso');
SELECT lives_ok($$ UPDATE citas SET estado = 'creada' WHERE id = 'ca000000-0000-0000-0000-000000184005' $$,
  'en atencion vuelve a creada si se abrio por error');
SELECT throws_like($$ UPDATE citas SET notas = 'x', inicia_en = inicia_en + interval '5 minutes'
                      WHERE id = 'ca000000-0000-0000-0000-000000184002' $$,
  'Una cita cancelada ya no se edita; solo sus notas.', 'una cancelada no se edita');
SELECT lives_ok($$ UPDATE citas SET notas = 'Llamar antes' WHERE id = 'ca000000-0000-0000-0000-000000184002' $$,
  'pero sus notas si');

-- ============================================================================
-- 5. La consulta agendada
-- ============================================================================
INSERT INTO atenciones (id, paciente_id, jornada_id) VALUES
  ('50000000-0000-0000-0000-000000184001', '20000000-0000-0000-0000-000000184001', '40000000-0000-0000-0000-000000184001');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000184002', TRUE);
SET LOCAL ROLE authenticated;

SELECT throws_like($$
  INSERT INTO consultas (expediente_id, atencion_id, medico_id, jornada_id, motivo_consulta, cita_id)
  VALUES ((SELECT id FROM expedientes WHERE paciente_id = '20000000-0000-0000-0000-000000184001'),
          '50000000-0000-0000-0000-000000184001', '00000000-0000-0000-0000-000000184002',
          '40000000-0000-0000-0000-000000184001', 'Motivo', 'ca000000-0000-0000-0000-000000184001') $$,
  'Abre la cita con Atender antes de registrar su consulta.',
  'una cita creada no se atiende sin abrirla');

UPDATE citas SET estado = 'en_atencion' WHERE id = 'ca000000-0000-0000-0000-000000184001';

SELECT lives_ok($$
  INSERT INTO consultas (id, expediente_id, atencion_id, medico_id, jornada_id, motivo_consulta, cita_id)
  VALUES ('60000000-0000-0000-0000-000000184001',
          (SELECT id FROM expedientes WHERE paciente_id = '20000000-0000-0000-0000-000000184001'),
          '50000000-0000-0000-0000-000000184001', '00000000-0000-0000-0000-000000184002',
          '40000000-0000-0000-0000-000000184001', 'Motivo de la cita', 'ca000000-0000-0000-0000-000000184001') $$,
  'el medico registra la consulta de la cita');

SELECT results_eq(
  $$ SELECT estado::text, profesional_id FROM citas WHERE id = 'ca000000-0000-0000-0000-000000184001' $$,
  $$ VALUES ('atendida', '00000000-0000-0000-0000-000000184002'::uuid) $$,
  'la cita queda atendida y, sin profesional, con el que registro la consulta');
SELECT is((SELECT area_id FROM consultas WHERE id = '60000000-0000-0000-0000-000000184001'),
  (SELECT odonto FROM h), 'la consulta toma el area de la cita');

-- Segunda cita del mismo paciente en la misma jornada (008): segunda consulta en la misma atencion.
UPDATE citas SET estado = 'en_atencion' WHERE id = 'ca000000-0000-0000-0000-000000184008';
SELECT lives_ok($$
  INSERT INTO consultas (id, expediente_id, atencion_id, medico_id, jornada_id, motivo_consulta, cita_id)
  VALUES ('60000000-0000-0000-0000-000000184002',
          (SELECT id FROM expedientes WHERE paciente_id = '20000000-0000-0000-0000-000000184001'),
          '50000000-0000-0000-0000-000000184001', '00000000-0000-0000-0000-000000184002',
          '40000000-0000-0000-0000-000000184001', 'Segunda cita', 'ca000000-0000-0000-0000-000000184008') $$,
  'dos consultas en la misma atencion, una por cita');
SELECT is((SELECT count(*)::int FROM consultas WHERE atencion_id = '50000000-0000-0000-0000-000000184001'),
  2, 'la primera no se sobrescribe');
SELECT is((SELECT count(*)::int FROM vista_cola_jornada WHERE atencion_id = '50000000-0000-0000-0000-000000184001'),
  1, 'la cola sigue mostrando una sola fila por la visita');

-- La cita 009 es del medico 1: el medico 2 no la atiende.
INSERT INTO atenciones (id, paciente_id, jornada_id) VALUES
  ('50000000-0000-0000-0000-000000184005', '20000000-0000-0000-0000-000000184005', '40000000-0000-0000-0000-000000184001');
UPDATE citas SET estado = 'en_atencion' WHERE id = 'ca000000-0000-0000-0000-000000184009';
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000184003', TRUE);
SELECT throws_like($$
  INSERT INTO consultas (expediente_id, atencion_id, medico_id, jornada_id, motivo_consulta, cita_id)
  VALUES ((SELECT id FROM expedientes WHERE paciente_id = '20000000-0000-0000-0000-000000184005'),
          '50000000-0000-0000-0000-000000184005', '00000000-0000-0000-0000-000000184003',
          '40000000-0000-0000-0000-000000184001', 'Motivo', 'ca000000-0000-0000-0000-000000184009') $$,
  'Esta cita la atiende otro profesional.', 'la cita la atiende su profesional');

SELECT throws_like($$ UPDATE citas SET notas = 'x', area_id = (SELECT general FROM h)
                      WHERE id = 'ca000000-0000-0000-0000-000000184001' $$,
  'Una cita atendida ya no se edita; solo sus notas.', 'una atendida no se edita');

-- ============================================================================
-- 6. RLS
-- ============================================================================
SELECT ok((SELECT count(*) FROM citas WHERE jornada_id = '40000000-0000-0000-0000-000000184001') > 0,
  'un medico del cuadro de turnos ve las citas de su jornada');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000184004', TRUE);
SELECT is((SELECT count(*)::int FROM citas WHERE jornada_id = '40000000-0000-0000-0000-000000184001'),
  0, 'un medico que no esta en la jornada no ve sus citas');
SELECT throws_ok($$ SELECT pg_temp.cita('016', 6, 1, (SELECT hoy9 FROM h) + interval '5 hours') $$,
  '42501', NULL, 'ni agenda en ella');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000184005', TRUE);
SELECT lives_ok($$ SELECT pg_temp.cita('017', 6, 1, (SELECT hoy9 FROM h) + interval '5 hours') $$,
  'el voluntario de la jornada agenda');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000184006', TRUE);
SELECT is((SELECT count(*)::int FROM citas), 0, 'la junta directiva no ve citas');

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000184001', TRUE);

-- ============================================================================
-- 7. Clinica: salas y eliminacion
-- ============================================================================
SELECT lives_ok($$ SELECT pg_temp.cita('018', 5, 2, (SELECT fut9 FROM h)) $$,
  'J2 a las 9 queda con dos citas (014 y esta)');
SELECT throws_like($$ UPDATE clinicas SET salas_disponibles = 1 WHERE id = 'c0000000-0000-0000-0000-000000184001' $$,
  'No se puede bajar a 1 salas: el % hay 2 citas a la vez.',
  'no se bajan las salas por debajo de lo agendado a futuro, y dice cuando');
SELECT lives_ok($$ UPDATE clinicas SET salas_disponibles = 4 WHERE id = 'c0000000-0000-0000-0000-000000184001' $$,
  'subirlas si');
SELECT is(fn_eliminar_clinica('c0000000-0000-0000-0000-000000184001'), 'retirada',
  'una clinica con citas no se borra: se retira');

-- ============================================================================
-- 8. Cerrar la jornada
-- ============================================================================
UPDATE jornadas SET estado = 'finalizada' WHERE id = '40000000-0000-0000-0000-000000184001';
SELECT results_eq(
  $$ SELECT estado::text, motivo_cancelacion FROM citas WHERE id = 'ca000000-0000-0000-0000-000000184005' $$,
  $$ VALUES ('cancelada', 'No atendida al cerrar la jornada') $$,
  'al finalizar la jornada sus citas pendientes se cancelan');
SELECT is((SELECT estado::text FROM citas WHERE id = 'ca000000-0000-0000-0000-000000184001'),
  'atendida', 'las atendidas se quedan como estan');

-- No hay transicion a cancelada en la aplicacion; se fuerza para probar la regla.
ALTER TABLE jornadas DISABLE TRIGGER tr_validar_transicion_estado_jornada;
UPDATE jornadas SET estado = 'cancelada' WHERE id = '40000000-0000-0000-0000-000000184002';
ALTER TABLE jornadas ENABLE TRIGGER tr_validar_transicion_estado_jornada;
SELECT is((SELECT motivo_cancelacion FROM citas WHERE id = 'ca000000-0000-0000-0000-000000184014'),
  'Jornada cancelada', 'al cancelar la jornada sus citas se cancelan');

-- ============================================================================
-- 9. Fusion
-- ============================================================================
-- Paciente 3 (cita 004 nunca existio; tiene la 005, cancelada) y paciente 4 (cita 006 a las 9).
-- Se agenda al 3 a las 9 en J2 ya no: se usan dos citas creadas que se traslapan en otra jornada.
INSERT INTO jornadas (id, nombre, fecha, comunidad_id, responsable_id) VALUES
  ('40000000-0000-0000-0000-000000184003', 'Jornada fusion 184', (now() AT TIME ZONE 'America/Guatemala')::date + 20,
   '10000000-0000-0000-0000-000000184001', '00000000-0000-0000-0000-000000184001');
INSERT INTO clinicas (id, nombre, salas_disponibles) VALUES ('c0000000-0000-0000-0000-000000184003', 'Clinica fusion 184', 3);
INSERT INTO citas (paciente_id, jornada_id, clinica_id, area_id, inicia_en) VALUES
  ('20000000-0000-0000-0000-000000184003', '40000000-0000-0000-0000-000000184003', 'c0000000-0000-0000-0000-000000184003',
   (SELECT odonto FROM h), (SELECT fut9 FROM h) + interval '10 days'),
  ('20000000-0000-0000-0000-000000184004', '40000000-0000-0000-0000-000000184003', 'c0000000-0000-0000-0000-000000184003',
   (SELECT general FROM h), (SELECT fut9 FROM h) + interval '10 days');
INSERT INTO paciente_area (paciente_id, area_id) VALUES
  ('20000000-0000-0000-0000-000000184003', (SELECT odonto FROM h)),
  ('20000000-0000-0000-0000-000000184004', (SELECT odonto FROM h)),
  ('20000000-0000-0000-0000-000000184004', (SELECT general FROM h));

SELECT is(
  (SELECT citas_traslapadas FROM fn_fusionar_pacientes('20000000-0000-0000-0000-000000184003',
                                                       '20000000-0000-0000-0000-000000184004')),
  2, 'la fusion conserva las dos citas traslapadas y lo dice');
SELECT is((SELECT count(*)::int FROM citas WHERE paciente_id = '20000000-0000-0000-0000-000000184004'),
  0, 'todas las citas del absorbido pasan al sobreviviente');
SELECT is((SELECT count(*)::int FROM paciente_area WHERE paciente_id = '20000000-0000-0000-0000-000000184003'),
  2, 'y sus areas, sin duplicar la que ya tenia');

SELECT * FROM finish();
ROLLBACK;
