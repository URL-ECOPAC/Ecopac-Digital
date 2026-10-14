-- Pruebas de la 00172: un proyecto finalizado tampoco se modifica. Corre con:
-- supabase test db
--
-- Mismo patron que proyecto_cancelado_solo_lectura.sql: fixtures como postgres y despues SET LOCAL
-- ROLE authenticated como la administradora, que por RLS si puede escribir todo esto. Lo que la
-- frena aqui es el estado del proyecto, no el rol.

BEGIN;

SELECT plan(10);

-- Desde la 00178 toda jornada nueva lleva una bodega movil. Estas pruebas no tratan de bodegas:
-- sus jornadas reciben una de prueba como DEFAULT de la columna, que el ROLLBACK del final deshace.
INSERT INTO bodegas (id, nombre, es_movil) VALUES
  ('5b000000-0000-0000-0000-000000000178', 'Bodega movil de prueba 00178', TRUE);
ALTER TABLE jornadas ALTER COLUMN botiquin_bodega_id SET DEFAULT '5b000000-0000-0000-0000-000000000178';

-- ============================================================================
-- Setup
-- ============================================================================
INSERT INTO comunidades (id, municipio_id, nombre) VALUES
  ('10000000-0000-0000-0000-000000001721', 101, 'Comunidad de prueba 1721');

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000017211', 'admin1721@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000017212', 'persona1721@test.ecopac.local');

ALTER TABLE perfiles DISABLE TRIGGER USER;
UPDATE perfiles SET rol = 'administrador' WHERE id = '00000000-0000-0000-0000-000000017211';
UPDATE perfiles SET rol = 'medico'        WHERE id = '00000000-0000-0000-0000-000000017212';
ALTER TABLE perfiles ENABLE TRIGGER USER;

-- 1721: el proyecto que se finaliza. 1722: uno abierto, de donde sale la jornada 1722.
INSERT INTO proyectos (id, nombre, estado) VALUES
  ('50000000-0000-0000-0000-000000001721', 'Proyecto que se cierra 1721', 'en curso'),
  ('50000000-0000-0000-0000-000000001722', 'Proyecto abierto 1722', 'planificado');

INSERT INTO jornadas (id, nombre, fecha, comunidad_id, responsable_id, proyecto_id) VALUES
  ('40000000-0000-0000-0000-000000001721', 'Jornada del cerrado 1721', CURRENT_DATE + 30,
   '10000000-0000-0000-0000-000000001721', '00000000-0000-0000-0000-000000017211',
   '50000000-0000-0000-0000-000000001721'),
  ('40000000-0000-0000-0000-000000001722', 'Jornada de otro proyecto 1722', CURRENT_DATE + 30,
   '10000000-0000-0000-0000-000000001721', '00000000-0000-0000-0000-000000017211',
   '50000000-0000-0000-0000-000000001722');

INSERT INTO proyecto_hitos (id, proyecto_id, nombre, fecha_prevista) VALUES
  ('b0000000-0000-0000-0000-000000001721', '50000000-0000-0000-0000-000000001721',
   'Hito 1721', CURRENT_DATE + 10);

-- ============================================================================
-- Finalizar sigue funcionando
-- ============================================================================
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000017211';

SELECT lives_ok(
  $$ UPDATE proyectos SET estado = 'finalizado' WHERE id = '50000000-0000-0000-0000-000000001721' $$,
  'finalizar un proyecto en curso sigue funcionando'
);

-- ============================================================================
-- El proyecto finalizado no se modifica
-- ============================================================================
SELECT throws_ok(
  $$ UPDATE proyectos SET nombre = 'Otro nombre' WHERE id = '50000000-0000-0000-0000-000000001721' $$,
  '55000', 'El proyecto esta finalizado: ya no se puede modificar.',
  'no se cambia el nombre de un proyecto finalizado'
);

SELECT throws_ok(
  $$ UPDATE proyectos SET porcentaje_avance = 50 WHERE id = '50000000-0000-0000-0000-000000001721' $$,
  '55000', NULL,
  'no se mueve el avance de un proyecto finalizado'
);

SELECT throws_ok(
  $$ INSERT INTO proyecto_seguimiento (proyecto_id, nota)
     VALUES ('50000000-0000-0000-0000-000000001721', 'Nota tardia') $$,
  '55000', NULL,
  'no se anota en la bitacora de un proyecto finalizado'
);

SELECT throws_ok(
  $$ UPDATE proyecto_hitos SET fecha_real = CURRENT_DATE WHERE id = 'b0000000-0000-0000-0000-000000001721' $$,
  '55000', NULL,
  'no se marca cumplido un hito de un proyecto finalizado'
);

SELECT throws_ok(
  $$ INSERT INTO proyecto_personal (proyecto_id, perfil_id)
     VALUES ('50000000-0000-0000-0000-000000001721', '00000000-0000-0000-0000-000000017212') $$,
  '55000', NULL,
  'no se agrega a nadie al equipo de un proyecto finalizado'
);

SELECT throws_ok(
  $$ UPDATE jornadas SET proyecto_id = '50000000-0000-0000-0000-000000001721'
      WHERE id = '40000000-0000-0000-0000-000000001722' $$,
  '55000', NULL,
  'no se pasa una jornada a un proyecto finalizado'
);

SELECT lives_ok(
  $$ UPDATE jornadas SET nombre = 'Jornada renombrada 1721'
      WHERE id = '40000000-0000-0000-0000-000000001721' $$,
  'la jornada de un proyecto finalizado se sigue editando si no cambia de proyecto'
);

-- ============================================================================
-- Un proyecto abierto no se bloquea, y el cancelado sigue como en la 00154
-- ============================================================================
SELECT lives_ok(
  $$ UPDATE proyectos SET nombre = 'Proyecto abierto renombrado 1722' WHERE id = '50000000-0000-0000-0000-000000001722' $$,
  'un proyecto planificado se sigue editando'
);

SELECT throws_ok(
  $$ UPDATE proyectos SET estado = 'en curso' WHERE id = '50000000-0000-0000-0000-000000001721' $$,
  NULL, NULL,
  'un proyecto finalizado no se reabre'
);

SELECT * FROM finish();
ROLLBACK;
