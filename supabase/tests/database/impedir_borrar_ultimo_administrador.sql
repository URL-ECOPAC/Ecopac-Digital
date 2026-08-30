-- Pruebas de impedir_borrar_ultimo_administrador() (issue #511, migracion 00098).
-- Corre con: supabase test db
--
-- seed-demo.sql (siempre presente) y la 00063 (aprovisionar_primer_admin) ya dejan dos
-- administradores activos en la base antes de que esta prueba empiece. Se neutralizan primero
-- -se les cambia el rol, con los triggers de usuario apagados para no disparar
-- impedir_dejar_sin_administrador_activo (00072) durante el propio setup- para que el conteo
-- de esta suite dependa solo de sus propios fixtures.

BEGIN;

SELECT plan(5);

-- ============================================================================
-- Setup
-- ============================================================================
ALTER TABLE perfiles DISABLE TRIGGER USER;

UPDATE perfiles SET rol = 'voluntario general'
  WHERE rol = 'administrador';

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000051101', 'admin511a@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000051102', 'admin511b@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000051103', 'medico511@test.ecopac.local');

UPDATE perfiles SET rol = 'administrador', activo = TRUE
  WHERE id IN ('00000000-0000-0000-0000-000000051101', '00000000-0000-0000-0000-000000051102');
UPDATE perfiles SET rol = 'medico', activo = TRUE
  WHERE id = '00000000-0000-0000-0000-000000051103';

ALTER TABLE perfiles ENABLE TRIGGER USER;

-- ============================================================================
-- 1. Con dos administradores activos, borrar uno de los dos es normal
-- ============================================================================
SELECT isnt_empty(
  $$ DELETE FROM perfiles WHERE id = '00000000-0000-0000-0000-000000051101' RETURNING id $$,
  'con otro administrador activo, borrar uno de los dos funciona'
);

-- ============================================================================
-- 2. DELETE FROM perfiles directo sobre el ultimo administrador activo: bloqueado
-- ============================================================================
SELECT throws_ok(
  $$ DELETE FROM perfiles WHERE id = '00000000-0000-0000-0000-000000051102' $$,
  '23514',
  NULL,
  'borrar directo al ultimo administrador activo se bloquea (23514, check_violation)'
);

-- ============================================================================
-- 3. El camino real de la issue: DELETE FROM auth.users en cascada, sin pasar por ningun
--    BEFORE UPDATE de perfiles -el escenario del Dashboard de Supabase o la Admin API-
-- ============================================================================
SELECT throws_ok(
  $$ DELETE FROM auth.users WHERE id = '00000000-0000-0000-0000-000000051102' $$,
  '23514',
  NULL,
  'el borrado en cascada desde auth.users tambien se bloquea, no solo el DELETE directo'
);

-- ============================================================================
-- 4. El ultimo administrador sigue activo despues de los dos intentos bloqueados
-- ============================================================================
SELECT ok(
  EXISTS (
    SELECT 1 FROM perfiles
    WHERE id = '00000000-0000-0000-0000-000000051102' AND rol = 'administrador' AND activo = TRUE
  ),
  'el administrador que se intento borrar sigue activo: los dos intentos fallidos no dejaron nada a medias'
);

-- ============================================================================
-- 5. Borrar un perfil que no es administrador nunca dispara esta guarda
-- ============================================================================
SELECT isnt_empty(
  $$ DELETE FROM perfiles WHERE id = '00000000-0000-0000-0000-000000051103' RETURNING id $$,
  'borrar un perfil que no es administrador no se ve afectado por esta guarda'
);

SELECT * FROM finish();

ROLLBACK;
