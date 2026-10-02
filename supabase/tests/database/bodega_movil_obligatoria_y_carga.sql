-- Pruebas de la 00178 y la 00179: toda jornada nueva lleva bodega movil, la administradora la carga desde
-- otra bodega, y fn_consumo_de_insumos_de_jornada dice lo cargado, lo entregado y lo que queda.
-- Corre con: supabase test db
--
-- Corre como el rol dueno (sin RLS) y fija el sub de la sesion: la carga pregunta
-- es_administrador(), y tr_autoaprobar_movimiento_inventario aprueba lo que registra la
-- administradora.
--
-- Ningun dato real: la comunidad, el paciente, el medicamento y los lotes son inventados.

BEGIN;

SELECT plan(27);

-- ============================================================================
-- Setup
-- ============================================================================
INSERT INTO auth.users (id, email) VALUES
  ('d0000000-0000-0000-0000-000000000178', 'admin178@test.ecopac.local'),
  ('d0000000-0000-0000-0000-000000000179', 'voluntario178@test.ecopac.local');

ALTER TABLE perfiles DISABLE TRIGGER USER;
UPDATE perfiles SET rol = 'administrador' WHERE id = 'd0000000-0000-0000-0000-000000000178';
ALTER TABLE perfiles ENABLE TRIGGER USER;

INSERT INTO proyectos (id, nombre) VALUES
  ('d5000000-0000-0000-0000-000000000178', 'Proyecto de prueba 178');

INSERT INTO comunidades (id, municipio_id, nombre) VALUES
  ('d6000000-0000-0000-0000-000000000178', 101, 'Comunidad de prueba 178');

INSERT INTO bodegas (id, nombre, es_movil) VALUES
  ('d1000000-0000-0000-0000-000000000001', 'Bodega fija 178', FALSE),
  ('d1000000-0000-0000-0000-000000000002', 'Botiquin movil 178', TRUE),
  ('d1000000-0000-0000-0000-000000000003', 'Otro botiquin 178', TRUE);

INSERT INTO medicamentos (id, nombre, concentracion, presentacion_id, marca) VALUES
  ('d2000000-0000-0000-0000-000000000178', 'Medicamento 178', '500 mg',
   (SELECT id FROM presentaciones WHERE nombre = 'Tableta'), 'Generico');

INSERT INTO proveedores (id, nombre, tipo) VALUES
  ('d3000000-0000-0000-0000-000000000178', 'Proveedor 178', 'comercial');

INSERT INTO lotes (id, medicamento_id, proveedor_id, numero_lote, origen, cantidad_ingresada, fecha_ingreso, fecha_vencimiento, costo_unitario) VALUES
  ('d4000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000178', 'd3000000-0000-0000-0000-000000000178', 'L-178', 'compra', 100, CURRENT_DATE - 100, CURRENT_DATE + 365, 2.50),
  ('d4000000-0000-0000-0000-000000000002', 'd2000000-0000-0000-0000-000000000178', 'd3000000-0000-0000-0000-000000000178', 'L-178-V', 'compra', 10, CURRENT_DATE - 100, CURRENT_DATE - 1, NULL);

