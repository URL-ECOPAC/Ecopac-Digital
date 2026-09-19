-- Pruebas de las notificaciones al administrador (issue #755, migracion 00138).
-- Corre con: supabase test db
--
-- Que se comprueba:
--   - Cada uno de los cuatro disparos (caducidad, validacion, presupuestos, stock) crea una
--     notificacion para cada administrador ACTIVO, y ninguna para un administrador desactivado ni
--     para otros roles.
--   - Lo que la propia administracion registra (autoaprobado) no notifica.
--   - "Sin stock" avisa en la transicion a cero, no en el estado: repetir el cero no repite.
--   - Correr la generacion de alertas dos veces no repite notificaciones.
--   - El correo: sin la URL en Vault no se encola nada; con ella se encola una peticion por
--     sentencia, y una fila reclamada para correo no se vuelve a reclamar.
--   - RLS y GRANT: cada perfil ve y marca solo lo suyo, y solo puede tocar leida_en.
--
-- config.toml corre seed.sql y seed-demo.sql antes de esta suite, y ahi ya hay administradores.
-- Por eso ninguna prueba cuenta el total de la tabla: todas cuentan por perfil de esta suite.
--
-- Ningun dato real: perfiles, medicamento, lotes y gastos son inventados.

BEGIN;

SELECT plan(26);

-- ============================================================================
-- Setup
-- ============================================================================
INSERT INTO auth.users (id, email) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'admin755@test.ecopac.local'),
  ('b0000000-0000-0000-0000-000000000002', 'admininactivo755@test.ecopac.local'),
  ('b0000000-0000-0000-0000-000000000003', 'voluntario755@test.ecopac.local'),
  ('b0000000-0000-0000-0000-000000000004', 'medico755@test.ecopac.local');

ALTER TABLE perfiles DISABLE TRIGGER USER;
UPDATE perfiles SET rol = 'administrador' WHERE id = 'b0000000-0000-0000-0000-000000000001';
UPDATE perfiles SET rol = 'administrador', activo = FALSE
  WHERE id = 'b0000000-0000-0000-0000-000000000002';
UPDATE perfiles SET rol = 'medico' WHERE id = 'b0000000-0000-0000-0000-000000000004';
ALTER TABLE perfiles ENABLE TRIGGER USER;

INSERT INTO bodegas (id, nombre, es_movil) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'Bodega 755', FALSE);

INSERT INTO medicamentos (id, nombre, concentracion, presentacion, marca) VALUES
  ('b2000000-0000-0000-0000-000000000001', 'Medicamento 755', '250 mg', 'tableta', 'Generico');

INSERT INTO proveedores (id, nombre, tipo) VALUES
  ('b3000000-0000-0000-0000-000000000001', 'Proveedor 755', 'comercial');

INSERT INTO lotes (id, medicamento_id, proveedor_id, numero_lote, origen, cantidad_ingresada, fecha_ingreso, fecha_vencimiento) VALUES
  -- Vencido con existencia: genera alerta de caducidad.
  ('b4000000-0000-0000-0000-000000000001', 'b2000000-0000-0000-0000-000000000001', 'b3000000-0000-0000-0000-000000000001', 'L-755-1', 'compra', 100, CURRENT_DATE - 100, CURRENT_DATE - 3),
  -- Lejano: no genera alerta; sirve para los movimientos y para el stock.
  ('b4000000-0000-0000-0000-000000000002', 'b2000000-0000-0000-0000-000000000001', 'b3000000-0000-0000-0000-000000000001', 'L-755-2', 'compra', 100, CURRENT_DATE - 100, CURRENT_DATE + 300);

