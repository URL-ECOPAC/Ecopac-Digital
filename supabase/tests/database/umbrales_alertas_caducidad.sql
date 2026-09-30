-- Pruebas de las antelaciones configurables de los avisos de vencimiento (issue #899, 00162).
-- Corre con: supabase test db
--
-- Que se comprueba:
--   - La configuracion por defecto es {90}, se ordena sola y rechaza lo que no cumple la regla:
--     de 0 a 4 antelaciones distintas entre 1 y 365 dias. Sin ninguna, solo se avisa el dia del
--     vencimiento.
--   - Solo la administracion la cambia (RLS), o quien tenga el permiso fino
--     inventario.configurar_alertas, y el cambio queda en la bitacora.
--   - fn_hoy_guatemala() usa la fecha de Guatemala, no la UTC.
--   - Cada etapa -cada antelacion y el dia del vencimiento- produce un aviso y una notificacion por
--     administrador activo, sin repetirse al volver a correr la rutina. Una alerta nueva avisa
--     solo su etapa actual, no todas las que ya dejo atras.
--   - Una alerta pendiente cuyo lote se quedo sin existencia se cierra sola, y si el lote se
--     repone vuelve a alertar.
--   - Un lote atendido (reubicado) vuelve a alertar al llegar a una etapa mas cercana.
--
-- config.toml corre seed.sql y seed-demo.sql antes de esta suite; por eso todo se cuenta sobre los
-- lotes de esta prueba. Ningun dato real: perfiles, medicamento y lotes son inventados.

BEGIN;

SELECT plan(30);

-- ============================================================================
-- Setup
-- ============================================================================
INSERT INTO auth.users (id, email) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'admin899@test.ecopac.local'),
  ('c0000000-0000-0000-0000-000000000002', 'medico899@test.ecopac.local');

ALTER TABLE perfiles DISABLE TRIGGER USER;
UPDATE perfiles SET rol = 'administrador' WHERE id = 'c0000000-0000-0000-0000-000000000001';
UPDATE perfiles SET rol = 'medico' WHERE id = 'c0000000-0000-0000-0000-000000000002';
ALTER TABLE perfiles ENABLE TRIGGER USER;

INSERT INTO bodegas (id, nombre, es_movil) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'Bodega 899', FALSE);

INSERT INTO medicamentos (id, nombre, concentracion, presentacion_id, marca) VALUES
  ('c2000000-0000-0000-0000-000000000001', 'Medicamento 899', '500mg',
   (SELECT id FROM presentaciones WHERE nombre = 'Tableta'), 'Generico');

INSERT INTO proveedores (id, nombre, tipo) VALUES
  ('c3000000-0000-0000-0000-000000000001', 'Proveedor 899', 'comercial');

-- Lote 1: recorre las etapas. Lote 2: fuera de la ventana. Lote 3: se queda sin existencia.
-- Lote 4: atendido (reubicado).
INSERT INTO lotes (id, medicamento_id, proveedor_id, numero_lote, origen, cantidad_ingresada, fecha_ingreso, fecha_vencimiento) VALUES
  ('c4000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-000000000001', 'L-899-1', 'compra', 100, fn_hoy_guatemala() - 400, fn_hoy_guatemala() + 25),
  ('c4000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-000000000001', 'L-899-2', 'compra', 100, fn_hoy_guatemala() - 400, fn_hoy_guatemala() + 91),
  ('c4000000-0000-0000-0000-000000000003', 'c2000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-000000000001', 'L-899-3', 'compra', 100, fn_hoy_guatemala() - 400, fn_hoy_guatemala() + 10),
  ('c4000000-0000-0000-0000-000000000004', 'c2000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-000000000001', 'L-899-4', 'compra', 100, fn_hoy_guatemala() - 400, fn_hoy_guatemala() + 25);

