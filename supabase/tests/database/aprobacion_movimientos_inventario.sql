-- Pruebas de quien aprueba un movimiento de inventario, y de la trazabilidad que lo respalda
-- (issue #221, criterio de aceptacion 4).
--
-- POR QUE ESTE ARCHIVO NO PRUEBA LO QUE LA ISSUE PIDE LITERALMENTE
--
-- El criterio dice: "se verifica que nadie puede aprobar un movimiento que el mismo registro".
-- Esa regla YA NO EXISTE. La quito a proposito la migracion 00048 (issue #410), y su cabecera
-- explica por que: el trigger de autoaprobacion ya dejaba nacer aprobado cualquier movimiento
-- insertado por un administrador, asi que la restriccion del UPDATE solo alcanzaba a una de las
-- dos rutas de aprobacion -- era una media tinta, no una separacion de responsabilidades real.
--
-- La 00048 dejo escrito donde vive la trazabilidad desde entonces: en las columnas
-- registrado_por / aprobado_por / aprobado_en de la propia fila, y en los eventos que
-- trg_movimientos_inventario_auditoria (00026) escribe en eventos_auditoria.
--
-- Asi que esta suite verifica LA REGLA QUE SI RIGE -- que la aprobacion sigue estando acotada al
-- administrador -- y que esa trazabilidad funciona de verdad. Restaurar la regla vieja seria
-- revertir una decision documentada de otra issue desde una prueba.
--
-- Ningun dato real: el proveedor, el medicamento y los lotes son inventados.

BEGIN;

SELECT plan(10);

-- ============================================================================
-- Setup: un administrador, un medico y un voluntario, mas un lote con existencias.
-- ============================================================================
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000222001', 'admin222@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000222002', 'medico222@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000222003', 'voluntario222@test.ecopac.local');

ALTER TABLE perfiles DISABLE TRIGGER USER;
UPDATE perfiles SET rol = 'administrador' WHERE id = '00000000-0000-0000-0000-000000222001';
UPDATE perfiles SET rol = 'medico'        WHERE id = '00000000-0000-0000-0000-000000222002';
ALTER TABLE perfiles ENABLE TRIGGER USER;

INSERT INTO proveedores (id, nombre, tipo) VALUES
  ('75000000-0000-0000-0000-000000222001', 'Proveedor 222', 'comercial');

INSERT INTO medicamentos (id, nombre, concentracion, presentacion, marca) VALUES
  ('74000000-0000-0000-0000-000000222001', 'Medicamento 222', '500 mg', 'tableta', 'Generico');

INSERT INTO bodegas (id, nombre) VALUES
  ('80000000-0000-0000-0000-000000222001', 'Bodega 222');

INSERT INTO lotes (id, medicamento_id, numero_lote, fecha_vencimiento, proveedor_id, origen, cantidad_ingresada) VALUES
  ('76000000-0000-0000-0000-000000222001', '74000000-0000-0000-0000-000000222001', 'L-222',
   CURRENT_DATE + 90, '75000000-0000-0000-0000-000000222001', 'compra', 500);

SET LOCAL ROLE authenticated;

-- ============================================================================
-- 1. El medico registra: nace PENDIENTE y a su nombre
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000222002';

SELECT lives_ok(
  $$ INSERT INTO movimientos_inventario (id, tipo, lote_id, bodega_id, cantidad, motivo, registrado_por)
     VALUES ('90000000-0000-0000-0000-000000222001', 'ingreso',
             '76000000-0000-0000-0000-000000222001', '80000000-0000-0000-0000-000000222001',
             10, 'ingreso de prueba', '00000000-0000-0000-0000-000000222002') $$,
  'POSITIVA INSERT: el medico registra un movimiento propio'
);

SELECT is(
  (SELECT estado::text FROM movimientos_inventario WHERE id = '90000000-0000-0000-0000-000000222001'),
  'pendiente',
  'el movimiento de un medico nace PENDIENTE: el trigger de autoaprobacion solo actua para administrador'
);

-- La politica de INSERT exige registrado_por = auth.uid(): nadie registra a nombre de otro.
SELECT throws_ok(
  $$ INSERT INTO movimientos_inventario (tipo, lote_id, bodega_id, cantidad, motivo, registrado_por)
     VALUES ('ingreso', '76000000-0000-0000-0000-000000222001', '80000000-0000-0000-0000-000000222001',
             5, 'a nombre de otro', '00000000-0000-0000-0000-000000222001') $$,
  '42501',
  NULL,
  'NEGATIVA INSERT: nadie registra un movimiento a nombre de otra persona'
);

-- ============================================================================
-- 2. Quien NO es administrador no aprueba: ni lo ajeno ni lo propio
-- ============================================================================
-- Es la parte del criterio 4 que sigue vigente: la aprobacion esta acotada.
SELECT is_empty(
  $$ UPDATE movimientos_inventario SET estado = 'aprobado'
     WHERE id = '90000000-0000-0000-0000-000000222001' RETURNING id $$,
  'NEGATIVA UPDATE: el medico no aprueba ni el movimiento que el mismo registro'
);

SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000222003';

SELECT is_empty(
  $$ UPDATE movimientos_inventario SET estado = 'aprobado'
     WHERE id = '90000000-0000-0000-0000-000000222001' RETURNING id $$,
  'NEGATIVA UPDATE: un voluntario tampoco aprueba movimientos ajenos'
);

-- ============================================================================
-- 3. El administrador SI aprueba, incluido lo que el mismo registra (00048)
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000222001';

SELECT isnt_empty(
  $$ UPDATE movimientos_inventario
     SET estado = 'aprobado', aprobado_por = '00000000-0000-0000-0000-000000222001', aprobado_en = NOW()
     WHERE id = '90000000-0000-0000-0000-000000222001' RETURNING id $$,
  'POSITIVA UPDATE: el administrador aprueba el movimiento del medico'
);

-- Lo propio tambien, que es justo lo que la 00048 desbloqueo. El trigger de autoaprobacion lo
-- deja nacer ya aprobado, sin pasar por el UPDATE.
SELECT lives_ok(
  $$ INSERT INTO movimientos_inventario (id, tipo, lote_id, bodega_id, cantidad, motivo, registrado_por)
     VALUES ('90000000-0000-0000-0000-000000222002', 'ingreso',
             '76000000-0000-0000-0000-000000222001', '80000000-0000-0000-0000-000000222001',
             20, 'ingreso del admin', '00000000-0000-0000-0000-000000222001') $$,
  'POSITIVA INSERT: el administrador registra su propio movimiento'
);

SELECT is(
  (SELECT estado::text || '/' || aprobacion_automatica::text
   FROM movimientos_inventario WHERE id = '90000000-0000-0000-0000-000000222002'),
  'aprobado/true',
  'el movimiento del administrador nace APROBADO y marcado como aprobacion automatica (00048)'
);

-- ============================================================================
-- 4. La trazabilidad que reemplazo a la regla vieja
-- ============================================================================
-- La 00048 sostiene que quitar la restriccion no reduce la trazabilidad porque quien registro y
-- quien aprobo quedan en la fila y en eventos_auditoria. Esto lo comprueba en vez de creerlo.
SELECT is(
  (SELECT registrado_por::text || ' aprobo:' || coalesce(aprobado_por::text, 'nadie')
   FROM movimientos_inventario WHERE id = '90000000-0000-0000-0000-000000222001'),
  '00000000-0000-0000-0000-000000222002 aprobo:00000000-0000-0000-0000-000000222001',
  'la fila conserva que lo registro el medico y lo aprobo el administrador'
);

SELECT isnt_empty(
  $$ SELECT 1 FROM eventos_auditoria
     WHERE tabla_afectada = 'movimientos_inventario'
       AND fila_id = '90000000-0000-0000-0000-000000222001' $$,
  'eventos_auditoria registro el movimiento: la trazabilidad no depende de bloquear la operacion'
);

SELECT * FROM finish();
ROLLBACK;
