-- Pruebas de fn_generar_alertas_caducidad() (issue #166).
-- Corre con: supabase test db
--
-- No se simula ningun rol: la funcion es SECURITY DEFINER sin GRANT a authenticated/anon
-- (00087), pensada para que solo la Edge Function con la llave de servicio la invoque. El
-- rol dueno de las pruebas, exento de RLS, puede llamarla igual que un service_role -- lo que
-- se prueba aqui es el resultado de la funcion, no quien tiene permiso de correrla.
--
-- Ningun dato real: medicamento, proveedor y lotes son inventados.

BEGIN;

SELECT plan(9);

-- ============================================================================
-- Setup: dos bodegas, un medicamento, un proveedor, y seis lotes que cubren cada caso del DoD.
-- ============================================================================
INSERT INTO bodegas (id, nombre, es_movil) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Bodega A 166', FALSE),
  ('a1000000-0000-0000-0000-000000000002', 'Bodega B 166', FALSE);

INSERT INTO medicamentos (id, nombre, concentracion, presentacion, marca) VALUES
  ('a2000000-0000-0000-0000-000000000001', 'Medicamento 166', '500mg', 'tableta', 'Generico');

INSERT INTO proveedores (id, nombre, tipo) VALUES
  ('a3000000-0000-0000-0000-000000000001', 'Proveedor 166', 'comercial');

-- fecha_ingreso fija y muy anterior a todos los vencimientos de abajo, para no chocar con
-- chk_lotes_vencimiento_posterior (00020) sin importar el caso.
INSERT INTO lotes (id, medicamento_id, proveedor_id, numero_lote, origen, cantidad_ingresada, fecha_ingreso, fecha_vencimiento) VALUES
  -- 1. Urgente: vence en 10 dias, con stock. SI genera alerta.
  ('a4000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 'L-166-1', 'compra', 100, CURRENT_DATE - 100, CURRENT_DATE + 10),
  -- 2. Lejano: vence en 45 dias, fuera del rango de 30. NO genera alerta.
  ('a4000000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 'L-166-2', 'compra', 100, CURRENT_DATE - 100, CURRENT_DATE + 45),
  -- 3. Sin stock: vence en 5 dias, pero cantidad_disponible = 0. NO genera alerta.
  ('a4000000-0000-0000-0000-000000000003', 'a2000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 'L-166-3', 'compra', 100, CURRENT_DATE - 100, CURRENT_DATE + 5),
  -- 4. Ya alertado: vence en 20 dias, con stock, pero ya tiene una alerta pendiente. NO duplica.
  ('a4000000-0000-0000-0000-000000000004', 'a2000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 'L-166-4', 'compra', 100, CURRENT_DATE - 100, CURRENT_DATE + 20),
  -- 5. Vencido: vencio hace 5 dias. NO genera alerta (fuera del rango, ya paso).
  ('a4000000-0000-0000-0000-000000000005', 'a2000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 'L-166-5', 'compra', 100, CURRENT_DATE - 100, CURRENT_DATE - 5),
  -- 6. Multi-bodega: vence en 15 dias, stock repartido en las dos bodegas. Una sola alerta con
  --    la suma de las dos.
  ('a4000000-0000-0000-0000-000000000006', 'a2000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 'L-166-6', 'compra', 100, CURRENT_DATE - 100, CURRENT_DATE + 15);

INSERT INTO existencias (lote_id, bodega_id, cantidad_disponible) VALUES
  ('a4000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 5),
  ('a4000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 5),
  ('a4000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 0),
  ('a4000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000001', 3),
  ('a4000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000001', 5),
  ('a4000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000001', 4),
  ('a4000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000002', 6);

-- El lote 4 ya tiene una alerta pendiente, registrada antes de correr la funcion.
INSERT INTO alertas_caducidad (id, lote_id, estado, cantidad_afectada) VALUES
  ('a5000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000004', 'pendiente', 3);

-- ============================================================================
-- Primera corrida
-- ============================================================================
SELECT is(
  (SELECT fn_generar_alertas_caducidad()),
  2,
  'genera exactamente 2 alertas nuevas: el lote urgente y el multi-bodega'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM alertas_caducidad
    WHERE lote_id = 'a4000000-0000-0000-0000-000000000001' AND estado = 'pendiente'
  ),
  'el lote urgente (vence en 10 dias, con stock) tiene alerta pendiente'
);

SELECT is(
  (SELECT cantidad_afectada FROM alertas_caducidad WHERE lote_id = 'a4000000-0000-0000-0000-000000000006'),
  10,
  'el lote multi-bodega suma el stock de las dos bodegas en cantidad_afectada'
);

SELECT is(
  (SELECT count(*)::int FROM alertas_caducidad WHERE lote_id = 'a4000000-0000-0000-0000-000000000002'),
  0,
  'el lote lejano (vence en 45 dias) no genera alerta'
);

SELECT is(
  (SELECT count(*)::int FROM alertas_caducidad WHERE lote_id = 'a4000000-0000-0000-0000-000000000003'),
  0,
  'el lote sin stock no genera alerta aunque venza pronto'
);

SELECT is(
  (SELECT count(*)::int FROM alertas_caducidad WHERE lote_id = 'a4000000-0000-0000-0000-000000000004'),
  1,
  'el lote que ya tenia una alerta pendiente sigue con una sola, no se duplica'
);

SELECT is(
  (SELECT count(*)::int FROM alertas_caducidad WHERE lote_id = 'a4000000-0000-0000-0000-000000000005'),
  0,
  'el lote ya vencido no genera alerta'
);

-- ============================================================================
-- Segunda corrida, mismo dia: idempotencia (criterio 3 del DoD)
-- ============================================================================
SELECT is(
  (SELECT fn_generar_alertas_caducidad()),
  0,
  'una segunda corrida el mismo dia no genera ninguna alerta nueva'
);

SELECT is(
  (SELECT count(*)::int FROM alertas_caducidad),
  3,
  'el total de alertas no cambio: las 2 nuevas de la primera corrida mas la que ya existia'
);

SELECT * FROM finish();

ROLLBACK;
