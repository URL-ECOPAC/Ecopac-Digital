-- Pruebas de fn_atenciones_de_persona_por_jornada (issue #175, criterio 4, migracion 00059).
-- Corre con: supabase test db
--
-- Un solo medico (M1) con actividad clinica mixta en una jornada: triajea y despues consulta
-- al mismo paciente (P1), y ademas consulta a un segundo paciente (P2) que triajeo otra
-- persona (el voluntario V1). Eso separa a proposito los tres contadores: 3 eventos clinicos
-- (2 consultas + 1 triaje) sobre solo 2 pacientes distintos, para que un conteo de eventos mal
-- escrito como conteo de pacientes (o viceversa) se note en las aserciones.
--
-- Se prueba la misma fila (la actividad de M1 en la jornada) desde cuatro roles, con SET LOCAL
-- ROLE authenticated + SET LOCAL request.jwt.claim.sub (mismo patron que
-- politicas_rls_perfiles_permisos.sql), para dejar escrito como prueba -no solo como
-- comentario- el limite conocido de RLS que documenta la migracion 00059: administrador y
-- medico ven los tres contadores completos; voluntario general ve triajes bien pero consultas
-- en cero (y por eso tambien subcuenta pacientes); junta directiva no ve ninguna fila.
--
-- Ningun dato real: la comunidad, los pacientes y el personal son inventados.

BEGIN;

SELECT plan(12);

-- ============================================================================
-- Setup: una comunidad, una jornada en curso, cuatro perfiles (uno por rol a probar),
-- dos pacientes con expediente y una atencion cada uno.
-- ============================================================================
INSERT INTO comunidades (id, municipio_id, nombre) VALUES
  ('10000000-0000-0000-0000-000000000175', 101, 'Comunidad de prueba 175');

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000000175', 'admin175@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000000176', 'medico175@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000000177', 'voluntario175@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000000178', 'junta175@test.ecopac.local');

ALTER TABLE perfiles DISABLE TRIGGER trg_perfiles_impedir_cambio_de_rol_propio;
UPDATE perfiles SET rol = 'administrador' WHERE id = '00000000-0000-0000-0000-000000000175';
UPDATE perfiles SET rol = 'medico' WHERE id = '00000000-0000-0000-0000-000000000176';
UPDATE perfiles SET rol = 'voluntario general' WHERE id = '00000000-0000-0000-0000-000000000177';
UPDATE perfiles SET rol = 'junta directiva' WHERE id = '00000000-0000-0000-0000-000000000178';
ALTER TABLE perfiles ENABLE TRIGGER trg_perfiles_impedir_cambio_de_rol_propio;

-- La jornada se crea directamente en 'en curso': el trigger de transiciones (00051) solo
-- vigila UPDATE OF estado, no INSERT, mismo atajo que usa jornada_en_curso_atenciones.sql.
INSERT INTO jornadas (id, nombre, fecha, comunidad_id, responsable_id, estado) VALUES
  ('30000000-0000-0000-0000-000000000175', 'Jornada de prueba 175',
   (NOW() AT TIME ZONE 'America/Guatemala')::date,
   '10000000-0000-0000-0000-000000000175', '00000000-0000-0000-0000-000000000175', 'en curso');

INSERT INTO pacientes (id, nombres, apellidos, fecha_nacimiento, sexo, comunidad_id, telefono_contacto, idioma) VALUES
  ('20000000-0000-0000-0000-000000000175', 'Paciente', 'UnoP175', '1990-01-01', 'F',
   '10000000-0000-0000-0000-000000000175', '5555-0175', 'espanol'),
  ('20000000-0000-0000-0000-000000000176', 'Paciente', 'DosP175', '1985-05-05', 'M',
   '10000000-0000-0000-0000-000000000175', '5555-0176', 'espanol');

INSERT INTO expedientes (id, paciente_id, numero_ficha) VALUES
  ('40000000-0000-0000-0000-000000000175', '20000000-0000-0000-0000-000000000175', 'F-0175'),
  ('40000000-0000-0000-0000-000000000176', '20000000-0000-0000-0000-000000000176', 'F-0176');

INSERT INTO atenciones (id, paciente_id, jornada_id) VALUES
  ('50000000-0000-0000-0000-000000000175', '20000000-0000-0000-0000-000000000175',
   '30000000-0000-0000-0000-000000000175'),
  ('50000000-0000-0000-0000-000000000176', '20000000-0000-0000-0000-000000000176',
   '30000000-0000-0000-0000-000000000175');

-- M1 triajea a P1; V1 triajea a P2. Cada atencion admite un solo triaje (atencion_id UNIQUE).
INSERT INTO triajes (
  atencion_id, presion_sistolica, presion_diastolica, frecuencia_cardiaca, tomado_por
) VALUES
  ('50000000-0000-0000-0000-000000000175', 110, 70, 80, '00000000-0000-0000-0000-000000000176'),
  ('50000000-0000-0000-0000-000000000176', 118, 76, 88, '00000000-0000-0000-0000-000000000177');

-- M1 consulta a P1 (el mismo paciente que ya triajeo: segundo evento, mismo paciente) y a P2
-- (paciente que triajeo V1, no M1: tercer evento, segundo paciente distinto).
INSERT INTO consultas (expediente_id, atencion_id, medico_id, jornada_id, motivo_consulta) VALUES
  ('40000000-0000-0000-0000-000000000175', '50000000-0000-0000-0000-000000000175',
   '00000000-0000-0000-0000-000000000176', '30000000-0000-0000-0000-000000000175',
   'motivo de prueba 175-1'),
  ('40000000-0000-0000-0000-000000000176', '50000000-0000-0000-0000-000000000176',
   '00000000-0000-0000-0000-000000000176', '30000000-0000-0000-0000-000000000175',
   'motivo de prueba 175-2');

-- ============================================================================
-- administrador: ve los tres contadores completos de M1 (2 consultas, 1 triaje, 2 pacientes)
-- ============================================================================
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000175';

SELECT is(
  (SELECT count(*)::int FROM fn_atenciones_de_persona_por_jornada('00000000-0000-0000-0000-000000000176')),
  1,
  'administrador: una sola fila para la jornada (el UNION ALL + GROUP BY no la duplica)'
);

SELECT is(
  (SELECT consultas FROM fn_atenciones_de_persona_por_jornada('00000000-0000-0000-0000-000000000176')),
  2,
  'administrador: 2 consultas para M1'
);

SELECT is(
  (SELECT triajes FROM fn_atenciones_de_persona_por_jornada('00000000-0000-0000-0000-000000000176')),
  1,
  'administrador: 1 triaje para M1'
);

SELECT is(
  (SELECT pacientes FROM fn_atenciones_de_persona_por_jornada('00000000-0000-0000-0000-000000000176')),
  2,
  'administrador: 2 pacientes distintos para M1 (3 eventos, no 3 pacientes)'
);

-- ============================================================================
-- medico: mismo resultado que administrador (la politica de consultas/triajes es por rol,
-- no por fila propia: un medico ve toda la tabla, no solo lo que el mismo registro)
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000176';

SELECT is(
  (SELECT consultas FROM fn_atenciones_de_persona_por_jornada('00000000-0000-0000-0000-000000000176')),
  2,
  'medico: ve los mismos 2 consultas que administrador'
);

SELECT is(
  (SELECT triajes FROM fn_atenciones_de_persona_por_jornada('00000000-0000-0000-0000-000000000176')),
  1,
  'medico: ve el mismo 1 triaje que administrador'
);

SELECT is(
  (SELECT pacientes FROM fn_atenciones_de_persona_por_jornada('00000000-0000-0000-0000-000000000176')),
  2,
  'medico: ve los mismos 2 pacientes distintos que administrador'
);

-- ============================================================================
-- voluntario general: triajes correcto, consultas en cero (RLS de consultas no lo incluye),
-- y por eso pacientes tambien queda subcontado (solo el paciente alcanzado por triaje)
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000177';

SELECT is(
  (SELECT triajes FROM fn_atenciones_de_persona_por_jornada('00000000-0000-0000-0000-000000000176')),
  1,
  'voluntario: ve el triaje de M1 correctamente (triajes y atenciones si le dan SELECT)'
);

SELECT is(
  (SELECT consultas FROM fn_atenciones_de_persona_por_jornada('00000000-0000-0000-0000-000000000176')),
  0,
  'voluntario: las consultas de M1 quedan en cero, no en 2 (consultas no le da SELECT por rol)'
);

SELECT is(
  (SELECT pacientes FROM fn_atenciones_de_persona_por_jornada('00000000-0000-0000-0000-000000000176')),
  1,
  'voluntario: pacientes tambien queda subcontado en 1, no en 2 (arrastra el hueco de consultas)'
);

-- ============================================================================
-- junta directiva: sin SELECT sobre consultas, triajes ni atenciones -> ninguna fila,
-- para ninguna jornada, no una fila con los contadores en cero
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000178';

SELECT lives_ok(
  $$ SELECT * FROM fn_atenciones_de_persona_por_jornada('00000000-0000-0000-0000-000000000176') $$,
  'junta directiva: la llamada no falla (tiene EXECUTE); solo no trae nada'
);

SELECT is(
  (SELECT count(*)::int FROM fn_atenciones_de_persona_por_jornada('00000000-0000-0000-0000-000000000176')),
  0,
  'junta directiva: cero filas para M1, no una fila con los contadores en cero'
);

SELECT * FROM finish();

ROLLBACK;
