-- Pruebas de las funciones en lote presupuestos_de_proyectos()/presupuestos_de_jornadas()
-- (issue #771, migracion 00123). Corre con: supabase test db
--
-- No repite las pruebas de RLS de gastos ni de jornadas/proyectos (ya cubiertas en
-- politicas_rls_gastos.sql y politicas_rls_jornadas_proyectos.sql): esta suite verifica que la
-- version en lote agrega exactamente igual que la version de un solo id
-- (00040_funciones_presupuesto.sql), y el contrato distinto que documenta la 00123: un proyecto
-- sin jornadas visibles, o un id que no existe, no genera fila -- a diferencia de
-- presupuesto_de_proyecto(), que siempre devuelve una fila en ceros.

BEGIN;

SELECT plan(6);

-- ============================================================================
-- Setup: un administrador, dos proyectos (uno con dos jornadas y gastos, uno sin ninguna
-- jornada), y una jornada suelta sin proyecto para presupuestos_de_jornadas().
-- ============================================================================
INSERT INTO comunidades (id, municipio_id, nombre) VALUES
  ('10000000-0000-0000-0000-000000000759', 101, 'Comunidad de prueba 759');

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000075901', 'admin759@test.ecopac.local');

ALTER TABLE perfiles DISABLE TRIGGER USER;
UPDATE perfiles SET rol = 'administrador' WHERE id = '00000000-0000-0000-0000-000000075901';
ALTER TABLE perfiles ENABLE TRIGGER USER;

INSERT INTO proyectos (id, nombre, responsable_id) VALUES
  ('20000000-0000-0000-0000-000000075901', 'Proyecto con jornadas 759',
   '00000000-0000-0000-0000-000000075901'),
  ('20000000-0000-0000-0000-000000075902', 'Proyecto sin jornadas 759',
   '00000000-0000-0000-0000-000000075901');

INSERT INTO jornadas (id, nombre, fecha, comunidad_id, responsable_id, proyecto_id, presupuesto_asignado) VALUES
  ('40000000-0000-0000-0000-000000075901', 'Jornada A 759', CURRENT_DATE + 10,
   '10000000-0000-0000-0000-000000000759', '00000000-0000-0000-0000-000000075901',
   '20000000-0000-0000-0000-000000075901', 1000.00),
  ('40000000-0000-0000-0000-000000075902', 'Jornada B 759', CURRENT_DATE + 11,
   '10000000-0000-0000-0000-000000000759', '00000000-0000-0000-0000-000000075901',
   '20000000-0000-0000-0000-000000075901', 500.00),
  ('40000000-0000-0000-0000-000000075903', 'Jornada suelta 759', CURRENT_DATE + 12,
   '10000000-0000-0000-0000-000000000759', '00000000-0000-0000-0000-000000075901',
   NULL, 300.00);

INSERT INTO gastos (jornada_id, concepto, categoria, monto, estado, registrado_por) VALUES
  ('40000000-0000-0000-0000-000000075901', 'Gasto A aprobado', 'Medicamentos', 200.00, 'aprobado',
   '00000000-0000-0000-0000-000000075901'),
  ('40000000-0000-0000-0000-000000075902', 'Gasto B aprobado', 'Logistica', 50.00, 'aprobado',
   '00000000-0000-0000-0000-000000075901');

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000075901';

-- ============================================================================
-- 1-2. presupuestos_de_proyectos() agrega igual que presupuesto_de_proyecto() por id
-- ============================================================================
SELECT is(
  (SELECT (asignado, gastado, disponible, pendiente)
   FROM presupuestos_de_proyectos(ARRAY['20000000-0000-0000-0000-000000075901'::uuid])
   WHERE proyecto_id = '20000000-0000-0000-0000-000000075901'),
  (SELECT (asignado, gastado, disponible, pendiente)
   FROM presupuesto_de_proyecto('20000000-0000-0000-0000-000000075901')),
  'presupuestos_de_proyectos() agrega el proyecto exactamente igual que presupuesto_de_proyecto()'
);

SELECT ok(
  (SELECT gastado FROM presupuestos_de_proyectos(ARRAY['20000000-0000-0000-0000-000000075901'::uuid])
   WHERE proyecto_id = '20000000-0000-0000-0000-000000075901') = 250.00,
  'el gastado del proyecto en lote suma los gastos aprobados de sus dos jornadas'
);

-- ============================================================================
-- 3. Un proyecto sin jornadas no genera fila en la version en lote (a diferencia de la version
--    de un solo id, que devuelve una fila en ceros)
-- ============================================================================
SELECT is_empty(
  $$ SELECT 1 FROM presupuestos_de_proyectos(
       ARRAY['20000000-0000-0000-0000-000000075902'::uuid]
     ) WHERE proyecto_id = '20000000-0000-0000-0000-000000075902' $$,
  'un proyecto sin jornadas no genera fila en presupuestos_de_proyectos() (contrato distinto al de un solo id)'
);

SELECT ok(
  (SELECT asignado FROM presupuesto_de_proyecto('20000000-0000-0000-0000-000000075902')) = 0,
  'ese mismo proyecto sin jornadas si devuelve una fila en ceros por presupuesto_de_proyecto()'
);

-- ============================================================================
-- 4-5. presupuestos_de_jornadas() agrega igual que presupuesto_de_jornada() por id, y una
--      jornada que no existe no genera fila
-- ============================================================================
SELECT is(
  (SELECT (asignado, gastado, disponible, pendiente)
   FROM presupuestos_de_jornadas(ARRAY['40000000-0000-0000-0000-000000075901'::uuid])
   WHERE jornada_id = '40000000-0000-0000-0000-000000075901'),
  (SELECT (asignado, gastado, disponible, pendiente)
   FROM presupuesto_de_jornada('40000000-0000-0000-0000-000000075901')),
  'presupuestos_de_jornadas() agrega la jornada exactamente igual que presupuesto_de_jornada()'
);

SELECT is_empty(
  $$ SELECT 1 FROM presupuestos_de_jornadas(
       ARRAY['ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid]
     ) $$,
  'un id de jornada que no existe no genera fila en presupuestos_de_jornadas()'
);

SELECT * FROM finish();
ROLLBACK;
