-- Pruebas de la 00148: matriz de acceso a modulos (rol_modulo), delegaciones por persona que ya
-- funcionan de punta a punta, y el reporte de jornada para los roles consultivos. Corre con:
-- supabase test db
--
-- Reemplaza a auditoria_rol_permiso.sql: rol_permiso dejo de escribirse desde la aplicacion, y lo
-- que ahora concede la matriz son modulos.
--
-- Mismo patron que el resto de las suites: los fixtures se insertan como el rol dueno (exento de
-- RLS) y despues SET LOCAL ROLE authenticated + SET LOCAL request.jwt.claim.sub simula cada perfil.
-- Una lectura denegada no lanza, devuelve cero filas; un INSERT denegado lanza 42501.
--
-- Ningun dato real: personas, donantes, jornadas y gastos son inventados.

BEGIN;

SELECT plan(24);

-- Desde la 00169 toda jornada nueva lleva proyecto. Estas pruebas no tratan de proyectos: sus
-- jornadas reciben uno de prueba como DEFAULT de la columna, que el ROLLBACK del final deshace.
INSERT INTO proyectos (id, nombre) VALUES
  ('5f000000-0000-0000-0000-000000000169', 'Proyecto de prueba 00169');
ALTER TABLE jornadas ALTER COLUMN proyecto_id SET DEFAULT '5f000000-0000-0000-0000-000000000169';

-- Desde la 00178 toda jornada nueva lleva una bodega movil. Estas pruebas no tratan de bodegas:
-- sus jornadas reciben una de prueba como DEFAULT de la columna, que el ROLLBACK del final deshace.
INSERT INTO bodegas (id, nombre, es_movil) VALUES
  ('5b000000-0000-0000-0000-000000000178', 'Bodega movil de prueba 00178', TRUE);
ALTER TABLE jornadas ALTER COLUMN botiquin_bodega_id SET DEFAULT '5b000000-0000-0000-0000-000000000178';

-- ============================================================================
-- Setup
-- ============================================================================
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000148001', 'admin148@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000148002', 'voluntario148@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000148003', 'junta148@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000148004', 'medico148@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000148005', 'otro148@test.ecopac.local');

ALTER TABLE perfiles DISABLE TRIGGER USER;
UPDATE perfiles SET rol = 'administrador'   WHERE id = '00000000-0000-0000-0000-000000148001';
UPDATE perfiles SET rol = 'junta directiva' WHERE id = '00000000-0000-0000-0000-000000148003';
UPDATE perfiles SET rol = 'medico'          WHERE id = '00000000-0000-0000-0000-000000148004';
-- 148002 y 148005 se quedan con el rol por defecto (voluntario general).
ALTER TABLE perfiles ENABLE TRIGGER USER;

INSERT INTO comunidades (id, municipio_id, nombre) VALUES
  ('10000000-0000-0000-0000-000000148001', 101, 'Comunidad 148');

INSERT INTO donantes (id, nombre, tipo) VALUES
  ('d0000000-0000-0000-0000-000000148001', 'Donante 148', 'persona');

INSERT INTO donaciones (id, donante_id, tipo) VALUES
  ('d1000000-0000-0000-0000-000000148001', 'd0000000-0000-0000-0000-000000148001', 'dinero');

-- Una jornada en la que no participa nadie de los perfiles de prueba, con un gasto.
-- Con presupuesto: desde la 00159 un gasto no pasa el de su jornada.
INSERT INTO jornadas (id, nombre, fecha, comunidad_id, responsable_id, estado, presupuesto_asignado) VALUES
  ('30000000-0000-0000-0000-000000148001', 'Jornada 148', CURRENT_DATE + 10,
   '10000000-0000-0000-0000-000000148001', '00000000-0000-0000-0000-000000148001', 'planificada', 1000);

INSERT INTO gastos (id, jornada_id, concepto, categoria, monto, registrado_por) VALUES
  ('6a000000-0000-0000-0000-000000148001', '30000000-0000-0000-0000-000000148001',
   'Transporte 148', 'Logistica', 100, '00000000-0000-0000-0000-000000148001');

INSERT INTO pacientes (id, nombres, apellidos, fecha_nacimiento, sexo, comunidad_id, idioma) VALUES
  ('20000000-0000-0000-0000-000000148001', 'Uno', 'Inventado', '1990-01-01', 'Femenino',
   '10000000-0000-0000-0000-000000148001', 'espanol');

SET LOCAL ROLE authenticated;

-- ============================================================================
-- Abrir un modulo desde la matriz: lectura si, escritura no
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000148002';

SELECT is(
  (SELECT count(*)::int FROM donaciones), 0,
  'el colaborador no lee donaciones: no es un modulo suyo'
);

SELECT throws_ok(
  $$ INSERT INTO rol_modulo (rol, modulo) VALUES ('voluntario general', 'donaciones') $$,
  '42501', NULL,
  'el colaborador no se abre modulos a si mismo: solo la administradora escribe la matriz'
);

SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000148001';

SELECT lives_ok(
  $$ INSERT INTO rol_modulo (id, rol, modulo)
     VALUES ('e0000000-0000-0000-0000-000000148001', 'voluntario general', 'donaciones') $$,
  'la administradora abre Donaciones al rol colaborador'
);

SELECT is(
  (SELECT realizado_por FROM eventos_auditoria
    WHERE tabla_afectada = 'rol_modulo'
      AND fila_id = 'e0000000-0000-0000-0000-000000148001'
      AND operacion = 'insercion'),
  '00000000-0000-0000-0000-000000148001'::UUID,
  'la concesion queda en la bitacora, con quien la hizo'
);

SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000148002';

