-- Pruebas del trigger de auditoria de rol_permiso (issue #638, migracion 00139).
-- Corre con: supabase test db
--
-- Mismo patron de simulacion de rol que auditoria_usuario_permiso.sql: SET LOCAL ROLE
-- authenticated + SET LOCAL request.jwt.claim.sub para que auth.uid() identifique quien concede
-- o retira. El setup corre como el rol dueno de las tablas, exento de RLS.
--
-- Solo dos casos, no tres como usuario_permiso: rol_permiso nunca recibe UPDATE (no tiene
-- columna que actualizar aparte de su propia llave primaria compuesta), asi que no hay caso de
-- "revocar" separado del de "retirar" -conceder es INSERT, retirar es DELETE, eso es todo.
--
-- Se siembra un permiso de PRUEBA propio en vez de usar uno real del catalogo (como
-- 'donaciones.registrar'): fila_id en esta tabla ES permiso_id, y un permiso real puede tener
-- eventos_auditoria de usos anteriores (una prueba manual contra el stack local, otro admin
-- probando la pantalla) que un count(*) sobre ese mismo fila_id contaria de mas. Con un permiso
-- que nace y muere dentro de esta transaccion (BEGIN...ROLLBACK), el conteo no puede chocar con
-- nada preexistente. Mismo criterio que 'recurso_prueba_761' en limites_de_uso.sql.

BEGIN;

SELECT plan(6);

-- ============================================================================
-- Setup: un administrador y un permiso de prueba propio.
-- ============================================================================
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000000021', 'admin-auditoria-rol@test.ecopac.local');

ALTER TABLE perfiles DISABLE TRIGGER trg_perfiles_impedir_cambio_de_rol_propio;
UPDATE perfiles SET rol = 'administrador' WHERE id = '00000000-0000-0000-0000-000000000021';
ALTER TABLE perfiles ENABLE TRIGGER trg_perfiles_impedir_cambio_de_rol_propio;

INSERT INTO permisos (id, clave, modulo, descripcion) VALUES
  ('00000000-0000-0000-0000-000000761638', 'prueba_638.permiso', 'prueba', 'Permiso de prueba para auditoria_rol_permiso');

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000021';

-- ============================================================================
-- administrador concede un permiso por defecto a un rol: debe quedar auditado con
-- fila_id = permiso_id (no rol, que es un enum, no un UUID).
-- ============================================================================
SELECT lives_ok(
  $$ INSERT INTO rol_permiso (rol, permiso_id)
     VALUES ('voluntario general', '00000000-0000-0000-0000-000000761638') $$,
  'administrador concede el permiso de prueba por defecto a voluntario general'
);

SELECT is(
  (SELECT count(*)::int FROM eventos_auditoria
    WHERE tabla_afectada = 'rol_permiso'
      AND fila_id = '00000000-0000-0000-0000-000000761638'
      AND operacion = 'insercion'),
  1,
  'la concesion quedo registrada en eventos_auditoria con fila_id = permiso_id'
);

SELECT is(
  (SELECT valores_nuevos ->> 'rol' FROM eventos_auditoria
    WHERE tabla_afectada = 'rol_permiso' AND operacion = 'insercion'
      AND fila_id = '00000000-0000-0000-0000-000000761638'
    ORDER BY id DESC LIMIT 1),
  'voluntario general',
  'el evento guarda el rol dentro de valores_nuevos, no como fila_id'
);

SELECT is(
  (SELECT realizado_por FROM eventos_auditoria
    WHERE tabla_afectada = 'rol_permiso' AND operacion = 'insercion'
      AND fila_id = '00000000-0000-0000-0000-000000761638'
    ORDER BY id DESC LIMIT 1),
  '00000000-0000-0000-0000-000000000021'::UUID,
  'el evento registra quien concedio el permiso'
);

-- ============================================================================
-- administrador retira el permiso por defecto (DELETE): debe auditarse como eliminacion.
-- ============================================================================
SELECT lives_ok(
  $$ DELETE FROM rol_permiso
     WHERE rol = 'voluntario general' AND permiso_id = '00000000-0000-0000-0000-000000761638' $$,
  'administrador retira el permiso por defecto que acaba de conceder'
);

SELECT is(
  (SELECT count(*)::int FROM eventos_auditoria
    WHERE tabla_afectada = 'rol_permiso'
      AND fila_id = '00000000-0000-0000-0000-000000761638'
      AND operacion = 'eliminacion'),
  1,
  'el retiro quedo registrado como eliminacion'
);

SELECT * FROM finish();

ROLLBACK;
