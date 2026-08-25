-- Pruebas de las politicas RLS de gastos (issue #292, migracion 00052). Corre con:
-- supabase test db
--
-- Mismo patron que las suites de #87/#88/#90: SET LOCAL ROLE authenticated +
-- SET LOCAL request.jwt.claim.sub simula un usuario de cada rol. Los fixtures se
-- insertan como postgres (superusuario, bypasea RLS) antes de impersonar.

BEGIN;

SELECT plan(21);

-- ============================================================================
-- Setup: una comunidad, un usuario de cada rol, dos jornadas (A con medico y
-- voluntario asignados, B sin nadie asignado).
-- ============================================================================
INSERT INTO comunidades (id, municipio_id, nombre) VALUES
  ('10000000-0000-0000-0000-000000000292', 101, 'Comunidad de prueba 292');

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000029201', 'admin292@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000029202', 'junta292@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000029203', 'socio292@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000029204', 'medico292@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000029205', 'voluntario292@test.ecopac.local');

-- DISABLE TRIGGER USER (no un nombre puntual): mismo criterio defensivo que #88/#90.
ALTER TABLE perfiles DISABLE TRIGGER USER;

UPDATE perfiles SET rol = 'administrador' WHERE id = '00000000-0000-0000-0000-000000029201';
UPDATE perfiles SET rol = 'junta directiva' WHERE id = '00000000-0000-0000-0000-000000029202';
UPDATE perfiles SET rol = 'socio fundador' WHERE id = '00000000-0000-0000-0000-000000029203';
UPDATE perfiles SET rol = 'medico' WHERE id = '00000000-0000-0000-0000-000000029204';
-- voluntario292 se queda con el rol por defecto (voluntario general).

ALTER TABLE perfiles ENABLE TRIGGER USER;

-- responsable_id NOT NULL (00012); fecha futura por el check de 00012.
INSERT INTO jornadas (id, nombre, fecha, comunidad_id, responsable_id) VALUES
  ('40000000-0000-0000-0000-000000029201', 'Jornada asignada 292', CURRENT_DATE + 30,
   '10000000-0000-0000-0000-000000000292', '00000000-0000-0000-0000-000000029201'),
  ('40000000-0000-0000-0000-000000029202', 'Jornada libre 292', CURRENT_DATE + 31,
   '10000000-0000-0000-0000-000000000292', '00000000-0000-0000-0000-000000029201');

INSERT INTO jornada_personal (jornada_id, perfil_id, rol_en_jornada, hora_inicio, hora_fin) VALUES
  ('40000000-0000-0000-0000-000000029201', '00000000-0000-0000-0000-000000029204', 'medico', '08:00', '13:00'),
  ('40000000-0000-0000-0000-000000029201', '00000000-0000-0000-0000-000000029205', 'voluntario general', '08:00', '13:00');

-- ============================================================================
-- administrador
-- ============================================================================
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000029201';

SELECT lives_ok(
  $$ INSERT INTO gastos (id, jornada_id, concepto, categoria, monto, registrado_por)
     VALUES ('60000000-0000-0000-0000-000000029201', '40000000-0000-0000-0000-000000029201',
             'Gasa y algodon', 'Medicamentos', 100.00, '00000000-0000-0000-0000-000000029201') $$,
  'administrador registra un gasto en la jornada asignada'
);

SELECT lives_ok(
  $$ INSERT INTO gastos (id, jornada_id, concepto, categoria, monto, registrado_por)
     VALUES ('60000000-0000-0000-0000-000000029202', '40000000-0000-0000-0000-000000029202',
             'Combustible', 'Logistica', 75.00, '00000000-0000-0000-0000-000000029201') $$,
  'administrador registra un gasto en una jornada sin personal asignado'
);

SELECT ok(
  (SELECT count(*) FROM gastos) = 2,
  'administrador lee todos los gastos'
);

SELECT lives_ok(
  $$ UPDATE gastos SET estado = 'aprobado', aprobado_por = '00000000-0000-0000-0000-000000029201',
       fecha_aprobacion = NOW()
     WHERE id = '60000000-0000-0000-0000-000000029201' $$,
  'administrador aprueba el gasto que el mismo registro (issue #410)'
);

SELECT throws_ok(
  $$ UPDATE gastos SET concepto = 'Intento de editar' WHERE id = '60000000-0000-0000-0000-000000029201' $$,
  'P0001',
  NULL,
  'un gasto aprobado ya no se puede modificar, ni siquiera por administrador'
);

-- Sin GRANT de DELETE para ningun rol: muere por privilegio antes de llegar al
-- trigger de inmutabilidad, mismo criterio que movimientos_inventario (00023/00034).
SELECT throws_ok(
  $$ DELETE FROM gastos WHERE id = '60000000-0000-0000-0000-000000029201' $$,
  '42501',
  NULL,
  'nadie puede eliminar un gasto: no hay GRANT de DELETE'
);

SELECT ok(
  (SELECT gastado FROM presupuesto_de_jornada('40000000-0000-0000-0000-000000029201')) = 100.00,
  'presupuesto_de_jornada refleja el gasto aprobado'
);

-- ============================================================================
-- junta directiva: lectura de gastos, nada mas
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000029202';

SELECT ok(
  (SELECT count(*) FROM gastos) = 2,
  'junta directiva lee todos los gastos'
);

SELECT throws_ok(
  $$ INSERT INTO gastos (jornada_id, concepto, categoria, monto, registrado_por)
     VALUES ('40000000-0000-0000-0000-000000029202', 'Intento de junta', 'Honorarios', 10.00,
             '00000000-0000-0000-0000-000000029202') $$,
  '42501',
  NULL,
  'junta directiva no puede registrar gastos'
);

SELECT is_empty(
  $$ UPDATE gastos SET estado = 'rechazado'
     WHERE id = '60000000-0000-0000-0000-000000029202' RETURNING id $$,
  'junta directiva no puede aprobar ni rechazar gastos'
);

-- ============================================================================
-- socio fundador: lectura de gastos, nada mas
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000029203';

SELECT ok(
  (SELECT count(*) FROM gastos) = 2,
  'socio fundador lee todos los gastos'
);

SELECT throws_ok(
  $$ INSERT INTO gastos (jornada_id, concepto, categoria, monto, registrado_por)
     VALUES ('40000000-0000-0000-0000-000000029202', 'Intento de socio', 'Honorarios', 10.00,
             '00000000-0000-0000-0000-000000029203') $$,
  '42501',
  NULL,
  'socio fundador no puede registrar gastos'
);

-- ============================================================================
-- medico: asignado a la jornada A, registra gastos propios pendientes de esa
-- jornada; no lee ni registra los de la jornada B; no aprueba.
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000029204';

SELECT ok(
  (SELECT count(*) FROM gastos) = 1,
  'medico lee solo los gastos de su jornada asignada'
);

SELECT lives_ok(
  $$ INSERT INTO gastos (id, jornada_id, concepto, categoria, monto, registrado_por)
     VALUES ('60000000-0000-0000-0000-000000029203', '40000000-0000-0000-0000-000000029201',
             'Guantes', 'Medicamentos', 20.00, '00000000-0000-0000-0000-000000029204') $$,
  'medico registra un gasto pendiente en su jornada asignada'
);

SELECT throws_ok(
  $$ INSERT INTO gastos (jornada_id, concepto, categoria, monto, registrado_por)
     VALUES ('40000000-0000-0000-0000-000000029202', 'Fuera de jornada', 'Logistica', 20.00,
             '00000000-0000-0000-0000-000000029204') $$,
  '42501',
  NULL,
  'medico no puede registrar gastos en una jornada donde no esta asignado'
);

SELECT throws_ok(
  $$ INSERT INTO gastos (jornada_id, concepto, categoria, monto, estado, registrado_por)
     VALUES ('40000000-0000-0000-0000-000000029201', 'Ya aprobado', 'Logistica', 20.00, 'aprobado',
             '00000000-0000-0000-0000-000000029204') $$,
  '42501',
  NULL,
  'medico no puede registrar un gasto ya aprobado'
);

SELECT throws_ok(
  $$ INSERT INTO gastos (jornada_id, concepto, categoria, monto, registrado_por)
     VALUES ('40000000-0000-0000-0000-000000029201', 'A nombre de otro', 'Logistica', 20.00,
             '00000000-0000-0000-0000-000000029205') $$,
  '42501',
  NULL,
  'medico no puede registrar un gasto a nombre de otra persona'
);

SELECT is_empty(
  $$ UPDATE gastos SET estado = 'aprobado'
     WHERE id = '60000000-0000-0000-0000-000000029203' RETURNING id $$,
  'medico no puede aprobar sus propios gastos'
);

-- ============================================================================
-- voluntario general: mismo criterio que medico, asignado a la jornada A.
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000029205';

SELECT ok(
  (SELECT count(*) FROM gastos) = 2,
  'voluntario lee los gastos de su jornada asignada (el de administrador y el propio de medico)'
);

SELECT lives_ok(
  $$ INSERT INTO gastos (jornada_id, concepto, categoria, monto, registrado_por)
     VALUES ('40000000-0000-0000-0000-000000029201', 'Refrigerio', 'Logistica', 15.00,
             '00000000-0000-0000-0000-000000029205') $$,
  'voluntario registra un gasto pendiente en su jornada asignada'
);

SELECT throws_ok(
  $$ INSERT INTO gastos (jornada_id, concepto, categoria, monto, registrado_por)
     VALUES ('40000000-0000-0000-0000-000000029202', 'Fuera de jornada', 'Logistica', 15.00,
             '00000000-0000-0000-0000-000000029205') $$,
  '42501',
  NULL,
  'voluntario no puede registrar gastos fuera de su jornada asignada'
);

SELECT * FROM finish();
ROLLBACK;
