-- Pruebas de fn_atender_alerta_caducidad() y de la regla de una alerta por etapa (issue #755,
-- migracion 00138).
-- Corre con: supabase test db
--
-- El defecto que las origina: atender una alerta solo cambiaba su estado, las unidades seguian en
-- existencias, y el generador (00129) creaba otra alerta del mismo lote -con su notificacion y su
-- correo- en cuanto el panel volvia a cargar.
--
-- Ningun dato real: medicamento, bodegas y lotes son inventados.

BEGIN;

SELECT plan(18);

-- ============================================================================
-- Setup
-- ============================================================================
INSERT INTO auth.users (id, email) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'admin755b@test.ecopac.local'),
  ('c0000000-0000-0000-0000-000000000002', 'voluntario755b@test.ecopac.local');

ALTER TABLE perfiles DISABLE TRIGGER USER;
UPDATE perfiles SET rol = 'administrador' WHERE id = 'c0000000-0000-0000-0000-000000000001';
ALTER TABLE perfiles ENABLE TRIGGER USER;

INSERT INTO bodegas (id, nombre, es_movil) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'Bodega origen 755', FALSE),
  ('c1000000-0000-0000-0000-000000000002', 'Bodega otra 755', FALSE),
  ('c1000000-0000-0000-0000-000000000003', 'Bodega destino 755', FALSE);

INSERT INTO medicamentos (id, nombre, concentracion, presentacion, marca) VALUES
  ('c2000000-0000-0000-0000-000000000001', 'Medicamento 755b', '100 mg', 'tableta', 'Generico');

INSERT INTO proveedores (id, nombre, tipo) VALUES
  ('c3000000-0000-0000-0000-000000000001', 'Proveedor 755b', 'comercial');

INSERT INTO lotes (id, medicamento_id, proveedor_id, numero_lote, origen, cantidad_ingresada, fecha_ingreso, fecha_vencimiento) VALUES
  -- Vencido, repartido en dos bodegas: se descarta.
  ('c4000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-000000000001', 'L-755-V', 'compra', 100, CURRENT_DATE - 100, CURRENT_DATE - 2),
  -- Por vencer: se reubica.
  ('c4000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-000000000001', 'L-755-P', 'compra', 100, CURRENT_DATE - 100, CURRENT_DATE + 10);