INSERT INTO existencias (lote_id, bodega_id, cantidad_disponible) VALUES
  ('d4000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 50),
  ('d4000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000001', 10);

CREATE FUNCTION pg_temp.stock(p_lote UUID, p_bodega UUID) RETURNS INT LANGUAGE sql AS $$
  SELECT COALESCE(SUM(cantidad_disponible), 0)::INT FROM existencias
  WHERE lote_id = p_lote AND bodega_id = p_bodega;
$$;

-- ============================================================================
-- 1. La bodega movil es obligatoria
-- ============================================================================
SELECT throws_ok(
  $$ INSERT INTO jornadas (nombre, fecha, comunidad_id, responsable_id, proyecto_id)
     VALUES ('Sin bodega 178', CURRENT_DATE + 5, 'd6000000-0000-0000-0000-000000000178',
             'd0000000-0000-0000-0000-000000000178', 'd5000000-0000-0000-0000-000000000178') $$,
  '23502', NULL,
  'una jornada nueva no nace sin bodega'
);

SELECT throws_ok(
  $$ INSERT INTO jornadas (nombre, fecha, comunidad_id, responsable_id, proyecto_id, botiquin_bodega_id)
     VALUES ('Bodega fija 178', CURRENT_DATE + 5, 'd6000000-0000-0000-0000-000000000178',
             'd0000000-0000-0000-0000-000000000178', 'd5000000-0000-0000-0000-000000000178',
             'd1000000-0000-0000-0000-000000000001') $$,
  '23514', NULL,
  'la bodega de una jornada tiene que ser movil'
);

INSERT INTO jornadas (id, nombre, fecha, comunidad_id, responsable_id, proyecto_id, botiquin_bodega_id)
VALUES ('d7000000-0000-0000-0000-000000000178', 'Jornada 178',
        (NOW() AT TIME ZONE 'America/Guatemala')::date,
        'd6000000-0000-0000-0000-000000000178', 'd0000000-0000-0000-0000-000000000178',
        'd5000000-0000-0000-0000-000000000178', 'd1000000-0000-0000-0000-000000000002');

SELECT pass('una jornada nace con una bodega movil');

SELECT throws_ok(
  $$ UPDATE jornadas SET botiquin_bodega_id = NULL
     WHERE id = 'd7000000-0000-0000-0000-000000000178' $$,
  '23502', NULL,
  'a una jornada no se le quita la bodega'
);

SELECT lives_ok(
  $$ UPDATE jornadas SET botiquin_bodega_id = 'd1000000-0000-0000-0000-000000000003'
     WHERE id = 'd7000000-0000-0000-0000-000000000178' $$,
  'se cambia por otra bodega movil'
);

UPDATE jornadas SET botiquin_bodega_id = 'd1000000-0000-0000-0000-000000000002'
WHERE id = 'd7000000-0000-0000-0000-000000000178';

-- ============================================================================
-- 2. La carga
-- ============================================================================
SELECT set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000179', TRUE);

SELECT throws_ok(
  $$ SELECT fn_cargar_insumo_a_bodega_de_jornada('d7000000-0000-0000-0000-000000000178',
       'd4000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 5) $$,
  '42501', NULL,
  'solo la administradora carga la bodega'
);

SELECT set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000178', TRUE);

SELECT throws_ok(
  $$ SELECT fn_cargar_insumo_a_bodega_de_jornada('d7000000-0000-0000-0000-000000000178',
       'd4000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 51) $$,
  '23514', NULL,
  'no se carga mas de lo que hay en el origen'
);

SELECT throws_ok(
  $$ SELECT fn_cargar_insumo_a_bodega_de_jornada('d7000000-0000-0000-0000-000000000178',
       'd4000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000002', 1) $$,
  '23514', NULL,
  'el origen no puede ser la misma bodega de la jornada'
);

SELECT throws_ok(
  $$ SELECT fn_cargar_insumo_a_bodega_de_jornada('d7000000-0000-0000-0000-000000000178',
       'd4000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000001', 1) $$,
  '23514', NULL,
  'un lote vencido no se lleva a la jornada'
);

SELECT lives_ok(
  $$ SELECT fn_cargar_insumo_a_bodega_de_jornada('d7000000-0000-0000-0000-000000000178',
       'd4000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 20) $$,
  'la administradora carga 20 unidades'
);

SELECT is(
  pg_temp.stock('d4000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001'),
  30,
  'salen 20 del origen'
);

SELECT is(
  pg_temp.stock('d4000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000002'),
  20,
  'entran 20 a la bodega movil'
);

SELECT is(
  (SELECT count(*)::int FROM movimientos_inventario
   WHERE jornada_id = 'd7000000-0000-0000-0000-000000000178' AND estado = 'aprobado'),
  2,
  'quedan un ingreso y una salida aprobados, marcados con la jornada'
);

-- ============================================================================
-- 3. El consumo
-- ============================================================================
-- Una receta entregada en la jornada: 6 unidades, ajustadas despues a 4.
UPDATE jornadas SET estado = 'en curso' WHERE id = 'd7000000-0000-0000-0000-000000000178';

INSERT INTO pacientes (id, nombres, apellidos, fecha_nacimiento, sexo, comunidad_id, telefono_contacto, idioma)
VALUES ('d8000000-0000-0000-0000-000000000178', 'Paciente', 'Prueba178', '1990-01-01', 'Femenino',
        'd6000000-0000-0000-0000-000000000178', '5555-0178', 'espanol');

INSERT INTO expedientes (id, paciente_id, numero_ficha)
VALUES ('d9000000-0000-0000-0000-000000000178', 'd8000000-0000-0000-0000-000000000178', 'F-178');

INSERT INTO atenciones (id, paciente_id, jornada_id)
VALUES ('da000000-0000-0000-0000-000000000178', 'd8000000-0000-0000-0000-000000000178',
        'd7000000-0000-0000-0000-000000000178');

INSERT INTO consultas (id, expediente_id, atencion_id, medico_id, jornada_id, motivo_consulta)
VALUES ('db000000-0000-0000-0000-000000000178', 'd9000000-0000-0000-0000-000000000178',
        'da000000-0000-0000-0000-000000000178', 'd0000000-0000-0000-0000-000000000178',
        'd7000000-0000-0000-0000-000000000178', 'motivo de prueba 178');

INSERT INTO recetas (id, consulta_id, medico_id)
VALUES ('dc000000-0000-0000-0000-000000000178', 'db000000-0000-0000-0000-000000000178',
        'd0000000-0000-0000-0000-000000000178');

INSERT INTO receta_detalle (receta_id, medicamento_id, lote_id, bodega_id, dosis, frecuencia, duracion,
                            cantidad_entregada, cantidad_ajustada, ajustada_por, ajustada_en)
VALUES ('dc000000-0000-0000-0000-000000000178', 'd2000000-0000-0000-0000-000000000178',
        'd4000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000002',
        '1 tableta', 'cada 8h', '3 dias', 6, 4, 'd0000000-0000-0000-0000-000000000178', NOW());

SELECT is(
  (SELECT cargado::int FROM fn_consumo_de_insumos_de_jornada('d7000000-0000-0000-0000-000000000178')
   WHERE lote_id = 'd4000000-0000-0000-0000-000000000001'),
  20,
  'el consumo dice lo cargado'
);

SELECT is(
  (SELECT entregado::int FROM fn_consumo_de_insumos_de_jornada('d7000000-0000-0000-0000-000000000178')
   WHERE lote_id = 'd4000000-0000-0000-0000-000000000001'),
  4,
  'lo entregado usa la cantidad ajustada'
);

SELECT is(
  (SELECT costo_unitario FROM fn_consumo_de_insumos_de_jornada('d7000000-0000-0000-0000-000000000178')
   WHERE lote_id = 'd4000000-0000-0000-0000-000000000001'),
  2.50::numeric,
  'trae el costo unitario del lote'
);

-- Anulada, la receta deja de contar.
UPDATE recetas
SET estado = 'anulada', motivo_anulacion = 'prueba', anulada_por = 'd0000000-0000-0000-0000-000000000178',
    anulada_en = NOW()
WHERE id = 'dc000000-0000-0000-0000-000000000178';

SELECT is(
  (SELECT entregado::int FROM fn_consumo_de_insumos_de_jornada('d7000000-0000-0000-0000-000000000178')
   WHERE lote_id = 'd4000000-0000-0000-0000-000000000001'),
  0,
  'una receta anulada no cuenta como entregada'
);

-- ============================================================================
-- 4. Traslados y devolucion (00179)
-- ============================================================================
SELECT set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000179', TRUE);

SELECT throws_ok(
  $$ SELECT fn_trasladar_entre_bodegas('d4000000-0000-0000-0000-000000000001',
       'd1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000003', 5) $$,
  '42501', NULL,
  'solo la administradora traslada entre bodegas'
);

SELECT set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000178', TRUE);

SELECT lives_ok(
  $$ SELECT fn_trasladar_entre_bodegas('d4000000-0000-0000-0000-000000000001',
       'd1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000003', 5) $$,
  'la administradora traslada 5 unidades'
);

SELECT is(
  pg_temp.stock('d4000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000003'),
  5,
  'el traslado entra a la bodega destino, no se pierde'
);

SELECT is(
  pg_temp.stock('d4000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001'),
  25,
  'y sale del origen'
);

SELECT throws_ok(
  $$ SELECT fn_devolver_de_bodega_de_jornada('d7000000-0000-0000-0000-000000000178',
       'd4000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000003', 1) $$,
  '23514', NULL,
  'lo que sobra se devuelve a una bodega fija'
);

SELECT lives_ok(
  $$ SELECT fn_devolver_de_bodega_de_jornada('d7000000-0000-0000-0000-000000000178',
       'd4000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 8) $$,
  'se devuelven 8 a la bodega fija'
);

SELECT results_eq(
  $$ SELECT cargado::int, devuelto::int, en_bodega::int
     FROM fn_consumo_de_insumos_de_jornada('d7000000-0000-0000-0000-000000000178')
     WHERE lote_id = 'd4000000-0000-0000-0000-000000000001' $$,
  $$ VALUES (20, 8, 12) $$,
  'el consumo cuenta lo devuelto y el ingreso a la fija no pasa por cargado'
);

-- ============================================================================
-- 5. Una bodega movil no esta en dos jornadas en curso (00179)
-- ============================================================================
INSERT INTO jornadas (id, nombre, fecha, comunidad_id, responsable_id, proyecto_id, botiquin_bodega_id)
VALUES ('d7000000-0000-0000-0000-000000000179', 'Otra jornada 179',
        (NOW() AT TIME ZONE 'America/Guatemala')::date,
        'd6000000-0000-0000-0000-000000000178', 'd0000000-0000-0000-0000-000000000178',
        'd5000000-0000-0000-0000-000000000178', 'd1000000-0000-0000-0000-000000000002');

SELECT pass('una jornada planificada si comparte la bodega con otra en curso');

SELECT throws_ok(
  $$ UPDATE jornadas SET estado = 'en curso' WHERE id = 'd7000000-0000-0000-0000-000000000179' $$,
  '55000', NULL,
  'no se inicia con una bodega que esta en otra jornada en curso'
);

SELECT lives_ok(
  $$ UPDATE jornadas SET botiquin_bodega_id = 'd1000000-0000-0000-0000-000000000003', estado = 'en curso'
     WHERE id = 'd7000000-0000-0000-0000-000000000179' $$,
  'con otra bodega movil si se inicia'
);

SELECT * FROM finish();
ROLLBACK;
