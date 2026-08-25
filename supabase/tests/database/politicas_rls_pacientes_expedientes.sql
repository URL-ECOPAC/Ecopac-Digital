-- Pruebas de las politicas RLS de pacientes y expedientes (issue #88). Corre con:
-- supabase test db
--
-- Mismo patron que supabase/tests/database/politicas_rls_perfiles_permisos.sql (#87):
-- SET LOCAL ROLE authenticated + SET LOCAL request.jwt.claim.sub simula cada rol.

BEGIN;

SELECT plan(19);

-- ============================================================================
-- Setup: un perfil de cada rol y una comunidad para poder registrar pacientes.
-- ============================================================================
INSERT INTO comunidades (id, municipio_id, nombre) VALUES
  ('10000000-0000-0000-0000-000000000001', 101, 'Comunidad de prueba');

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000000101', 'admin88@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000000102', 'junta88@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000000103', 'socio88@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000000104', 'medico88@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000000105', 'voluntario88@test.ecopac.local');

-- DISABLE TRIGGER USER (no un nombre puntual): si el issue #87 (migracion 00031, que
-- agrega el trigger que bloquea el auto-cambio de rol) todavia no esta mergeado a
-- develop cuando esto corre, un nombre de trigger puntual fallaria con "does not
-- exist". USER desactiva todos los triggers de usuario sobre perfiles sin necesitar
-- saber cuales existen.
ALTER TABLE perfiles DISABLE TRIGGER USER;

UPDATE perfiles SET rol = 'administrador' WHERE id = '00000000-0000-0000-0000-000000000101';
UPDATE perfiles SET rol = 'junta directiva' WHERE id = '00000000-0000-0000-0000-000000000102';
UPDATE perfiles SET rol = 'socio fundador' WHERE id = '00000000-0000-0000-0000-000000000103';
UPDATE perfiles SET rol = 'medico' WHERE id = '00000000-0000-0000-0000-000000000104';
-- voluntario88 se queda con el rol por defecto (voluntario general).

ALTER TABLE perfiles ENABLE TRIGGER USER;

-- ============================================================================
-- administrador
-- ============================================================================
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000101';

SELECT lives_ok(
  $$ INSERT INTO pacientes (id, nombres, apellidos, fecha_nacimiento, sexo, comunidad_id, telefono_contacto, idioma)
     VALUES ('20000000-0000-0000-0000-000000000001', 'Paciente', 'Admin', '1990-01-01', 'F',
             '10000000-0000-0000-0000-000000000001', '5555-1001', 'espanol') $$,
  'administrador puede registrar un paciente'
);

SELECT ok(
  (SELECT count(*) FROM pacientes) > 0,
  'administrador puede consultar pacientes'
);

SELECT lives_ok(
  $$ UPDATE pacientes SET telefono_contacto = '5555-9001' WHERE id = '20000000-0000-0000-0000-000000000001' $$,
  'administrador puede editar un paciente ya registrado'
);

-- 42501 (permission denied) y no 23001 (restrict_violation) del trigger de la 00026:
-- esta migracion no otorga DELETE sobre pacientes a ningun rol de aplicacion, asi que
-- el intento se rechaza a nivel de privilegios antes de que el trigger llegue a
-- evaluarse. El trigger sigue ahi como segunda linea de defensa si algun dia se
-- otorgara DELETE por error.
SELECT throws_ok(
  $$ DELETE FROM pacientes WHERE id = '20000000-0000-0000-0000-000000000001' $$,
  '42501',
  NULL,
  'ni administrador puede borrar fisicamente un paciente: no se otorga DELETE a ningun rol'
);

-- ============================================================================
-- medico
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000104';

SELECT lives_ok(
  $$ INSERT INTO pacientes (id, nombres, apellidos, fecha_nacimiento, sexo, comunidad_id, telefono_contacto, idioma)
     VALUES ('20000000-0000-0000-0000-000000000002', 'Paciente', 'Medico', '1985-05-05', 'M',
             '10000000-0000-0000-0000-000000000001', '5555-1002', 'espanol') $$,
  'medico puede registrar un paciente'
);

SELECT ok(
  (SELECT count(*) FROM pacientes) > 0,
  'medico puede consultar pacientes'
);

SELECT lives_ok(
  $$ UPDATE pacientes SET fecha_baja = CURRENT_DATE WHERE id = '20000000-0000-0000-0000-000000000002' $$,
  'medico puede editar un paciente ya registrado (dar de baja logica)'
);

SELECT lives_ok(
  $$ INSERT INTO expedientes (paciente_id, numero_ficha) VALUES ('20000000-0000-0000-0000-000000000002', 'F-0002') $$,
  'medico puede crear un expediente'
);

SELECT lives_ok(
  $$ UPDATE expedientes SET numero_ficha = 'F-0002-B' WHERE paciente_id = '20000000-0000-0000-0000-000000000002' $$,
  'medico puede editar un expediente ya creado'
);

-- eventos_auditoria solo la lee administrador (00026): se cambia de sesion
-- puntualmente para esta verificacion y se vuelve a medico despues.
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000101';

SELECT ok(
  (SELECT count(*) FROM eventos_auditoria WHERE tabla_afectada = 'pacientes' AND operacion = 'baja') > 0,
  'la baja logica de un paciente queda auditada en eventos_auditoria (verificado como administrador, la unica que puede leerla)'
);

SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000104';

-- ============================================================================
-- voluntario general
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000105';

SELECT lives_ok(
  $$ INSERT INTO pacientes (id, nombres, apellidos, fecha_nacimiento, sexo, comunidad_id, telefono_contacto, idioma)
     VALUES ('20000000-0000-0000-0000-000000000003', 'Paciente', 'Voluntario', '2000-03-03', 'F',
             '10000000-0000-0000-0000-000000000001', '5555-1003', 'espanol') $$,
  'voluntario puede registrar un paciente'
);

SELECT ok(
  (SELECT count(*) FROM pacientes) > 0,
  'voluntario puede consultar pacientes'
);

-- El UPDATE de un rol sin politica de UPDATE no lanza excepcion: la clausula USING
-- simplemente excluye la fila (como un WHERE que no matchea nada), asi que el UPDATE
-- termina "exitosamente" sin afectar ninguna fila. Se verifica que el valor no cambio,
-- en vez de esperar una excepcion.
UPDATE pacientes SET telefono_contacto = '5555-0000' WHERE id = '20000000-0000-0000-0000-000000000003';

SELECT is(
  (SELECT telefono_contacto FROM pacientes WHERE id = '20000000-0000-0000-0000-000000000003'),
  '5555-1003',
  'voluntario no puede editar un paciente ya registrado (el UPDATE no afecta ninguna fila)'
);

SELECT lives_ok(
  $$ INSERT INTO expedientes (paciente_id, numero_ficha) VALUES ('20000000-0000-0000-0000-000000000003', 'F-0003') $$,
  'voluntario puede crear un expediente'
);

UPDATE expedientes SET numero_ficha = 'F-0003-B' WHERE paciente_id = '20000000-0000-0000-0000-000000000003';

SELECT is(
  (SELECT numero_ficha FROM expedientes WHERE paciente_id = '20000000-0000-0000-0000-000000000003'),
  'F-0003',
  'voluntario no puede editar un expediente ya creado (el UPDATE no afecta ninguna fila)'
);

-- ============================================================================
-- junta directiva y socio fundador: sin acceso a datos identificables de pacientes
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000102';

SELECT is(
  (SELECT count(*)::int FROM pacientes), 0,
  'junta directiva no accede a ningun dato de pacientes'
);

SELECT is(
  (SELECT count(*)::int FROM expedientes), 0,
  'junta directiva no accede a ningun expediente'
);

SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000103';

SELECT is(
  (SELECT count(*)::int FROM pacientes), 0,
  'socio fundador tampoco accede a datos de pacientes'
);

-- ============================================================================
-- sin sesion (anon)
-- ============================================================================
RESET request.jwt.claim.sub;
SET LOCAL ROLE anon;

-- Desde la 00049 (issue #408) anon no tiene ningun privilegio sobre public, asi que la
-- peticion sin sesion ya no devuelve cero filas: se rechaza antes de que RLS llegue a
-- evaluarse. Es la misma garantia, una capa mas abajo y mas fuerte.
SELECT throws_ok(
  $$ SELECT count(*) FROM pacientes $$,
  '42501',
  NULL,
  'sin sesion (anon) ni siquiera se puede consultar pacientes'
);

SELECT * FROM finish();

ROLLBACK;
