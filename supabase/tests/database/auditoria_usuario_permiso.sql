-- Pruebas del trigger de auditoria de usuario_permiso (issue #104, migracion 00045).
-- Corre con: supabase test db
--
-- Mismo patron de simulacion de rol que politicas_rls_perfiles_permisos.sql: SET LOCAL ROLE
-- authenticated + SET LOCAL request.jwt.claim.sub para que auth.uid() identifique a quien
-- concede/revoca. El setup corre como el rol dueno de las tablas, exento de RLS.

BEGIN;

SELECT plan(8);

-- ============================================================================
-- Setup: un administrador y un medico.
-- ============================================================================
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000000011', 'admin-auditoria@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000000012', 'medico-auditoria@test.ecopac.local');

ALTER TABLE perfiles DISABLE TRIGGER trg_perfiles_impedir_cambio_de_rol_propio;
UPDATE perfiles SET rol = 'administrador' WHERE id = '00000000-0000-0000-0000-000000000011';
UPDATE perfiles SET rol = 'medico' WHERE id = '00000000-0000-0000-0000-000000000012';
ALTER TABLE perfiles ENABLE TRIGGER trg_perfiles_impedir_cambio_de_rol_propio;

-- ============================================================================
-- administrador concede un permiso puntual: debe quedar auditado con el permiso concreto.
-- ============================================================================
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000011';

SELECT lives_ok(
  $$ INSERT INTO usuario_permiso (perfil_id, permiso_id, concedido, otorgado_por, motivo)
     SELECT '00000000-0000-0000-0000-000000000012', id, true, '00000000-0000-0000-0000-000000000011', 'prueba pgTAP'
     FROM permisos WHERE clave = 'jornadas.gestionar' $$,
  'administrador concede jornadas.gestionar a un medico'
);

SELECT is(
  (SELECT count(*)::int FROM eventos_auditoria
    WHERE tabla_afectada = 'usuario_permiso'
      AND fila_id = '00000000-0000-0000-0000-000000000012'
      AND operacion = 'insercion'),
  1,
  'la concesion quedo registrada en eventos_auditoria con fila_id = perfil_id del medico'
);

SELECT is(
  (SELECT (valores_nuevos ->> 'permiso_id')::UUID FROM eventos_auditoria
    WHERE tabla_afectada = 'usuario_permiso' AND operacion = 'insercion'
    ORDER BY id DESC LIMIT 1),
  (SELECT id FROM permisos WHERE clave = 'jornadas.gestionar'),
  'el evento guarda permiso_id, no solo a quien se le concedio'
);

SELECT is(
  (SELECT realizado_por FROM eventos_auditoria
    WHERE tabla_afectada = 'usuario_permiso' AND operacion = 'insercion'
    ORDER BY id DESC LIMIT 1),
  '00000000-0000-0000-0000-000000000011'::UUID,
  'el evento registra quien concedio el permiso'
);

-- ============================================================================
-- administrador revoca (upsert a concedido = false): debe auditarse como actualizacion.
-- ============================================================================
SELECT lives_ok(
  $$ UPDATE usuario_permiso SET concedido = false
     WHERE perfil_id = '00000000-0000-0000-0000-000000000012'
       AND permiso_id = (SELECT id FROM permisos WHERE clave = 'jornadas.gestionar') $$,
  'administrador revoca el permiso puntual (concedido = false)'
);

SELECT is(
  (SELECT count(*)::int FROM eventos_auditoria
    WHERE tabla_afectada = 'usuario_permiso'
      AND fila_id = '00000000-0000-0000-0000-000000000012'
      AND operacion = 'actualizacion'),
  1,
  'la revocacion quedo registrada como actualizacion'
);

-- ============================================================================
-- administrador restablece (DELETE): debe auditarse como eliminacion.
-- ============================================================================
SELECT lives_ok(
  $$ DELETE FROM usuario_permiso
     WHERE perfil_id = '00000000-0000-0000-0000-000000000012'
       AND permiso_id = (SELECT id FROM permisos WHERE clave = 'jornadas.gestionar') $$,
  'administrador restablece el permiso al valor del rol (borra la excepcion)'
);

SELECT is(
  (SELECT count(*)::int FROM eventos_auditoria
    WHERE tabla_afectada = 'usuario_permiso'
      AND fila_id = '00000000-0000-0000-0000-000000000012'
      AND operacion = 'eliminacion'),
  1,
  'el restablecimiento quedo registrado como eliminacion'
);

SELECT * FROM finish();

ROLLBACK;
