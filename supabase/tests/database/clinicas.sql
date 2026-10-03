-- Pruebas de la 00183: catalogo de clinicas (issue #927, seccion 2). Corre con: supabase test db
--
-- Ningun dato real.

BEGIN;

SELECT plan(14);

-- ============================================================================
-- Setup
-- ============================================================================
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000183001', 'admin183@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000183002', 'medico183@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000183003', 'coordina183@test.ecopac.local');

ALTER TABLE perfiles DISABLE TRIGGER USER;
UPDATE perfiles SET rol = 'administrador' WHERE id = '00000000-0000-0000-0000-000000183001';
UPDATE perfiles SET rol = 'medico'
WHERE id IN ('00000000-0000-0000-0000-000000183002', '00000000-0000-0000-0000-000000183003');
ALTER TABLE perfiles ENABLE TRIGGER USER;

-- Al tercero se le delega jornadas.gestionar por persona.
INSERT INTO usuario_permiso (perfil_id, permiso_id, concedido)
VALUES ('00000000-0000-0000-0000-000000183003',
        (SELECT id FROM permisos WHERE clave = 'jornadas.gestionar'), TRUE);

SELECT is(
  has_table_privilege('anon', 'public.clinicas', 'SELECT'),
  false,
  'anon no lee clinicas'
);

SET LOCAL ROLE authenticated;

-- ============================================================================
-- 1. Quien crea y edita
-- ============================================================================
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000183002', TRUE);

SELECT throws_ok(
  $$ INSERT INTO clinicas (nombre, salas_disponibles) VALUES ('Clinica medico 183', 2) $$,
  '42501', NULL,
  'un medico sin jornadas.gestionar no crea clinicas'
);

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000183003', TRUE);

SELECT lives_ok(
  $$ INSERT INTO clinicas (nombre, salas_disponibles) VALUES ('Clinica Norte 183', 2) $$,
  'quien tiene jornadas.gestionar crea una clinica'
);

SELECT lives_ok(
  $$ UPDATE clinicas SET salas_disponibles = 3 WHERE nombre = 'Clinica Norte 183' $$,
  'y la edita'
);

SELECT throws_ok(
  $$ UPDATE clinicas SET es_vigente = FALSE WHERE nombre = 'Clinica Norte 183' $$,
  '42501', NULL,
  'pero no la retira: eso es de la administradora'
);

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000183002', TRUE);

SELECT is(
  (SELECT salas_disponibles FROM clinicas WHERE nombre = 'Clinica Norte 183'),
  3,
  'el medico lee el catalogo'
);

-- ============================================================================
-- 2. Reglas de la tabla
-- ============================================================================
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000183001', TRUE);

SELECT throws_ok(
  $$ INSERT INTO clinicas (nombre, salas_disponibles) VALUES ('  clínica norte 183 ', 1) $$,
  '23505', NULL,
  'el nombre es unico sin distinguir mayusculas, acentos ni espacios'
);

SELECT throws_ok(
  $$ INSERT INTO clinicas (nombre, salas_disponibles) VALUES ('Sin salas 183', 0) $$,
  '23514', NULL,
  'una clinica tiene al menos una sala'
);

SELECT lives_ok(
  $$ UPDATE clinicas SET es_vigente = FALSE WHERE nombre = 'Clinica Norte 183' $$,
  'la administradora la retira'
);

SELECT lives_ok(
  $$ UPDATE clinicas SET es_vigente = TRUE WHERE nombre = 'Clinica Norte 183' $$,
  'y la reactiva'
);

-- ============================================================================
-- 3. Eliminar
-- ============================================================================
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000183003', TRUE);

SELECT throws_ok(
  $$ SELECT fn_eliminar_clinica((SELECT id FROM clinicas WHERE nombre = 'Clinica Norte 183')) $$,
  '42501', NULL,
  'solo la administradora elimina una clinica'
);

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000183001', TRUE);

SELECT is(
  fn_eliminar_clinica((SELECT id FROM clinicas WHERE nombre = 'Clinica Norte 183')),
  'eliminada',
  'una clinica sin citas se borra'
);

SELECT is(
  (SELECT count(*)::int FROM clinicas WHERE nombre = 'Clinica Norte 183'),
  0,
  'y ya no esta'
);

RESET ROLE;

SELECT is(
  (SELECT count(*)::int FROM eventos_auditoria WHERE tabla_afectada = 'clinicas'),
  5,
  'crear, editar, retirar, reactivar y borrar quedan en la bitacora (el retiro rechazado no)'
);

SELECT * FROM finish();
ROLLBACK;