INSERT INTO existencias (id, lote_id, bodega_id, cantidad_disponible) VALUES
  ('c5000000-0000-0000-0000-000000000001', 'c4000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 8),
  ('c5000000-0000-0000-0000-000000000002', 'c4000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001', 8),
  ('c5000000-0000-0000-0000-000000000003', 'c4000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000001', 8),
  ('c5000000-0000-0000-0000-000000000004', 'c4000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000001', 8);

-- El lote 4 se reubico hace 25 dias, cuando le faltaban 50 (etapa de 60 con {90,60,30,7}).
INSERT INTO alertas_caducidad (lote_id, estado, cantidad_afectada, accion, atendida_por, atendida_en) VALUES
  ('c4000000-0000-0000-0000-000000000004', 'atendida', 8, 'reubicado',
   'c0000000-0000-0000-0000-000000000001', now() - INTERVAL '25 days');

-- Avisos y notificaciones del administrador de esta prueba para un lote.
CREATE FUNCTION pg_temp.avisos(p_lote UUID)
RETURNS INT[] LANGUAGE sql AS $$
  SELECT COALESCE(array_agg(av.umbral_dias ORDER BY av.created_at, av.umbral_dias DESC), '{}')
  FROM avisos_caducidad av JOIN alertas_caducidad a ON a.id = av.alerta_id
  WHERE a.lote_id = p_lote;
$$;

CREATE FUNCTION pg_temp.notificaciones(p_lote UUID)
RETURNS INT LANGUAGE sql AS $$
  SELECT count(*)::int FROM notificaciones n
  JOIN avisos_caducidad av ON av.id = n.origen_id
  JOIN alertas_caducidad a ON a.id = av.alerta_id
  WHERE a.lote_id = p_lote AND n.perfil_id = 'c0000000-0000-0000-0000-000000000001';
$$;

-- ============================================================================
-- 1. Configuracion
-- ============================================================================
SELECT is(
  (SELECT umbrales_dias FROM configuracion_alertas_caducidad),
  '{90}'::int[],
  'la antelacion por defecto es de 90 dias'
);

SELECT throws_ok(
  $$ UPDATE configuracion_alertas_caducidad SET umbrales_dias = '{90,60,30,15,7}' $$,
  '23514', NULL,
  'no admite mas de cuatro antelaciones'
);

SELECT throws_ok(
  $$ UPDATE configuracion_alertas_caducidad SET umbrales_dias = '{30,30}' $$,
  '23514', NULL,
  'no admite antelaciones repetidas'
);

SELECT throws_ok(
  $$ UPDATE configuracion_alertas_caducidad SET umbrales_dias = '{0}' $$,
  '23514', NULL,
  'no admite una antelacion de 0 dias: el dia del vencimiento ya se avisa siempre'
);

SELECT throws_ok(
  $$ UPDATE configuracion_alertas_caducidad SET umbrales_dias = '{366}' $$,
  '23514', NULL,
  'no admite una antelacion de mas de 365 dias'
);

SELECT lives_ok(
  $$ UPDATE configuracion_alertas_caducidad SET umbrales_dias = '{}' $$,
  'admite quedarse sin antelaciones: solo avisa el dia del vencimiento'
);
UPDATE configuracion_alertas_caducidad SET umbrales_dias = '{90}';

SELECT throws_ok(
  $$ INSERT INTO configuracion_alertas_caducidad DEFAULT VALUES $$,
  '23505', NULL,
  'la configuracion es una sola fila'
);

-- Un medico no puede cambiarla: la politica no le deja ver la fila para actualizarla.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000002', TRUE);

SELECT is(
  (SELECT umbrales_dias FROM configuracion_alertas_caducidad),
  '{90}'::int[],
  'un medico con sesion activa si puede leer la configuracion'
);

UPDATE configuracion_alertas_caducidad SET umbrales_dias = '{10}';

-- La administracion si.
SELECT set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000001', TRUE);
UPDATE configuracion_alertas_caducidad SET umbrales_dias = '{7,90,30,60}';
RESET ROLE;

SELECT is(
  (SELECT umbrales_dias FROM configuracion_alertas_caducidad),
  '{90,60,30,7}'::int[],
  'el medico no cambio nada, y lo que guardo la administracion quedo ordenado de mayor a menor'
);

SELECT is(
  (SELECT actualizado_por FROM configuracion_alertas_caducidad),
  'c0000000-0000-0000-0000-000000000001'::uuid,
  'la configuracion registra quien la cambio'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM eventos_auditoria
    WHERE tabla_afectada = 'configuracion_alertas_caducidad' AND operacion = 'actualizacion'
      AND realizado_por = 'c0000000-0000-0000-0000-000000000001'
  ),
  'el cambio de configuracion queda en la bitacora'
);

SELECT is(
  fn_hoy_guatemala('2026-10-01 03:00:00+00'),
  '2026-09-30'::date,
  'a las 03:00 UTC en Guatemala todavia es el dia anterior'
);