SELECT is(
  (SELECT count(*)::int FROM donaciones WHERE id = 'd1000000-0000-0000-0000-000000148001'), 1,
  'con el modulo abierto, el colaborador lee las donaciones'
);

SELECT throws_ok(
  $$ INSERT INTO donantes (nombre, tipo) VALUES ('Intento 148', 'persona') $$,
  '42501', NULL,
  'pero no registra: abrir un modulo desde la matriz es de solo lectura'
);

SELECT ok(
  (SELECT mis_accesos() -> 'modulos') ? 'donaciones',
  'mis_accesos() le devuelve el modulo abierto, para que el cliente dibuje su menu'
);

SELECT ok(
  (SELECT mis_accesos() -> 'permisos') ? 'pacientes.editar',
  'y sus permisos efectivos: el colaborador trae pacientes.editar por defecto (00148)'
);

SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000148001';

SELECT lives_ok(
  $$ DELETE FROM rol_modulo WHERE id = 'e0000000-0000-0000-0000-000000148001' $$,
  'la administradora vuelve a cerrar el modulo'
);

SELECT is(
  (SELECT count(*)::int FROM eventos_auditoria
    WHERE tabla_afectada = 'rol_modulo'
      AND fila_id = 'e0000000-0000-0000-0000-000000148001'
      AND operacion = 'eliminacion'),
  1,
  'y el retiro tambien queda en la bitacora'
);

SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000148002';

SELECT is(
  (SELECT count(*)::int FROM donaciones), 0,
  'cerrado el modulo, el colaborador deja de leer donaciones'
);

-- ============================================================================
-- Lo que la matriz no acepta
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000148001';

SELECT throws_ok(
  $$ INSERT INTO rol_modulo (rol, modulo) VALUES ('voluntario general', 'pacientes') $$,
  '23514', NULL,
  'un modulo que el rol ya tiene por defecto no se concede'
);

SELECT throws_ok(
  $$ INSERT INTO rol_modulo (rol, modulo) VALUES ('administrador', 'donaciones') $$,
  '23514', NULL,
  'a la administradora no se le concede nada: ya lo tiene todo'
);

SELECT throws_ok(
  $$ INSERT INTO rol_modulo (rol, modulo) VALUES ('medico', 'matriz-permisos') $$,
  '23514', NULL,
  'la matriz y la bitacora se quedan siempre en la administradora'
);

-- ============================================================================
-- Un rol consultivo con Pacientes abierto: lee, no escribe
-- ============================================================================
INSERT INTO rol_modulo (rol, modulo) VALUES ('junta directiva', 'pacientes');

SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000148003';

SELECT ok(
  (SELECT count(*) FROM pacientes) > 0,
  'junta directiva con Pacientes abierto lee pacientes'
);

SELECT throws_ok(
  $$ INSERT INTO pacientes (nombres, apellidos, fecha_nacimiento, sexo, comunidad_id, idioma)
     VALUES ('Dos', 'Inventado', '1991-01-01', 'Masculino',
             '10000000-0000-0000-0000-000000148001', 'espanol') $$,
  '42501', NULL,
  'pero no registra pacientes'
);

-- ============================================================================
-- Reporte de jornada para los roles consultivos (fn_reporte_jornada)
-- ============================================================================
SELECT ok(
  (SELECT fn_reporte_jornada('30000000-0000-0000-0000-000000148001') -> 'resumen') IS NOT NULL,
  'junta directiva consulta el reporte de una jornada, ya agregado en la base'
);

SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000148002';

SELECT throws_ok(
  $$ SELECT fn_reporte_jornada('30000000-0000-0000-0000-000000148001') $$,
  '42501', NULL,
  'el colaborador no llega al reporte de jornada: Reportes no es un modulo suyo'
);

-- ============================================================================
-- Delegar por persona: nadie se concede permisos a si mismo
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000148001';

INSERT INTO usuario_permiso (perfil_id, permiso_id, concedido, otorgado_por)
SELECT '00000000-0000-0000-0000-000000148002', id, true, '00000000-0000-0000-0000-000000148001'
FROM permisos WHERE clave IN ('usuarios.gestionar_permisos', 'jornadas.gestionar', 'presupuestos.aprobar');

SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000148002';

SELECT throws_ok(
  $$ INSERT INTO usuario_permiso (perfil_id, permiso_id, concedido)
     SELECT '00000000-0000-0000-0000-000000148002', id, true
     FROM permisos WHERE clave = 'donaciones.registrar' $$,
  '42501', NULL,
  'quien gestiona permisos no se concede uno a si mismo'
);

SELECT lives_ok(
  $$ INSERT INTO usuario_permiso (perfil_id, permiso_id, concedido)
     SELECT '00000000-0000-0000-0000-000000148005', id, true
     FROM permisos WHERE clave = 'pacientes.editar' $$,
  'pero si gestiona los de otra persona'
);

-- ============================================================================
-- Las delegaciones leen lo que necesitan
-- ============================================================================
SELECT is(
  (SELECT count(*)::int FROM jornadas WHERE id = '30000000-0000-0000-0000-000000148001'), 1,
  'con jornadas.gestionar ve una jornada en la que no participa'
);

SELECT is(
  (SELECT count(*)::int FROM gastos WHERE id = '6a000000-0000-0000-0000-000000148001'), 1,
  'con presupuestos.aprobar ve el gasto que tiene que aprobar'
);

SELECT ok(
  (SELECT count(*) FROM perfiles_directorio) > 1,
  'y el directorio del personal, para armar el equipo de una jornada'
);

SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000148004';

SELECT is(
  (SELECT count(*)::int FROM gastos WHERE id = '6a000000-0000-0000-0000-000000148001'), 0,
  'el medico sin delegacion no ve gastos de una jornada en la que no participa'
);

SELECT * FROM finish();
ROLLBACK;
