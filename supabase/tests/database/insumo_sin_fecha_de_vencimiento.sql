-- Pruebas de la 00171: un lote de insumo puede no tener fecha de vencimiento; uno de medicamento
-- la sigue llevando. Corre con:
-- supabase test db
--
-- Fixtures como postgres (exento de RLS): lo que se prueba es la regla de la tabla y de la vista,
-- no quien escribe.

BEGIN;

SELECT plan(8);

-- ============================================================================
-- Setup
-- ============================================================================
INSERT INTO medicamentos (id, nombre, concentracion, presentacion_id, marca) VALUES
  ('70000000-0000-0000-0000-000000017101', 'Medicamento 171', '500 mg',
   (SELECT id FROM presentaciones ORDER BY nombre LIMIT 1), 'Generico');

INSERT INTO medicamentos (id, nombre, concentracion, presentacion_id, marca, tipo_articulo) VALUES
  ('70000000-0000-0000-0000-000000017102', 'Gasas 171', NULL,
   (SELECT id FROM presentaciones ORDER BY nombre LIMIT 1), 'Generico', 'insumo');

INSERT INTO proveedores (id, nombre, tipo)
VALUES ('71000000-0000-0000-0000-000000017101', 'Proveedor prueba 171', 'comercial');

INSERT INTO bodegas (id, nombre)
VALUES ('72000000-0000-0000-0000-000000017101', 'Bodega prueba 171');

INSERT INTO lotes (id, medicamento_id, numero_lote, proveedor_id, origen, cantidad_ingresada, fecha_vencimiento)
VALUES ('80000000-0000-0000-0000-000000017101', '70000000-0000-0000-0000-000000017101',
        'LOTE-171-MED', '71000000-0000-0000-0000-000000017101', 'compra', 10, CURRENT_DATE + 365);

-- ============================================================================
-- La fecha: obligatoria en medicamento, opcional en insumo
-- ============================================================================
SELECT throws_ok(
  $$ INSERT INTO lotes (medicamento_id, numero_lote, proveedor_id, origen, cantidad_ingresada, fecha_vencimiento)
     VALUES ('70000000-0000-0000-0000-000000017101', 'LOTE-171-SIN', '71000000-0000-0000-0000-000000017101',
             'compra', 5, NULL) $$,
  '23502', NULL,
  'un lote de medicamento sin fecha de vencimiento se rechaza'
);

SELECT lives_ok(
  $$ INSERT INTO lotes (id, medicamento_id, numero_lote, proveedor_id, origen, cantidad_ingresada, fecha_vencimiento)
     VALUES ('80000000-0000-0000-0000-000000017102', '70000000-0000-0000-0000-000000017102',
             'LOTE-171-INS', '71000000-0000-0000-0000-000000017101', 'compra', 20, NULL) $$,
  'un lote de insumo sin fecha de vencimiento se registra'
);

SELECT throws_ok(
  $$ UPDATE lotes SET fecha_vencimiento = NULL WHERE id = '80000000-0000-0000-0000-000000017101' $$,
  '23502', NULL,
  'a un lote de medicamento no se le quita la fecha'
);

-- Pasar un lote sin fecha a un medicamento tambien lo deja sin fecha: se rechaza.
SELECT throws_ok(
  $$ UPDATE lotes SET medicamento_id = '70000000-0000-0000-0000-000000017101'
      WHERE id = '80000000-0000-0000-0000-000000017102' $$,
  '23502', NULL,
  'un lote sin fecha no se pasa a un medicamento'
);

-- ============================================================================
-- Un lote sin fecha no vence
-- ============================================================================
INSERT INTO existencias (lote_id, bodega_id, cantidad_disponible) VALUES
  ('80000000-0000-0000-0000-000000017102', '72000000-0000-0000-0000-000000017101', 20);

SELECT is(
  (SELECT cantidad_disponible FROM vista_lotes_disponibles
    WHERE lote_id = '80000000-0000-0000-0000-000000017102')::int,
  20,
  'vista_lotes_disponibles cuenta el lote de insumo sin fecha'
);

SELECT ok(
  fn_medicamento_tiene_existencias('70000000-0000-0000-0000-000000017102'),
  'fn_medicamento_tiene_existencias cuenta el lote de insumo sin fecha'
);

SELECT is(
  (SELECT cantidad_disponible FROM fn_existencias_disponibles(
     '72000000-0000-0000-0000-000000017101', 'Gasas 171')),
  20,
  'fn_existencias_disponibles tambien, porque lee la vista'
);

-- ============================================================================
-- Privilegios
-- ============================================================================
SELECT is(
  has_function_privilege('authenticated', 'public.fn_lote_de_medicamento_tiene_vencimiento()', 'EXECUTE'),
  false,
  'nadie llama directo a la funcion DEFINER del trigger'
);

SELECT * FROM finish();
ROLLBACK;
