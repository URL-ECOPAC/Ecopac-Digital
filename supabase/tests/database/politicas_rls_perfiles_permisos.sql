-- Pruebas de las politicas RLS de perfiles, permisos, rol_permiso, usuario_permiso y
-- eventos_auditoria (issue #87). Corre con: supabase test db
--
-- Simula cada rol con SET LOCAL ROLE authenticated + SET LOCAL request.jwt.claim.sub,
-- que es como auth.uid() identifica a quien hace la consulta en Supabase. El setup
-- corre con el rol que invoca la prueba (sin sesion propia), que es dueno de las
-- tablas y por lo tanto exento de su RLS.

BEGIN;

SELECT plan(21);

-- ============================================================================
-- Setup: seis perfiles de prueba, uno por rol (mas un segundo voluntario para
-- confirmar que un voluntario no ve los datos de otro).
-- ============================================================================
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000000001', 'admin@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000000002', 'junta@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000000003', 'socio@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000000004', 'medico@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000000005', 'voluntarioa@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000000006', 'voluntariob@test.ecopac.local');

-- El trigger crear_perfil_nuevo_usuario (00002) ya creo cada perfil con rol
-- 'voluntario general' por defecto. El trigger de proteccion de rol se desactiva
-- puntualmente para el setup, porque en este punto de la prueba no hay ninguna sesion
-- de administrador que lo autorice.
ALTER TABLE perfiles DISABLE TRIGGER trg_perfiles_impedir_cambio_de_rol_propio;

UPDATE perfiles SET rol = 'administrador', telefono = '5555-0001' WHERE id = '00000000-0000-0000-0000-000000000001';
UPDATE perfiles SET rol = 'junta directiva', telefono = '5555-0002' WHERE id = '00000000-0000-0000-0000-000000000002';
UPDATE perfiles SET rol = 'socio fundador', telefono = '5555-0003' WHERE id = '00000000-0000-0000-0000-000000000003';
UPDATE perfiles SET rol = 'medico', telefono = '5555-0004' WHERE id = '00000000-0000-0000-0000-000000000004';
UPDATE perfiles SET telefono = '5555-0005' WHERE id = '00000000-0000-0000-0000-000000000005'; -- voluntario_a, rol por defecto
UPDATE perfiles SET telefono = '5555-0006' WHERE id = '00000000-0000-0000-0000-000000000006'; -- voluntario_b, rol por defecto

ALTER TABLE perfiles ENABLE TRIGGER trg_perfiles_impedir_cambio_de_rol_propio;

-- Un permiso puntual concedido a voluntario_a, para probar usuario_permiso.
INSERT INTO usuario_permiso (perfil_id, permiso_id, concedido, otorgado_por)
SELECT
  '00000000-0000-0000-0000-000000000005',
  id,
  true,
  '00000000-0000-0000-0000-000000000001'
FROM permisos WHERE clave = 'inventario.aprobar';

-- ============================================================================
-- administrador
-- ============================================================================
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000001';

SELECT is(
  (SELECT count(*)::int FROM perfiles), 6,
  'administrador ve las 6 filas de perfiles'
);

SELECT lives_ok(
  $$ UPDATE perfiles SET rol = 'medico' WHERE id = '00000000-0000-0000-0000-000000000005' $$,
  'administrador puede cambiar el rol de otro perfil'
);

SELECT lives_ok(
  $$ UPDATE perfiles SET rol = 'voluntario general' WHERE id = '00000000-0000-0000-0000-000000000005' $$,
  'administrador puede revertir el cambio de rol (deja el fixture como estaba)'
);

SELECT ok(
  (SELECT count(*) FROM eventos_auditoria) > 0,
  'administrador puede leer eventos_auditoria (el setup ya genero eventos)'
);

SELECT throws_ok(
  $$ INSERT INTO eventos_auditoria (tabla_afectada, fila_id, operacion)
     VALUES ('perfiles', '00000000-0000-0000-0000-000000000001', 'insercion') $$,
  '42501',
  NULL,
  'ni administrador puede insertar en eventos_auditoria a mano: es de solo lectura para todos'
);

SELECT lives_ok(
  $$ INSERT INTO usuario_permiso (perfil_id, permiso_id, concedido, otorgado_por)
     SELECT '00000000-0000-0000-0000-000000000006', id, true, '00000000-0000-0000-0000-000000000001'
     FROM permisos WHERE clave = 'jornadas.gestionar' $$,
  'administrador puede otorgar un permiso puntual en usuario_permiso'
);

-- ============================================================================
-- junta directiva
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000002';

SELECT is(
  (SELECT count(*)::int FROM perfiles), 1,
  'junta directiva solo ve su propia fila en la tabla base perfiles (no la de los demas)'
);

SELECT is(
  (SELECT count(*)::int FROM perfiles_directorio), 6,
  'junta directiva ve las 6 filas a traves de perfiles_directorio'
);

SELECT is(
  (SELECT telefono FROM perfiles_directorio WHERE id = '00000000-0000-0000-0000-000000000001'), NULL,
  'junta directiva no ve el telefono de otro perfil en perfiles_directorio'
);

SELECT is(
  (SELECT telefono FROM perfiles_directorio WHERE id = '00000000-0000-0000-0000-000000000002'), '5555-0002',
  'junta directiva si ve su propio telefono en perfiles_directorio'
);

SELECT is(
  (SELECT count(*)::int FROM eventos_auditoria), 0,
  'junta directiva no puede leer eventos_auditoria'
);

-- ============================================================================
-- voluntario_a (rol base, sin permisos especiales de perfiles)
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000005';

SELECT is(
  (SELECT count(*)::int FROM perfiles), 1,
  'un voluntario solo ve su propia fila en perfiles'
);

SELECT is(
  (SELECT count(*)::int FROM perfiles WHERE id = '00000000-0000-0000-0000-000000000006'), 0,
  'voluntario_a no puede ver la fila de voluntario_b'
);

SELECT throws_ok(
  $$ UPDATE perfiles SET rol = 'administrador' WHERE id = '00000000-0000-0000-0000-000000000005' $$,
  '42501',
  NULL,
  'un voluntario no puede auto-asignarse el rol de administrador'
);

SELECT lives_ok(
  $$ UPDATE perfiles SET telefono = '5555-9999' WHERE id = '00000000-0000-0000-0000-000000000005' $$,
  'un voluntario si puede editar sus propios datos de contacto'
);

SELECT ok(
  (SELECT count(*) FROM permisos) > 0,
  'cualquier autenticado lee el catalogo de permisos'
);

SELECT ok(
  (SELECT count(*) FROM rol_permiso) > 0,
  'cualquier autenticado lee rol_permiso'
);

SELECT is(
  (SELECT count(*)::int FROM usuario_permiso), 1,
  'voluntario_a ve su propia fila en usuario_permiso'
);

SELECT is(
  (SELECT count(*)::int FROM usuario_permiso WHERE perfil_id = '00000000-0000-0000-0000-000000000006'), 0,
  'voluntario_a no ve la fila de usuario_permiso de voluntario_b'
);

SELECT throws_ok(
  $$ INSERT INTO usuario_permiso (perfil_id, permiso_id, concedido)
     SELECT '00000000-0000-0000-0000-000000000005', id, true FROM permisos WHERE clave = 'donaciones.registrar' $$,
  '42501',
  NULL,
  'un voluntario no puede otorgarse permisos a si mismo en usuario_permiso'
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
  $$ SELECT count(*) FROM perfiles $$,
  '42501',
  NULL,
  'sin sesion (anon) ni siquiera se puede consultar perfiles'
);

SELECT * FROM finish();

ROLLBACK;
