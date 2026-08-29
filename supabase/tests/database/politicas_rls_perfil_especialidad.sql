-- Pruebas de las politicas RLS de perfil_especialidad (issues #175 y #405, migraciones 00058 y
-- 00085). Corre con: supabase test db
--
-- Simula cada rol con SET LOCAL ROLE authenticated + SET LOCAL request.jwt.claim.sub, mismo
-- patron que politicas_rls_perfiles_permisos.sql. El setup corre con el rol que invoca la
-- prueba (sin sesion propia), que es dueno de las tablas y por lo tanto exento de su RLS.
--
-- Ningun dato real: los nombres de especialidad son inventados.

BEGIN;

SELECT plan(16);

-- ============================================================================
-- Setup: administrador, dos medicos (cada uno con una especialidad) y junta directiva.
-- ============================================================================
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000000201', 'admin201@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000000202', 'medico202@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000000203', 'medico203@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000000204', 'junta204@test.ecopac.local');

ALTER TABLE perfiles DISABLE TRIGGER trg_perfiles_impedir_cambio_de_rol_propio;
UPDATE perfiles SET rol = 'administrador' WHERE id = '00000000-0000-0000-0000-000000000201';
UPDATE perfiles SET rol = 'medico' WHERE id = '00000000-0000-0000-0000-000000000202';
UPDATE perfiles SET rol = 'medico' WHERE id = '00000000-0000-0000-0000-000000000203';
UPDATE perfiles SET rol = 'junta directiva' WHERE id = '00000000-0000-0000-0000-000000000204';
ALTER TABLE perfiles ENABLE TRIGGER trg_perfiles_impedir_cambio_de_rol_propio;

INSERT INTO perfil_especialidad (perfil_id, nombre_especialidad) VALUES
  ('00000000-0000-0000-0000-000000000202', 'Pediatria'),
  ('00000000-0000-0000-0000-000000000203', 'Odontologia');

-- ============================================================================
-- administrador: lee todo (00058)
-- ============================================================================
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000201';

SELECT is(
  (SELECT count(*)::int FROM perfil_especialidad), 2,
  'administrador ve las especialidades de cualquier perfil'
);

-- ============================================================================
-- el propio perfil: lee solo lo suyo (00058)
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000202';

SELECT is(
  (SELECT nombre_especialidad FROM perfil_especialidad WHERE perfil_id = '00000000-0000-0000-0000-000000000202'),
  'Pediatria',
  'un perfil ve su propia especialidad'
);

SELECT is(
  (SELECT count(*)::int FROM perfil_especialidad WHERE perfil_id = '00000000-0000-0000-0000-000000000203'), 0,
  'un perfil no ve la especialidad de otro perfil (0 filas, sin error: RLS filtra filas)'
);

SELECT is(
  (SELECT count(*)::int FROM perfil_especialidad), 1,
  'el total visible para ese perfil es solo su propia fila'
);

-- ============================================================================
-- junta directiva: lee todo, como administrador, pero no escribe nada (00085)
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000204';

SELECT is(
  (SELECT count(*)::int FROM perfil_especialidad), 2,
  'junta directiva (consultivo) ve las especialidades de cualquier perfil'
);

SELECT throws_ok(
  $$ INSERT INTO perfil_especialidad (perfil_id, nombre_especialidad)
     VALUES ('00000000-0000-0000-0000-000000000202', 'Neurologia') $$,
  '42501',
  NULL,
  'junta directiva no puede registrar una especialidad ajena: solo tiene lectura ampliada'
);

SELECT is_empty(
  $$ DELETE FROM perfil_especialidad
     WHERE perfil_id = '00000000-0000-0000-0000-000000000202' AND nombre_especialidad = 'Pediatria'
     RETURNING perfil_id $$,
  'junta directiva no puede borrar una especialidad ajena (bloqueado por USING, sin excepcion)'
);

-- ============================================================================
-- el propio perfil: escribe solo lo suyo (00085)
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000202';

SELECT throws_ok(
  $$ INSERT INTO perfil_especialidad (perfil_id, nombre_especialidad)
     VALUES ('00000000-0000-0000-0000-000000000203', 'Neurologia') $$,
  '42501',
  NULL,
  'un perfil no puede registrar una especialidad para otro perfil'
);

SELECT is_empty(
  $$ DELETE FROM perfil_especialidad
     WHERE perfil_id = '00000000-0000-0000-0000-000000000203' AND nombre_especialidad = 'Odontologia'
     RETURNING perfil_id $$,
  'un perfil no puede borrar la especialidad de otro perfil (bloqueado por USING, sin excepcion)'
);

SELECT lives_ok(
  $$ INSERT INTO perfil_especialidad (perfil_id, nombre_especialidad)
     VALUES ('00000000-0000-0000-0000-000000000202', 'Cardiologia') $$,
  'un perfil registra su propia especialidad'
);

SELECT lives_ok(
  $$ DELETE FROM perfil_especialidad
     WHERE perfil_id = '00000000-0000-0000-0000-000000000202' AND nombre_especialidad = 'Cardiologia' $$,
  'un perfil borra su propia especialidad'
);

-- ============================================================================
-- administrador: escribe cualquier perfil (00085)
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000201';

SELECT lives_ok(
  $$ INSERT INTO perfil_especialidad (perfil_id, nombre_especialidad)
     VALUES ('00000000-0000-0000-0000-000000000203', 'Cardiologia') $$,
  'administrador registra una especialidad para cualquier perfil'
);

SELECT lives_ok(
  $$ DELETE FROM perfil_especialidad
     WHERE perfil_id = '00000000-0000-0000-0000-000000000203' AND nombre_especialidad = 'Cardiologia' $$,
  'administrador borra una especialidad de cualquier perfil'
);

-- ============================================================================
-- sin sesion (anon)
-- ============================================================================
RESET request.jwt.claim.sub;
SET LOCAL ROLE anon;

-- Desde la 00049 (issue #408) anon no tiene ningun privilegio sobre public: la peticion sin
-- sesion se rechaza por falta de GRANT antes de que RLS llegue a evaluarse (42501), no por
-- una politica que filtre a cero filas. Es un mecanismo distinto del caso anterior, y el plan
-- de la issue #175 pide no confundirlos.
SELECT throws_ok(
  $$ SELECT count(*) FROM perfil_especialidad $$,
  '42501',
  NULL,
  'sin sesion (anon) ni siquiera se puede consultar perfil_especialidad: falta el GRANT, no es un filtro de RLS'
);

SELECT throws_ok(
  $$ INSERT INTO perfil_especialidad (perfil_id, nombre_especialidad)
     VALUES ('00000000-0000-0000-0000-000000000202', 'Cardiologia') $$,
  '42501',
  NULL,
  'anon tampoco puede insertar: nunca se le otorgo GRANT sobre perfil_especialidad'
);

SELECT throws_ok(
  $$ DELETE FROM perfil_especialidad WHERE perfil_id = '00000000-0000-0000-0000-000000000202' $$,
  '42501',
  NULL,
  'anon tampoco puede borrar: nunca se le otorgo GRANT sobre perfil_especialidad'
);

SELECT * FROM finish();

ROLLBACK;