-- ============================================================================
-- 2. Un aviso por etapa
-- ============================================================================
-- Configuracion {90,60,30,7}. El lote 1 vence en 25 dias: su etapa es la de 30.
SELECT fn_generar_alertas_caducidad();

SELECT is(
  pg_temp.avisos('c4000000-0000-0000-0000-000000000001'),
  '{30}'::int[],
  'un lote nuevo a 25 dias avisa solo su etapa actual (30), no las de 90 y 60 que ya dejo atras'
);

SELECT is(
  (SELECT n.titulo FROM notificaciones n
   JOIN avisos_caducidad av ON av.id = n.origen_id
   JOIN alertas_caducidad a ON a.id = av.alerta_id
   WHERE a.lote_id = 'c4000000-0000-0000-0000-000000000001'
     AND n.perfil_id = 'c0000000-0000-0000-0000-000000000001'),
  'Lote por vencer en 25 días: Medicamento 899',
  'la notificacion dice cuantos dias faltan'
);

SELECT is(
  pg_temp.avisos('c4000000-0000-0000-0000-000000000002'),
  '{}'::int[],
  'un lote a 91 dias esta fuera de la ventana de 90 y no avisa'
);

SELECT fn_generar_alertas_caducidad();

SELECT is(
  pg_temp.notificaciones('c4000000-0000-0000-0000-000000000001'),
  1,
  'correr la rutina otra vez el mismo dia no repite el aviso'
);

-- Pasa el tiempo: al lote le quedan 5 dias, entra a la etapa de 7.
UPDATE lotes SET fecha_vencimiento = fn_hoy_guatemala() + 5
WHERE id = 'c4000000-0000-0000-0000-000000000001';
SELECT fn_generar_alertas_caducidad();

-- Llega el dia del vencimiento.
UPDATE lotes SET fecha_vencimiento = fn_hoy_guatemala()
WHERE id = 'c4000000-0000-0000-0000-000000000001';
SELECT fn_generar_alertas_caducidad();

SELECT is(
  pg_temp.avisos('c4000000-0000-0000-0000-000000000001'),
  '{30,7,0}'::int[],
  'la misma alerta pendiente avisa en cada etapa: 30, 7 y el dia del vencimiento'
);

SELECT is(
  pg_temp.notificaciones('c4000000-0000-0000-0000-000000000001'),
  3,
  'cada aviso llega como una notificacion distinta al administrador'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM notificaciones n
    JOIN avisos_caducidad av ON av.id = n.origen_id
    JOIN alertas_caducidad a ON a.id = av.alerta_id
    WHERE a.lote_id = 'c4000000-0000-0000-0000-000000000001'
      AND n.titulo = 'Lote vence hoy: Medicamento 899'
  ),
  'el dia del vencimiento llega "Lote vence hoy"'
);

-- Un dia despues ya vencio: la etapa 0 ya se aviso, no se repite.
UPDATE lotes SET fecha_vencimiento = fn_hoy_guatemala() - 1
WHERE id = 'c4000000-0000-0000-0000-000000000001';
SELECT fn_generar_alertas_caducidad();

SELECT is(
  pg_temp.notificaciones('c4000000-0000-0000-0000-000000000001'),
  3,
  'el aviso del vencimiento no se repite los dias siguientes'
);

-- ============================================================================
-- 3. Cierre sin existencia y reposicion
-- ============================================================================
UPDATE existencias SET cantidad_disponible = 0 WHERE id = 'c5000000-0000-0000-0000-000000000003';
SELECT fn_generar_alertas_caducidad();

SELECT ok(
  EXISTS (
    SELECT 1 FROM alertas_caducidad
    WHERE lote_id = 'c4000000-0000-0000-0000-000000000003'
      AND estado = 'atendida' AND cerrada_sin_existencia AND atendida_por IS NULL
  ),
  'la alerta pendiente de un lote que se quedo sin existencia se cierra sola'
);

UPDATE existencias SET cantidad_disponible = 3 WHERE id = 'c5000000-0000-0000-0000-000000000003';
SELECT fn_generar_alertas_caducidad();

SELECT is(
  (SELECT count(*)::int FROM alertas_caducidad
   WHERE lote_id = 'c4000000-0000-0000-0000-000000000003' AND estado = 'pendiente'),
  1,
  'si el lote se repone, vuelve a tener una alerta pendiente'
);

