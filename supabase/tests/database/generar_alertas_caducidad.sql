-- Pruebas de fn_generar_alertas_caducidad() (issues #166, #838 y #755).
--
-- QUE CAMBIO EN LA #838, Y POR QUE ESTA PRUEBA CAMBIA CON ELLA
--
-- La #166 penso esta funcion como un aviso anticipado -"lo que vence en 30 dias o menos"- y esta
-- prueba fijaba, en su caso 5, que un lote YA VENCIDO no generara alerta: estaba "fuera del rango,
-- ya paso". La consecuencia no se vio hasta usar el sistema: la pestana de alertas tiene un bloque
-- llamado "Vencidos - Para dar de baja" que se llena desde alertas_caducidad, y un lote vencido con
-- existencia nunca llegaba ahi. O sea que el bloque que existe para dar de baja lo vencido no podia
-- mostrar nada, y no habia ninguna otra pantalla por donde hacerlo.
--
-- La tabla no es solo un aviso: tiene `accion` (donado/reubicado/descartado), `atendida_por` y
-- `atendida_en`, o sea que es el REGISTRO DE LA BAJA. Un lote que vencio tiene que poder entrar a
-- ese flujo; de hecho ya entraba, pero solo por accidente -- si su alerta seguia pendiente el dia
-- que vencio. Lo que la 00129 corrige es la condicion de entrada, no el proposito de la tabla.
--
-- Lo que NO cambia, y esta prueba lo sigue fijando: un lote sin existencia no genera alerta, ni
-- antes ni despues de vencer. Sin unidades no hay nada que dar de baja.
-- Corre con: supabase test db
--
-- No se simula ningun rol: la funcion es SECURITY DEFINER sin GRANT a authenticated/anon
-- (00088), pensada para que solo la Edge Function con la llave de servicio la invoque. El
-- rol dueno de las pruebas, exento de RLS, puede llamarla igual que un service_role -- lo que
-- se prueba aqui es el resultado de la funcion, no quien tiene permiso de correrla.
--
-- Ningun dato real: medicamento, proveedor y lotes son inventados.

BEGIN;

SELECT plan(13);

-- ============================================================================
-- Setup: dos bodegas, un medicamento, un proveedor, y los lotes que cubren cada caso del DoD.
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
  -- 5. Vencido CON existencia: vencio hace 5 dias y todavia hay unidades en bodega. SI genera
  --    alerta desde la 00129: es justo el lote que hay que dar de baja (issue #838).
  ('a4000000-0000-0000-0000-000000000005', 'a2000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 'L-166-5', 'compra', 100, CURRENT_DATE - 100, CURRENT_DATE - 5),
  -- 7. Vencido SIN existencia: vencio hace 40 dias y no queda ninguna unidad. NO genera alerta,
  --    porque no hay nada que dar de baja. Es el limite que la 00129 NO mueve.
  ('a4000000-0000-0000-0000-000000000007', 'a2000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 'L-166-7', 'compra', 100, CURRENT_DATE - 100, CURRENT_DATE - 40),
  -- 6. Multi-bodega: vence en 15 dias, stock repartido en las dos bodegas. Una sola alerta con
  --    la suma de las dos.
  ('a4000000-0000-0000-0000-000000000006', 'a2000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 'L-166-6', 'compra', 100, CURRENT_DATE - 100, CURRENT_DATE + 15),
  -- Los tres bordes de la ventana (issue #755). La condicion es `fecha_vencimiento <=
  -- CURRENT_DATE + 30`: el dia 30 entra y el 31 no. Hoy entra por partida doble: no ha vencido
  -- (regla #597, un lote que vence hoy aun se entrega) y esta dentro de los 30 dias.
  -- 8. Vence HOY, con stock. SI genera alerta.
  ('a4000000-0000-0000-0000-000000000008', 'a2000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 'L-166-8', 'compra', 100, CURRENT_DATE - 100, CURRENT_DATE),
  -- 9. Vence en exactamente 30 dias, con stock. SI genera alerta: es el ultimo dia de la ventana.
  ('a4000000-0000-0000-0000-000000000009', 'a2000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 'L-166-9', 'compra', 100, CURRENT_DATE - 100, CURRENT_DATE + 30),
  -- 10. Vence en 31 dias, con stock. NO genera alerta: el primer dia fuera de la ventana.
  ('a4000000-0000-0000-0000-000000000010', 'a2000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 'L-166-10', 'compra', 100, CURRENT_DATE - 100, CURRENT_DATE + 31);

INSERT INTO existencias (lote_id, bodega_id, cantidad_disponible) VALUES
  ('a4000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 5),
  ('a4000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 5),
  ('a4000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 0),
  ('a4000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000001', 3),
  ('a4000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000001', 5),
  ('a4000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000001', 4),
  ('a4000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000002', 6),
  ('a4000000-0000-0000-0000-000000000007', 'a1000000-0000-0000-0000-000000000001', 0),
  ('a4000000-0000-0000-0000-000000000008', 'a1000000-0000-0000-0000-000000000001', 5),
  ('a4000000-0000-0000-0000-000000000009', 'a1000000-0000-0000-0000-000000000001', 5),
  ('a4000000-0000-0000-0000-000000000010', 'a1000000-0000-0000-0000-000000000001', 5);

-- El lote 4 ya tiene una alerta pendiente, registrada antes de correr la funcion.
INSERT INTO alertas_caducidad (id, lote_id, estado, cantidad_afectada) VALUES
  ('a5000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000004', 'pendiente', 3);

-- config.toml (db.seed) corre seed.sql y seed-demo.sql antes de las pruebas, tanto local como
-- en el job "validar" del CI. seed-demo.sql (issue #94) trae dos lotes que cumplen el criterio de
-- la funcion, y a los dos se les da una alerta pendiente ya existente -- igual que al lote 4 de
-- arriba -- para que esta prueba dependa solo de sus propios fixtures y no de las fechas o el
-- stock que tenga el seed de demo en un momento dado:
--
--   - LOTE-DEMO-POR-VENCER: vence en 20 dias, con existencia real en bodega movil.
--   - LOTE-DEMO-VENCIDO: vencio hace 10 dias y conserva las 200 unidades de su ingreso aprobado.
--     Antes de la 00129 no hacia falta neutralizarlo, porque un lote vencido no era candidato. Que
--     el seed de demostracion tenga justo este caso -- un vencido con existencia -- es la misma
--     situacion que reporto la issue #838 desde el uso real.
INSERT INTO alertas_caducidad (lote_id, cantidad_afectada)
SELECT id, 1 FROM lotes WHERE numero_lote IN ('LOTE-DEMO-POR-VENCER', 'LOTE-DEMO-VENCIDO');

-- ============================================================================
-- Primera corrida
-- ============================================================================
SELECT is(
  (SELECT fn_generar_alertas_caducidad()),
  5,
  'genera exactamente 5 alertas nuevas: el lote urgente, el multi-bodega, el ya vencido con '
  'existencia (issue #838) y los dos bordes que entran, hoy y dentro de 30 dias (issue #755)'
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

-- ISSUE #838: esto afirmaba lo contrario (0 alertas), y era la razon por la que un lote vencido
-- nunca llegaba al bloque "Vencidos - Para dar de baja" de la pestana de alertas.
SELECT is(
  (SELECT count(*)::int FROM alertas_caducidad WHERE lote_id = 'a4000000-0000-0000-0000-000000000005'),
  1,
  'el lote ya vencido CON existencia si genera alerta: es el que hay que dar de baja'
);

SELECT is(
  (SELECT count(*)::int FROM alertas_caducidad WHERE lote_id = 'a4000000-0000-0000-0000-000000000007'),
  0,
  'el lote ya vencido SIN existencia no genera alerta: no hay nada que dar de baja'
);

-- Los tres bordes de la ventana (issue #755)
SELECT is(
  (SELECT count(*)::int FROM alertas_caducidad WHERE lote_id = 'a4000000-0000-0000-0000-000000000008'),
  1,
  'el lote que vence hoy genera alerta'
);

SELECT is(
  (SELECT count(*)::int FROM alertas_caducidad WHERE lote_id = 'a4000000-0000-0000-0000-000000000009'),
  1,
  'el lote que vence en exactamente 30 dias genera alerta: es el ultimo dia de la ventana'
);

SELECT is(
  (SELECT count(*)::int FROM alertas_caducidad WHERE lote_id = 'a4000000-0000-0000-0000-000000000010'),
  0,
  'el lote que vence en 31 dias no genera alerta: es el primer dia fuera de la ventana'
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
  8,
  'el total de alertas no cambio: las 5 nuevas de la primera corrida mas las 3 que ya existian '
  '(el lote 4 y los dos lotes de seed-demo, neutralizados arriba)'
);

SELECT * FROM finish();

ROLLBACK;
