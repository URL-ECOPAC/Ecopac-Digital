-- Pruebas de la 00166: el principio activo de un medicamento se puede cambiar.
-- Corre con: supabase test db
--
-- Ningun dato real: los articulos y principios son inventados.

BEGIN;

SELECT plan(9);

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000016601', 'admin166@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000016602', 'medico166@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000016603', 'junta166@test.ecopac.local');
ALTER TABLE perfiles DISABLE TRIGGER USER;
UPDATE perfiles SET rol = 'administrador' WHERE id = '00000000-0000-0000-0000-000000016601';
UPDATE perfiles SET rol = 'medico' WHERE id = '00000000-0000-0000-0000-000000016602';
UPDATE perfiles SET rol = 'junta directiva' WHERE id = '00000000-0000-0000-0000-000000016603';
ALTER TABLE perfiles ENABLE TRIGGER USER;

INSERT INTO principios_activos (id, nombre) VALUES
  ('00000000-0000-0000-0000-0000000166a1', 'Principio Uno 166'),
  ('00000000-0000-0000-0000-0000000166a2', 'Principio Dos 166'),
  ('00000000-0000-0000-0000-0000000166a3', 'Principio Tres 166');

INSERT INTO medicamentos (id, nombre, concentracion, presentacion_id, marca, tipo_articulo) VALUES
  ('00000000-0000-0000-0000-0000000166b1', 'Medicamento 166', '500 mg',
   (SELECT id FROM presentaciones ORDER BY nombre LIMIT 1), 'Generico', 'medicamento'),
  ('00000000-0000-0000-0000-0000000166b2', 'Insumo 166', NULL,
   (SELECT id FROM presentaciones ORDER BY nombre LIMIT 1), 'Generico', 'insumo');

INSERT INTO medicamento_principio (medicamento_id, principio_id) VALUES
  ('00000000-0000-0000-0000-0000000166b1', '00000000-0000-0000-0000-0000000166a1'),
  -- Un insumo dado de alta como medicamento antes de la 00164 se quedo con su principio.
  ('00000000-0000-0000-0000-0000000166b2', '00000000-0000-0000-0000-0000000166a1');

SET LOCAL ROLE authenticated;

-- ============================================================================
-- Administracion
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000016601';

SELECT lives_ok(
  $$ SELECT fn_cambiar_principio_de_medicamento('00000000-0000-0000-0000-0000000166b1',
       '00000000-0000-0000-0000-0000000166a2') $$,
  'la administracion cambia el principio activo de un medicamento'
);

SELECT results_eq(
  $$ SELECT principio_id FROM medicamento_principio
      WHERE medicamento_id = '00000000-0000-0000-0000-0000000166b1' $$,
  $$ VALUES ('00000000-0000-0000-0000-0000000166a2'::UUID) $$,
  'y queda con el nuevo, sin el anterior'
);

SELECT lives_ok(
  $$ SELECT fn_cambiar_principio_de_medicamento('00000000-0000-0000-0000-0000000166b1',
       '00000000-0000-0000-0000-0000000166a2') $$,
  'volver a poner el mismo no falla'
);

SELECT throws_ok(
  $$ SELECT fn_cambiar_principio_de_medicamento('00000000-0000-0000-0000-0000000166b1', NULL) $$,
  '23514', NULL,
  'un medicamento no se queda sin principio activo'
);

SELECT lives_ok(
  $$ SELECT fn_cambiar_principio_de_medicamento('00000000-0000-0000-0000-0000000166b2', NULL) $$,
  'a un insumo se le quitan los principios'
);

SELECT is(
  (SELECT count(*)::INT FROM medicamento_principio
    WHERE medicamento_id = '00000000-0000-0000-0000-0000000166b2'),
  0,
  'y queda sin ninguno (00164)'
);

-- ============================================================================
-- Personal de campo: lo cambia, como lo asocia al dar de alta (00148)
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000016602';

SELECT lives_ok(
  $$ SELECT fn_cambiar_principio_de_medicamento('00000000-0000-0000-0000-0000000166b1',
       '00000000-0000-0000-0000-0000000166a3') $$,
  'el medico cambia el principio activo'
);

-- ============================================================================
-- Rol consultivo: no
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000016603';

SELECT throws_ok(
  $$ SELECT fn_cambiar_principio_de_medicamento('00000000-0000-0000-0000-0000000166b1',
       '00000000-0000-0000-0000-0000000166a1') $$,
  '42501', NULL,
  'la junta directiva no cambia el principio activo'
);

RESET ROLE;
SELECT results_eq(
  $$ SELECT principio_id FROM medicamento_principio
      WHERE medicamento_id = '00000000-0000-0000-0000-0000000166b1' $$,
  $$ VALUES ('00000000-0000-0000-0000-0000000166a3'::UUID) $$,
  'y el medicamento sigue con el que puso el medico'
);

SELECT * FROM finish();
ROLLBACK;
