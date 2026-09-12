-- Pruebas de existencias_totales_por_bodega() (issue #773, migracion 00124). Corre con:
-- supabase test db
--
-- No repite las pruebas de RLS de inventario (politicas_rls_inventario.sql): esta suite verifica
-- que la funcion agrega correctamente y el contrato de "bodega sin fila = total cero", que es lo
-- que reemplaza al arreglo `existencias(cantidad_disponible)` embebido que bodegas.api.js sumaba
-- en el cliente (y que PostgREST tambien corta en max_rows, ver el e2e de la issue).

BEGIN;

SELECT plan(5);

-- ============================================================================
-- Setup: un administrador, un medicamento, dos bodegas -una con dos lotes en existencias, otra
-- sin ninguna- y un proveedor.
-- ============================================================================
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000077301', 'admin773@test.ecopac.local');

ALTER TABLE perfiles DISABLE TRIGGER USER;
UPDATE perfiles SET rol = 'administrador' WHERE id = '00000000-0000-0000-0000-000000077301';
ALTER TABLE perfiles ENABLE TRIGGER USER;

INSERT INTO medicamentos (id, nombre, concentracion, presentacion, marca) VALUES
  ('70000000-0000-0000-0000-000000077301', 'Medicamento prueba 773', '500 mg', 'tableta', 'Generico');

INSERT INTO proveedores (id, nombre, tipo) VALUES
  ('71000000-0000-0000-0000-000000077301', 'Proveedor prueba 773', 'comercial');

INSERT INTO bodegas (id, nombre) VALUES
  ('72000000-0000-0000-0000-000000077301', 'Bodega con existencias 773'),
  ('72000000-0000-0000-0000-000000077302', 'Bodega vacia 773');

INSERT INTO lotes (id, medicamento_id, numero_lote, proveedor_id, origen, cantidad_ingresada, fecha_vencimiento) VALUES
  ('80000000-0000-0000-0000-000000077301', '70000000-0000-0000-0000-000000077301',
   'LOTE-773-A', '71000000-0000-0000-0000-000000077301', 'compra', 100, CURRENT_DATE + 365),
  ('80000000-0000-0000-0000-000000077302', '70000000-0000-0000-0000-000000077301',
   'LOTE-773-B', '71000000-0000-0000-0000-000000077301', 'compra', 100, CURRENT_DATE + 365);

INSERT INTO existencias (lote_id, bodega_id, cantidad_disponible) VALUES
  ('80000000-0000-0000-0000-000000077301', '72000000-0000-0000-0000-000000077301', 40),
  ('80000000-0000-0000-0000-000000077302', '72000000-0000-0000-0000-000000077301', 60);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000077301';

-- ============================================================================
-- 1-2. Suma las dos existencias de la bodega que si tiene
-- ============================================================================
SELECT ok(
  (SELECT total_disponible
   FROM existencias_totales_por_bodega(ARRAY['72000000-0000-0000-0000-000000077301'::uuid])
   WHERE bodega_id = '72000000-0000-0000-0000-000000077301') = 100,
  'suma las dos existencias de la bodega (40 + 60 = 100)'
);

SELECT is(
  (SELECT count(*)::int
   FROM existencias_totales_por_bodega(ARRAY['72000000-0000-0000-0000-000000077301'::uuid])),
  1,
  'una sola fila por bodega, no una por existencia'
);

-- ============================================================================
-- 3. Una bodega sin existencias no genera fila (total cero, no cero explicito)
-- ============================================================================
SELECT is_empty(
  $$ SELECT 1 FROM existencias_totales_por_bodega(
       ARRAY['72000000-0000-0000-0000-000000077302'::uuid]
     ) $$,
  'una bodega sin existencias no genera fila'
);

-- ============================================================================
-- 4. Varias bodegas en un solo llamado, cada una con su propio total
-- ============================================================================
SELECT is(
  (SELECT count(*)::int FROM existencias_totales_por_bodega(
     ARRAY['72000000-0000-0000-0000-000000077301'::uuid, '72000000-0000-0000-0000-000000077302'::uuid]
   )),
  1,
  'la bodega vacia no aporta fila aunque se pida junto con la que si tiene'
);

-- ============================================================================
-- 5. Sin filtro (NULL) trae todas las bodegas con existencias
-- ============================================================================
SELECT ok(
  (SELECT total_disponible FROM existencias_totales_por_bodega(NULL)
   WHERE bodega_id = '72000000-0000-0000-0000-000000077301') = 100,
  'sin filtro de id, trae igual el total de la bodega que si tiene existencias'
);

SELECT * FROM finish();
ROLLBACK;