INSERT INTO existencias (lote_id, bodega_id, cantidad_disponible) VALUES
  ('c4000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 7),
  ('c4000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', 3),
  ('c4000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001', 9);

-- Las alertas de seed-demo se dejan fuera, igual que en generar_alertas_caducidad.sql.
INSERT INTO alertas_caducidad (lote_id, cantidad_afectada)
SELECT id, 1 FROM lotes WHERE numero_lote IN ('LOTE-DEMO-POR-VENCER', 'LOTE-DEMO-VENCIDO');

SELECT fn_generar_alertas_caducidad();

CREATE FUNCTION pg_temp.alerta_pendiente(p_lote UUID) RETURNS UUID LANGUAGE sql AS $$
  SELECT id FROM alertas_caducidad WHERE lote_id = p_lote AND estado = 'pendiente';
$$;
CREATE FUNCTION pg_temp.stock(p_lote UUID, p_bodega UUID) RETURNS INT LANGUAGE sql AS $$
  SELECT COALESCE(SUM(cantidad_disponible), 0)::INT FROM existencias
  WHERE lote_id = p_lote AND (p_bodega IS NULL OR bodega_id = p_bodega);
$$;

-- ============================================================================
-- 1. Quien puede
-- ============================================================================
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000002', TRUE);

SELECT throws_ok(
  format($$ SELECT fn_atender_alerta_caducidad(%L, 'descartado') $$,
         pg_temp.alerta_pendiente('c4000000-0000-0000-0000-000000000001')),
  '42501',
  NULL,
  'un voluntario no puede atender una alerta'
);

SELECT throws_ok(
  format($$ UPDATE alertas_caducidad SET estado = 'atendida', accion = 'descartado',
             atendida_por = 'c0000000-0000-0000-0000-000000000001', atendida_en = NOW()
           WHERE id = %L $$,
         pg_temp.alerta_pendiente('c4000000-0000-0000-0000-000000000001')),
  '42501',
  NULL,
  'nadie cierra una alerta con UPDATE directo: solo por la funcion, que descuenta el stock'
);

SELECT set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000001', TRUE);

-- ============================================================================
-- 2. Descartar un vencido: baja de todo el lote
-- ============================================================================
SELECT lives_ok(
  format($$ SELECT fn_atender_alerta_caducidad(%L, 'descartado') $$,
         pg_temp.alerta_pendiente('c4000000-0000-0000-0000-000000000001')),
  'descartar un lote vencido no choca con la regla que impide ENTREGAR un vencido'
);

RESET ROLE;

SELECT is(
  pg_temp.stock('c4000000-0000-0000-0000-000000000001', NULL),
  0,
  'descartar deja el lote en cero en todas sus bodegas'
);

SELECT is(
  (SELECT count(*)::INT FROM movimientos_inventario
   WHERE lote_id = 'c4000000-0000-0000-0000-000000000001' AND tipo = 'salida'
     AND estado = 'aprobado' AND motivo = 'Baja por caducidad: descartado'),
  2,
  'la baja queda en el Kardex: una salida aprobada por cada bodega que tenia existencia'
);

SELECT is(
  (SELECT accion::TEXT || '/' || estado::TEXT FROM alertas_caducidad
   WHERE lote_id = 'c4000000-0000-0000-0000-000000000001'),
  'descartado/atendida',
  'la alerta queda atendida con la accion tomada'
);

SELECT is(
  (SELECT atendida_por FROM alertas_caducidad
   WHERE lote_id = 'c4000000-0000-0000-0000-000000000001'),
  'c0000000-0000-0000-0000-000000000001'::UUID,
  'atendida_por es quien llamo, no un parametro que el cliente pueda falsear'
);

SELECT is(
  current_setting('ecopac.baja_por_caducidad', TRUE),
  'off',
  'la bandera de baja no queda encendida despues de la funcion'
);

SELECT is(
  fn_generar_alertas_caducidad(),
  0,
  'el generador no vuelve a alertar el lote dado de baja: ya no tiene existencia'
);

-- ============================================================================
-- 3. Una salida normal de un vencido sigue prohibida
-- ============================================================================
UPDATE existencias SET cantidad_disponible = 4
WHERE lote_id = 'c4000000-0000-0000-0000-000000000001'
  AND bodega_id = 'c1000000-0000-0000-0000-000000000001';

SELECT throws_ok(
  $$ SELECT fn_aplicar_ajuste_existencias('c4000000-0000-0000-0000-000000000001',
       'c1000000-0000-0000-0000-000000000001', 'salida', 1) $$,
  NULL,
  NULL,
  'fuera de la baja por caducidad, la salida de un vencido sigue rechazada (CP-RF03-04)'
);

SELECT is(
  fn_generar_alertas_caducidad(),
  0,
  'un vencido que ya se atendio vencido no vuelve a alertar aunque recupere existencia'
);

-- ============================================================================
-- 4. Reubicar un lote por vencer
-- ============================================================================
-- El vencido vuelve a cero: asi el lote por vencer es el unico del medicamento con existencia, y
-- un traslado mal ordenado haria pasar el total por cero (ver la prueba del "sin stock" falso).
UPDATE existencias SET cantidad_disponible = 0
WHERE lote_id = 'c4000000-0000-0000-0000-000000000001';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000001', TRUE);

SELECT throws_ok(
  format($$ SELECT fn_atender_alerta_caducidad(%L, 'reubicado') $$,
         pg_temp.alerta_pendiente('c4000000-0000-0000-0000-000000000002')),
  '23502',
  NULL,
  'reubicar sin bodega destino se rechaza'
);

SELECT lives_ok(
  format($$ SELECT fn_atender_alerta_caducidad(%L, 'reubicado', %L) $$,
         pg_temp.alerta_pendiente('c4000000-0000-0000-0000-000000000002'),
         'c1000000-0000-0000-0000-000000000003'),
  'reubicar un lote por vencer a una bodega destino'
);

RESET ROLE;

SELECT is(
  pg_temp.stock('c4000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000003'),
  9,
  'reubicar traslada todo el stock a la bodega destino'
);

SELECT is(
  pg_temp.stock('c4000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001'),
  0,
  'y deja la bodega de origen en cero'
);

SELECT is(
  fn_generar_alertas_caducidad(),
  0,
  'un lote reubicado no vuelve a alertar mientras siga en la misma etapa (por vencer)'
);

-- El medicamento tenia un solo lote con existencia (el vencido ya se dio de baja): si el traslado
-- sacara del origen antes de ingresar en la destino, el total pasaria por cero y avisaria de un
-- "sin stock" falso. Se vio al probar la #755 en la app.
SELECT is(
  (SELECT count(*)::INT FROM notificaciones
   WHERE categoria = 'stock' AND origen_id = 'c2000000-0000-0000-0000-000000000001'),
  0,
  'reubicar no dispara un "sin stock" falso: el total del medicamento nunca pasa por cero'
);

-- ============================================================================
-- 5. Reubicar un vencido no
-- ============================================================================
INSERT INTO alertas_caducidad (id, lote_id, cantidad_afectada) VALUES
  ('c5000000-0000-0000-0000-000000000001', 'c4000000-0000-0000-0000-000000000001', 4);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000001', TRUE);

SELECT throws_ok(
  $$ SELECT fn_atender_alerta_caducidad('c5000000-0000-0000-0000-000000000001', 'reubicado',
       'c1000000-0000-0000-0000-000000000003') $$,
  '23514',
  NULL,
  'un lote vencido no se reubica: se descarta o se dona'
);

RESET ROLE;

SELECT * FROM finish();

ROLLBACK;