INSERT INTO existencias (id, lote_id, bodega_id, cantidad_disponible) VALUES
  ('b5000000-0000-0000-0000-000000000001', 'b4000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 4),
  ('b5000000-0000-0000-0000-000000000002', 'b4000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000001', 6);

-- Cuantas notificaciones de una categoria tiene un perfil.
CREATE FUNCTION pg_temp.contar(p_perfil UUID, p_categoria categoria_notificacion)
RETURNS INT LANGUAGE sql AS $$
  SELECT count(*)::int FROM notificaciones WHERE perfil_id = p_perfil AND categoria = p_categoria;
$$;

-- ============================================================================
-- 1. Caducidad
-- ============================================================================
SELECT fn_generar_alertas_caducidad();

SELECT is(
  (SELECT count(*)::int FROM notificaciones n
   JOIN alertas_caducidad a ON a.id = n.origen_id
   WHERE n.perfil_id = 'b0000000-0000-0000-0000-000000000001'
     AND a.lote_id = 'b4000000-0000-0000-0000-000000000001'),
  1,
  'caducidad: el administrador activo recibe una notificacion por la alerta del lote vencido'
);

SELECT is(
  (SELECT titulo FROM notificaciones n
   JOIN alertas_caducidad a ON a.id = n.origen_id
   WHERE n.perfil_id = 'b0000000-0000-0000-0000-000000000001'
     AND a.lote_id = 'b4000000-0000-0000-0000-000000000001'),
  'Lote vencido: Medicamento 755',
  'caducidad: el titulo dice que el lote ya vencio y nombra el medicamento'
);

SELECT is(
  pg_temp.contar('b0000000-0000-0000-0000-000000000002', 'caducidad'),
  0,
  'caducidad: un administrador desactivado no recibe nada (00079)'
);

SELECT is(
  pg_temp.contar('b0000000-0000-0000-0000-000000000003', 'caducidad'),
  0,
  'caducidad: un voluntario no recibe nada'
);

SELECT is(
  (SELECT count(*)::int FROM notificaciones n
   JOIN alertas_caducidad a ON a.id = n.origen_id
   JOIN perfiles p ON p.id = n.perfil_id
   WHERE a.lote_id = 'b4000000-0000-0000-0000-000000000001'),
  (SELECT count(*)::int FROM perfiles WHERE rol = 'administrador' AND activo),
  'caducidad: una notificacion por cada administrador activo, ni una mas'
);

SELECT fn_generar_alertas_caducidad();

SELECT is(
  pg_temp.contar('b0000000-0000-0000-0000-000000000001', 'caducidad'),
  (SELECT count(*)::int FROM alertas_caducidad WHERE estado = 'pendiente'),
  'caducidad: correr la generacion dos veces no repite notificaciones (una por alerta pendiente)'
);

-- ============================================================================
-- 2. Validacion
-- ============================================================================
-- La sesion la fija request.jwt.claim.sub: tr_autoaprobar_movimiento_inventario decide con
-- es_administrador(), que resuelve el rol por auth.uid().
SELECT set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000003', TRUE);

INSERT INTO movimientos_inventario (id, tipo, lote_id, bodega_id, cantidad, motivo, registrado_por)
VALUES ('b6000000-0000-0000-0000-000000000001', 'salida', 'b4000000-0000-0000-0000-000000000002',
        'b1000000-0000-0000-0000-000000000001', 2, 'Prueba 755', 'b0000000-0000-0000-0000-000000000003');

SELECT is(
  (SELECT count(*)::int FROM notificaciones
   WHERE perfil_id = 'b0000000-0000-0000-0000-000000000001'
     AND origen_id = 'b6000000-0000-0000-0000-000000000001' AND categoria = 'validacion'),
  1,
  'validacion: un movimiento pendiente de un voluntario notifica al administrador'
);

SELECT is(
  (SELECT enlace FROM notificaciones
   WHERE perfil_id = 'b0000000-0000-0000-0000-000000000001'
     AND origen_id = 'b6000000-0000-0000-0000-000000000001'),
  '/inventario?tab=validacion',
  'validacion: el enlace lleva a la bandeja de validacion'
);

SELECT set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000001', TRUE);

INSERT INTO movimientos_inventario (id, tipo, lote_id, bodega_id, cantidad, motivo, registrado_por)
VALUES ('b6000000-0000-0000-0000-000000000002', 'ingreso', 'b4000000-0000-0000-0000-000000000002',
        'b1000000-0000-0000-0000-000000000001', 1, 'Prueba 755 admin', 'b0000000-0000-0000-0000-000000000001');

SELECT is(
  (SELECT count(*)::int FROM notificaciones WHERE origen_id = 'b6000000-0000-0000-0000-000000000002'),
  0,
  'validacion: un movimiento de la administracion nace aprobado y no notifica'
);

-- ============================================================================
-- 3. Presupuestos
-- ============================================================================
SELECT set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000003', TRUE);

INSERT INTO gastos (id, jornada_id, concepto, categoria, monto, registrado_por)
VALUES ('b7000000-0000-0000-0000-000000000001', (SELECT id FROM jornadas ORDER BY id LIMIT 1),
        'Transporte 755', 'Logistica', 1250.5, 'b0000000-0000-0000-0000-000000000003');

SELECT is(
  (SELECT count(*)::int FROM notificaciones
   WHERE perfil_id = 'b0000000-0000-0000-0000-000000000001'
     AND origen_id = 'b7000000-0000-0000-0000-000000000001' AND categoria = 'presupuestos'),
  1,
  'presupuestos: un gasto pendiente notifica al administrador'
);

SELECT ok(
  (SELECT cuerpo FROM notificaciones
   WHERE perfil_id = 'b0000000-0000-0000-0000-000000000001'
     AND origen_id = 'b7000000-0000-0000-0000-000000000001') LIKE '%Q1,250.50%',
  'presupuestos: el monto sale con separadores fijos, sin depender de la configuracion regional'
);

SELECT set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000001', TRUE);

INSERT INTO gastos (id, jornada_id, concepto, categoria, monto, registrado_por)
VALUES ('b7000000-0000-0000-0000-000000000002', (SELECT id FROM jornadas ORDER BY id LIMIT 1),
        'Material 755', 'Logistica', 10, 'b0000000-0000-0000-0000-000000000001');

SELECT is(
  (SELECT count(*)::int FROM notificaciones WHERE origen_id = 'b7000000-0000-0000-0000-000000000002'),
  0,
  'presupuestos: un gasto de la administracion nace aprobado y no notifica'
);

SELECT set_config('request.jwt.claim.sub', '', TRUE);

-- ============================================================================
-- 4. Stock
-- ============================================================================
UPDATE existencias SET cantidad_disponible = 0 WHERE id = 'b5000000-0000-0000-0000-000000000001';

SELECT is(
  pg_temp.contar('b0000000-0000-0000-0000-000000000001', 'stock'),
  0,
  'stock: bajar un lote a cero no avisa si el medicamento aun tiene existencia en otro lote'
);

UPDATE existencias SET cantidad_disponible = 0 WHERE id = 'b5000000-0000-0000-0000-000000000002';

SELECT is(
  pg_temp.contar('b0000000-0000-0000-0000-000000000001', 'stock'),
  1,
  'stock: cuando el total del medicamento llega a cero, avisa'
);

UPDATE existencias SET cantidad_disponible = 0
WHERE id IN ('b5000000-0000-0000-0000-000000000001', 'b5000000-0000-0000-0000-000000000002');

SELECT is(
  pg_temp.contar('b0000000-0000-0000-0000-000000000001', 'stock'),
  1,
  'stock: volver a escribir cero no repite el aviso: se avisa la transicion, no el estado'
);

UPDATE existencias SET cantidad_disponible = 3 WHERE id = 'b5000000-0000-0000-0000-000000000002';
UPDATE existencias SET cantidad_disponible = 0 WHERE id = 'b5000000-0000-0000-0000-000000000002';

SELECT is(
  pg_temp.contar('b0000000-0000-0000-0000-000000000001', 'stock'),
  2,
  'stock: reponer y volver a agotar es otra incidencia, y avisa otra vez'
);

-- ============================================================================
-- 5. Correo: el webhook de pg_net y el reclamo de filas
-- ============================================================================
SELECT is(
  (SELECT count(*)::int FROM net.http_request_queue),
  0,
  'sin la URL en Vault no se encola ninguna peticion, y registrar la incidencia no falla'
);

SELECT vault.create_secret('http://localhost:9/functions/v1/enviar-notificaciones', 'notificaciones_url');
SELECT vault.create_secret('llave-de-prueba-755', 'notificaciones_llave');

UPDATE existencias SET cantidad_disponible = 3 WHERE id = 'b5000000-0000-0000-0000-000000000002';
UPDATE existencias SET cantidad_disponible = 0 WHERE id = 'b5000000-0000-0000-0000-000000000002';

SELECT is(
  (SELECT count(*)::int FROM net.http_request_queue
   WHERE url = 'http://localhost:9/functions/v1/enviar-notificaciones'),
  1,
  'con la URL en Vault, una incidencia encola UNA peticion aunque notifique a varios administradores'
);

SELECT ok(
  (SELECT count(*) FROM fn_reclamar_correos_de_notificaciones(1000)
   WHERE email = 'admin755@test.ecopac.local') > 0,
  'fn_reclamar_correos_de_notificaciones devuelve lo pendiente con el correo del destinatario'
);

SELECT is(
  (SELECT count(*)::int FROM fn_reclamar_correos_de_notificaciones(1000)),
  0,
  'una fila ya reclamada no se vuelve a reclamar: dos corridas no mandan el mismo correo'
);

-- ============================================================================
-- 6. RLS y GRANT
-- ============================================================================
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000001', TRUE);

SELECT is(
  (SELECT count(*)::int FROM notificaciones WHERE perfil_id <> 'b0000000-0000-0000-0000-000000000001'),
  0,
  'un administrador solo ve sus propias notificaciones, no las de los demas'
);

SELECT lives_ok(
  $$ UPDATE notificaciones SET leida_en = NOW()
     WHERE perfil_id = 'b0000000-0000-0000-0000-000000000001' $$,
  'un perfil puede marcar sus notificaciones como leidas'
);

SELECT throws_ok(
  $$ UPDATE notificaciones SET titulo = 'otro' $$,
  '42501',
  NULL,
  'un perfil no puede cambiar nada que no sea leida_en'
);

SELECT throws_ok(
  $$ INSERT INTO notificaciones (perfil_id, categoria, titulo, cuerpo, enlace, origen_tabla, origen_id)
     VALUES ('b0000000-0000-0000-0000-000000000001', 'stock', 't', 'c', '/', 'medicamentos',
             'b2000000-0000-0000-0000-000000000001') $$,
  '42501',
  NULL,
  'nadie inserta notificaciones desde la aplicacion'
);

SELECT throws_ok(
  $$ SELECT fn_reclamar_correos_de_notificaciones(10) $$,
  '42501',
  NULL,
  'authenticated no puede reclamar correos: es solo de la Edge Function con la llave de servicio'
);

SELECT set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000003', TRUE);

SELECT is(
  (SELECT count(*)::int FROM notificaciones),
  0,
  'un voluntario no ve ninguna notificacion de la administracion'
);

RESET ROLE;

SELECT * FROM finish();

ROLLBACK;