-- ============================================================================
-- 4. Lote atendido
-- ============================================================================
-- Se reubico en la etapa de 60 (hace 25 dias le faltaban 50). Hoy le faltan 25: etapa de 30.
SELECT is(
  (SELECT count(*)::int FROM alertas_caducidad
   WHERE lote_id = 'c4000000-0000-0000-0000-000000000004' AND estado = 'pendiente'),
  1,
  'un lote reubicado en la etapa de 60 vuelve a alertar al llegar a la de 30'
);

-- Si se hubiera reubicado hoy, en la etapa de 30, no volveria a alertar hasta la de 7.
UPDATE alertas_caducidad SET estado = 'atendida', accion = 'reubicado',
  atendida_por = 'c0000000-0000-0000-0000-000000000001', atendida_en = now()
WHERE lote_id = 'c4000000-0000-0000-0000-000000000004' AND estado = 'pendiente';
SELECT fn_generar_alertas_caducidad();

SELECT is(
  (SELECT count(*)::int FROM alertas_caducidad
   WHERE lote_id = 'c4000000-0000-0000-0000-000000000004' AND estado = 'pendiente'),
  0,
  'un lote atendido no vuelve a alertar mientras siga en la misma etapa'
);

-- ============================================================================
-- 5. Permiso delegado: inventario.configurar_alertas
-- ============================================================================
INSERT INTO usuario_permiso (perfil_id, permiso_id, concedido, otorgado_por)
SELECT 'c0000000-0000-0000-0000-000000000002', id, TRUE, 'c0000000-0000-0000-0000-000000000001'
FROM permisos WHERE clave = 'inventario.configurar_alertas';

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000002', TRUE);

UPDATE configuracion_alertas_caducidad SET umbrales_dias = '{45}';

SELECT lives_ok(
  $$ SELECT fn_sincronizar_alertas_caducidad() $$,
  'un medico con inventario.configurar_alertas puede sincronizar las alertas'
);

SELECT throws_ok(
  $$ SELECT fn_atender_alerta_caducidad(
       (SELECT id FROM alertas_caducidad WHERE estado = 'pendiente' LIMIT 1),
       '[{"accion":"descartado","cantidad":1}]'::jsonb) $$,
  '42501', NULL,
  'el permiso de configurar no da el de atender alertas'
);
RESET ROLE;

SELECT is(
  (SELECT umbrales_dias FROM configuracion_alertas_caducidad),
  '{45}'::int[],
  'un medico con inventario.configurar_alertas si puede cambiar la configuracion'
);

-- ============================================================================
-- 6. Sin antelaciones: solo el dia del vencimiento
-- ============================================================================
UPDATE configuracion_alertas_caducidad SET umbrales_dias = '{}';

INSERT INTO lotes (id, medicamento_id, proveedor_id, numero_lote, origen, cantidad_ingresada, fecha_ingreso, fecha_vencimiento) VALUES
  ('c4000000-0000-0000-0000-000000000005', 'c2000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-000000000001', 'L-899-5', 'compra', 100, fn_hoy_guatemala() - 400, fn_hoy_guatemala() + 3);
INSERT INTO existencias (lote_id, bodega_id, cantidad_disponible) VALUES
  ('c4000000-0000-0000-0000-000000000005', 'c1000000-0000-0000-0000-000000000001', 8);

SELECT fn_generar_alertas_caducidad();

SELECT is(
  (SELECT count(*)::int FROM alertas_caducidad WHERE lote_id = 'c4000000-0000-0000-0000-000000000005'),
  0,
  'sin antelaciones, un lote a 3 dias todavia no alerta'
);

UPDATE lotes SET fecha_vencimiento = fn_hoy_guatemala()
WHERE id = 'c4000000-0000-0000-0000-000000000005';
SELECT fn_generar_alertas_caducidad();

SELECT is(
  pg_temp.avisos('c4000000-0000-0000-0000-000000000005'),
  '{0}'::int[],
  'sin antelaciones, el dia del vencimiento si avisa'
);

SELECT is(
  pg_temp.notificaciones('c4000000-0000-0000-0000-000000000005'),
  1,
  'y ese aviso llega como notificacion'
);

SELECT * FROM finish();

ROLLBACK;
