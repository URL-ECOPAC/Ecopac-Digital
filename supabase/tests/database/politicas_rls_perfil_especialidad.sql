-- Pruebas de la politica RLS de perfil_especialidad (issue #175, migracion 00058).
-- Corre con: supabase test db
--
-- Simula cada rol con SET LOCAL ROLE authenticated + SET LOCAL request.jwt.claim.sub, mismo
-- patron que politicas_rls_perfiles_permisos.sql. El setup corre con el rol que invoca la
-- prueba (sin sesion propia), que es dueno de las tablas y por lo tanto exento de su RLS.
--
-- Ningun dato real: los nombres de especialidad son inventados.

BEGIN;

SELECT plan(6);

-- ============================================================================
-- Setup: dos perfiles (administrador y un medico), cada uno con una especialidad.
-- ============================================================================
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000000201', 'admin201@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000000202', 'medico202@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000000203', 'medico203@test.ecopac.local');

ALTER TABLE perfiles DISABLE TRIGGER trg_perfiles_impedir_cambio_de_rol_propio;
UPDATE perfiles SET rol = 'administrador' WHERE id = '00000000-0000-0000-0000-000000000201';
UPDATE perfiles SET rol = 'medico' WHERE id = '00000000-0000-0000-0000-000000000202';
UPDATE perfiles SET rol = 'medico' WHERE id = '00000000-0000-0000-0000-000000000203';
ALTER TABLE perfiles ENABLE TRIGGER trg_perfiles_impedir_cambio_de_rol_propio;

INSERT INTO perfil_especialidad (perfil_id, nombre_especialidad) VALUES
  ('00000000-0000-0000-0000-000000000202', 'Pediatria'),
  ('00000000-0000-0000-0000-000000000203', 'Odontologia');

-- ============================================================================
-- administrador
-- ============================================================================
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000201';

SELECT is(
  (SELECT count(*)::int FROM perfil_especialidad), 2,
  'administrador ve las especialidades de cualquier perfil'
);

-- ============================================================================
-- el propio perfil
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
  'anon tampoco puede insertar: solo se otorgo GRANT SELECT en la migracion 00058'
);

SELECT * FROM finish();

ROLLBACK;
