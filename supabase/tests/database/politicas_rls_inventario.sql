-- Pruebas de las politicas RLS del modulo de inventario (issue #91). Corre con:
-- supabase test db
--
-- Mismo patron que las suites de #87/#88/#89: SET LOCAL ROLE authenticated + SET
-- LOCAL request.jwt.claim.sub simula cada rol.

BEGIN;

SELECT plan(22);

-- ============================================================================
-- Setup: dos administradores (uno aprueba por UPDATE lo que el mismo registro,
-- issue #410; el otro aprueba lo que registro un medico), un medico, un
-- voluntario, junta directiva, un medicamento y un lote con existencias.
-- ============================================================================
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000000301', 'admin91a@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000000302', 'admin91b@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000000303', 'medico91@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000000304', 'voluntario91@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000000305', 'junta91@test.ecopac.local');

ALTER TABLE perfiles DISABLE TRIGGER USER;

UPDATE perfiles SET rol = 'administrador' WHERE id = '00000000-0000-0000-0000-000000000301';
UPDATE perfiles SET rol = 'administrador' WHERE id = '00000000-0000-0000-0000-000000000302';
UPDATE perfiles SET rol = 'medico' WHERE id = '00000000-0000-0000-0000-000000000303';
UPDATE perfiles SET rol = 'junta directiva' WHERE id = '00000000-0000-0000-0000-000000000305';
-- voluntario91 se queda con el rol por defecto (voluntario general).

ALTER TABLE perfiles ENABLE TRIGGER USER;

INSERT INTO medicamentos (id, nombre, concentracion, presentacion, marca)
VALUES ('70000000-0000-0000-0000-000000000001', 'Paracetamol prueba 89', '500 mg', 'tableta', 'Generico');

INSERT INTO proveedores (id, nombre, tipo)
VALUES ('71000000-0000-0000-0000-000000000001', 'Proveedor prueba 91', 'comercial');

INSERT INTO bodegas (id, nombre)
VALUES ('72000000-0000-0000-0000-000000000001', 'Bodega prueba 91');

INSERT INTO lotes (id, medicamento_id, numero_lote, proveedor_id, origen, cantidad_ingresada, fecha_vencimiento)
VALUES ('80000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001',
        'LOTE-91', '71000000-0000-0000-0000-000000000001', 'compra', 100, CURRENT_DATE + 365);

INSERT INTO existencias (lote_id, bodega_id, cantidad_disponible)
VALUES ('80000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001', 100);

-- Fixture: un movimiento pendiente registrado por admin91a, insertado con los
-- triggers desactivados para poder probar por separado la aprobacion manual por
-- UPDATE (issue #410: un administrador si puede aprobar lo que el mismo registro)
-- sin que tr_autoaprobar_movimiento_inventario lo apruebe de entrada.
ALTER TABLE movimientos_inventario DISABLE TRIGGER USER;

INSERT INTO movimientos_inventario (id, tipo, lote_id, bodega_id, cantidad, motivo, estado, registrado_por)
VALUES (
  '90000000-0000-0000-0000-000000000001', 'ingreso', '80000000-0000-0000-0000-000000000001',
  '72000000-0000-0000-0000-000000000001',
  5, 'Fixture de administrador pendiente', 'pendiente', '00000000-0000-0000-0000-000000000301'
);

ALTER TABLE movimientos_inventario ENABLE TRIGGER USER;

-- ============================================================================
-- voluntario: lee el catalogo pero no lo administra
-- ============================================================================
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000304';

SELECT ok(
  (SELECT count(*) FROM medicamentos) > 0,
  'voluntario puede leer el catalogo de medicamentos'
);

SELECT throws_ok(
  $$ INSERT INTO medicamentos (nombre, concentracion, presentacion, marca)
     VALUES ('Intento voluntario', '1 mg', 'tableta', 'Generico') $$,
  '42501',
  NULL,
  'voluntario no puede crear un medicamento: solo administrador administra el catalogo'
);

-- ============================================================================
-- junta directiva: lectura de existencias, igual que cualquier autenticado (DoD)
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000305';

SELECT ok(
  (SELECT count(*) FROM existencias) > 0,
  'junta directiva (como cualquier autenticado) puede consultar existencias'
);

-- ============================================================================
-- medico: registra movimientos propios en pendiente
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000303';

SELECT lives_ok(
  $$ INSERT INTO movimientos_inventario (id, tipo, lote_id, bodega_id, cantidad, motivo, registrado_por)
     VALUES ('90000000-0000-0000-0000-000000000002', 'ingreso', '80000000-0000-0000-0000-000000000001',
             '72000000-0000-0000-0000-000000000001',
             10, 'Ingreso registrado por medico', '00000000-0000-0000-0000-000000000303') $$,
  'medico puede registrar un movimiento propio'
);

SELECT is(
  (SELECT estado::text FROM movimientos_inventario WHERE id = '90000000-0000-0000-0000-000000000002'),
  'pendiente',
  'el movimiento registrado por medico queda en estado pendiente'
);

SELECT throws_ok(
  $$ INSERT INTO movimientos_inventario (tipo, lote_id, bodega_id, cantidad, motivo, estado, registrado_por)
     VALUES ('ingreso', '80000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001',
             1, 'Intento de auto-aprobacion', 'aprobado', '00000000-0000-0000-0000-000000000303') $$,
  '42501',
  NULL,
  'medico no puede registrar un movimiento directamente en estado aprobado'
);

SELECT throws_ok(
  $$ INSERT INTO movimientos_inventario (tipo, lote_id, bodega_id, cantidad, motivo, registrado_por)
     VALUES ('ingreso', '80000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001',
             1, 'A nombre de otro perfil', '00000000-0000-0000-0000-000000000304') $$,
  '42501',
  NULL,
  'medico no puede registrar un movimiento a nombre de otro perfil'
);

-- ============================================================================
-- voluntario: registra su propio movimiento pendiente
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000304';

SELECT lives_ok(
  $$ INSERT INTO movimientos_inventario (id, tipo, lote_id, bodega_id, cantidad, motivo, registrado_por)
     VALUES ('90000000-0000-0000-0000-000000000003', 'ingreso', '80000000-0000-0000-0000-000000000001',
             '72000000-0000-0000-0000-000000000001',
             7, 'Ingreso registrado por voluntario', '00000000-0000-0000-0000-000000000304') $$,
  'voluntario puede registrar un movimiento propio'
);

-- ============================================================================
-- administrador (admin91a): registra y nace aprobado automaticamente (issue #294)
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000301';

SELECT lives_ok(
  $$ INSERT INTO movimientos_inventario (id, tipo, lote_id, bodega_id, cantidad, motivo, registrado_por)
     VALUES ('90000000-0000-0000-0000-000000000004', 'ingreso', '80000000-0000-0000-0000-000000000001',
             '72000000-0000-0000-0000-000000000001',
             20, 'Ingreso registrado por administrador', '00000000-0000-0000-0000-000000000301') $$,
  'administrador puede registrar un movimiento'
);

SELECT is(
  (SELECT estado::text FROM movimientos_inventario WHERE id = '90000000-0000-0000-0000-000000000004'),
  'aprobado',
  'el movimiento registrado por administrador nace aprobado automaticamente (trigger de la 00028)'
);

SELECT is(
  (SELECT cantidad_disponible FROM existencias
     WHERE lote_id = '80000000-0000-0000-0000-000000000001'
       AND bodega_id = '72000000-0000-0000-0000-000000000001'),
  120,
  'el ajuste de existencias se aplico automaticamente (100 + 20 del ingreso auto-aprobado)'
);

-- Admin91a aprueba por UPDATE el fixture que el mismo registro (issue #410: gana el
-- comportamiento de 00028, el administrador aprueba lo que registra tanto en INSERT
-- como en UPDATE).
SELECT lives_ok(
  $$ UPDATE movimientos_inventario SET estado = 'aprobado' WHERE id = '90000000-0000-0000-0000-000000000001' $$,
  'un administrador puede aprobar por UPDATE un movimiento que el mismo registro'
);

SELECT is(
  (SELECT estado::text FROM movimientos_inventario WHERE id = '90000000-0000-0000-0000-000000000001'),
  'aprobado',
  'el movimiento queda aprobado tras el UPDATE de admin91a sobre su propio fixture'
);

-- aprobacion_automatica sigue distinguiendo el historial (issue #410, criterio 5): esta
-- aprobacion fue manual por UPDATE, no la puso tr_autoaprobar_movimiento_inventario en el
-- INSERT (ese trigger se desactivo para insertar el fixture), asi que debe quedar FALSE.
SELECT is(
  (SELECT aprobacion_automatica FROM movimientos_inventario WHERE id = '90000000-0000-0000-0000-000000000001'),
  FALSE,
  'la aprobacion manual por UPDATE deja aprobacion_automatica en FALSE, a diferencia del INSERT auto-aprobado'
);

-- ============================================================================
-- medico y voluntario: no pueden aprobar sus propios movimientos (no son
-- administrador en absoluto, la politica de UPDATE los excluye por completo)
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000303';

UPDATE movimientos_inventario SET estado = 'aprobado' WHERE id = '90000000-0000-0000-0000-000000000002';

SELECT is(
  (SELECT estado::text FROM movimientos_inventario WHERE id = '90000000-0000-0000-0000-000000000002'),
  'pendiente',
  'medico no puede aprobar su propio movimiento'
);

SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000304';

UPDATE movimientos_inventario SET estado = 'aprobado' WHERE id = '90000000-0000-0000-0000-000000000003';

SELECT is(
  (SELECT estado::text FROM movimientos_inventario WHERE id = '90000000-0000-0000-0000-000000000003'),
  'pendiente',
  'voluntario no puede aprobar su propio movimiento'
);

-- ============================================================================
-- admin91b: no registro el movimiento del medico, si puede aprobarlo
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000302';

SELECT lives_ok(
  $$ UPDATE movimientos_inventario SET estado = 'aprobado' WHERE id = '90000000-0000-0000-0000-000000000002' $$,
  'un administrador que no registro el movimiento si puede aprobarlo'
);

SELECT is(
  (SELECT estado::text FROM movimientos_inventario WHERE id = '90000000-0000-0000-0000-000000000002'),
  'aprobado',
  'el movimiento del medico quedo aprobado por el segundo administrador'
);

-- medico no es administrador en absoluto: tampoco puede aprobar el movimiento de
-- voluntario (no solo el suyo propio).
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000303';

UPDATE movimientos_inventario SET estado = 'aprobado' WHERE id = '90000000-0000-0000-0000-000000000003';

SELECT is(
  (SELECT estado::text FROM movimientos_inventario WHERE id = '90000000-0000-0000-0000-000000000003'),
  'pendiente',
  'medico no puede aprobar el movimiento pendiente de voluntario: no es administrador'
);

-- ============================================================================
-- inventario.aprobar concedido puntualmente a voluntario (issue #409): la aprobacion, antes
-- exclusiva de administrador, ahora se permite sobre el movimiento pendiente de voluntario304.
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000301';

SELECT lives_ok(
  $$ INSERT INTO usuario_permiso (perfil_id, permiso_id, concedido, otorgado_por)
     SELECT '00000000-0000-0000-0000-000000000304', id, true, '00000000-0000-0000-0000-000000000301'
     FROM permisos WHERE clave = 'inventario.aprobar' $$,
  'administrador concede inventario.aprobar a voluntario304 (issue #409)'
);

SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000304';

SELECT lives_ok(
  $$ UPDATE movimientos_inventario SET estado = 'aprobado' WHERE id = '90000000-0000-0000-0000-000000000003' $$,
  'voluntario con inventario.aprobar concedido puntualmente si puede aprobar un movimiento (issue #409)'
);

SELECT is(
  (SELECT estado::text FROM movimientos_inventario WHERE id = '90000000-0000-0000-0000-000000000003'),
  'aprobado',
  'el movimiento queda aprobado tras el UPDATE de voluntario304 con el permiso concedido'
);

SELECT * FROM finish();

ROLLBACK;
