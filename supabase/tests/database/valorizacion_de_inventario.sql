-- Pruebas de fn_valor_de_inventario_disponible() (issue #752). Corre con: supabase test db
--
-- Mismo patron que las suites vecinas: SET LOCAL ROLE authenticated + SET LOCAL
-- request.jwt.claim.sub simula cada rol.

BEGIN;

SELECT plan(9);

-- ============================================================================
-- Setup: un administrador, un medico, junta directiva y socio fundador; dos
-- medicamentos, cada uno con un lote -- uno con costo conocido, otro sin costo
-- (compra sin precio capturado)-- en la misma bodega.
-- ============================================================================
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000075201', 'admin752@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000075202', 'medico752@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000075203', 'junta752@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000075204', 'socio752@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000075205', 'voluntario752@test.ecopac.local');

ALTER TABLE perfiles DISABLE TRIGGER USER;

UPDATE perfiles SET rol = 'administrador' WHERE id = '00000000-0000-0000-0000-000000075201';
UPDATE perfiles SET rol = 'medico' WHERE id = '00000000-0000-0000-0000-000000075202';
UPDATE perfiles SET rol = 'junta directiva' WHERE id = '00000000-0000-0000-0000-000000075203';
UPDATE perfiles SET rol = 'socio fundador' WHERE id = '00000000-0000-0000-0000-000000075204';
-- voluntario752 se queda con el rol por defecto (voluntario general).

ALTER TABLE perfiles ENABLE TRIGGER USER;

INSERT INTO medicamentos (id, nombre, concentracion, presentacion, marca) VALUES
  ('70000000-0000-0000-0000-000000075201', 'Medicamento con costo 752', '500 mg', 'tableta', 'Generico'),
  ('70000000-0000-0000-0000-000000075202', 'Medicamento sin costo 752', '250 mg', 'tableta', 'Generico');

INSERT INTO proveedores (id, nombre, tipo)
VALUES ('71000000-0000-0000-0000-000000075201', 'Proveedor prueba 752', 'comercial');

INSERT INTO bodegas (id, nombre)
VALUES ('72000000-0000-0000-0000-000000075201', 'Bodega prueba 752');

-- Lote con costo conocido: 40 unidades a 3.50 = 140.00
INSERT INTO lotes (id, medicamento_id, numero_lote, proveedor_id, origen, cantidad_ingresada, fecha_vencimiento, costo_unitario)
VALUES ('80000000-0000-0000-0000-000000075201', '70000000-0000-0000-0000-000000075201',
        'LOTE-752-A', '71000000-0000-0000-0000-000000075201', 'compra', 40, CURRENT_DATE + 365, 3.50);

-- Lote sin costo capturado: 25 unidades, costo_unitario NULL.
INSERT INTO lotes (id, medicamento_id, numero_lote, proveedor_id, origen, cantidad_ingresada, fecha_vencimiento, costo_unitario)
VALUES ('80000000-0000-0000-0000-000000075202', '70000000-0000-0000-0000-000000075202',
        'LOTE-752-B', '71000000-0000-0000-0000-000000075201', 'compra', 25, CURRENT_DATE + 365, NULL);

INSERT INTO existencias (lote_id, bodega_id, cantidad_disponible) VALUES
  ('80000000-0000-0000-0000-000000075201', '72000000-0000-0000-0000-000000075201', 40),
  ('80000000-0000-0000-0000-000000075202', '72000000-0000-0000-0000-000000075201', 25);

-- ============================================================================
-- administrador: ve las dos filas, con el valor y el desglose sin costo correctos
-- ============================================================================
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000075201';

SELECT ok(
  (SELECT count(*) FROM fn_valor_de_inventario_disponible('72000000-0000-0000-0000-000000075201')) = 2,
  'administrador ve las dos filas de la bodega de prueba'
);

SELECT ok(
  (SELECT valor_disponible FROM fn_valor_de_inventario_disponible('72000000-0000-0000-0000-000000075201')
     WHERE medicamento_id = '70000000-0000-0000-0000-000000075201') = 140.00,
  'valor_disponible multiplica cantidad_disponible por costo_unitario'
);

SELECT ok(
  (SELECT valor_disponible FROM fn_valor_de_inventario_disponible('72000000-0000-0000-0000-000000075201')
     WHERE medicamento_id = '70000000-0000-0000-0000-000000075202') IS NULL,
  'un lote sin costo conocido no suma cero: valor_disponible queda NULL'
);

SELECT ok(
  (SELECT unidades_sin_costo FROM fn_valor_de_inventario_disponible('72000000-0000-0000-0000-000000075201')
     WHERE medicamento_id = '70000000-0000-0000-0000-000000075202') = 25,
  'unidades_sin_costo cuenta lo que no tiene costo, en vez de perderlo en silencio'
);

SELECT ok(
  (SELECT lotes_sin_costo FROM fn_valor_de_inventario_disponible('72000000-0000-0000-0000-000000075201')
     WHERE medicamento_id = '70000000-0000-0000-0000-000000075201') = 0,
  'un lote con costo conocido no cuenta como lote sin costo'
);

-- ============================================================================
-- junta directiva y socio fundador: mismo acceso que administrador (00080)
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000075203';

SELECT ok(
  (SELECT count(*) FROM fn_valor_de_inventario_disponible('72000000-0000-0000-0000-000000075201')) = 2,
  'junta directiva consulta la valorizacion, igual que el resto de reportes financieros'
);

SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000075204';

SELECT ok(
  (SELECT count(*) FROM fn_valor_de_inventario_disponible('72000000-0000-0000-0000-000000075201')) = 2,
  'socio fundador consulta la valorizacion, igual que junta directiva'
);

-- ============================================================================
-- medico y voluntario: costo_unitario es informacion financiera, no clinica
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000075202';

SELECT throws_ok(
  $$ SELECT * FROM fn_valor_de_inventario_disponible() $$,
  '42501',
  'Solo administracion y los roles consultivos consultan la valorizacion de inventario.',
  'medico no puede consultar la valorizacion de inventario'
);

SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000075205';

SELECT throws_ok(
  $$ SELECT * FROM fn_valor_de_inventario_disponible() $$,
  '42501',
  'Solo administracion y los roles consultivos consultan la valorizacion de inventario.',
  'voluntario general no puede consultar la valorizacion de inventario'
);

SELECT * FROM finish();
ROLLBACK;
