-- Pruebas de la 00186 (issue #925): el inventario de una jornada se cuenta por jornada y lo
-- pendiente ya esta comprometido. Corre con: supabase test db
--
-- Corre como el rol dueno (sin RLS) y fija el sub de la sesion: las funciones preguntan
-- es_administrador() y registran con auth.uid(). Ningun dato real: todo es inventado.

BEGIN;

SELECT plan(28);

-- ============================================================================
-- Setup
-- ============================================================================
INSERT INTO auth.users (id, email) VALUES
  ('f0000000-0000-0000-0000-000000000186', 'admin186@test.ecopac.local'),
  ('f0000000-0000-0000-0000-000000000187', 'medico186@test.ecopac.local');

ALTER TABLE perfiles DISABLE TRIGGER USER;
UPDATE perfiles SET rol = 'administrador' WHERE id = 'f0000000-0000-0000-0000-000000000186';
UPDATE perfiles SET rol = 'medico' WHERE id = 'f0000000-0000-0000-0000-000000000187';
ALTER TABLE perfiles ENABLE TRIGGER USER;

INSERT INTO proyectos (id, nombre) VALUES
  ('f5000000-0000-0000-0000-000000000001', 'Proyecto 186 uno'),
  ('f5000000-0000-0000-0000-000000000002', 'Proyecto 186 dos');

INSERT INTO comunidades (id, municipio_id, nombre) VALUES
  ('f6000000-0000-0000-0000-000000000186', 101, 'Comunidad de prueba 186');

INSERT INTO bodegas (id, nombre, es_movil) VALUES
  ('f1000000-0000-0000-0000-000000000001', 'Botiquin 186 uno', TRUE),
  ('f1000000-0000-0000-0000-000000000002', 'Botiquin 186 dos', TRUE);

CREATE TEMP VIEW principal_186 AS SELECT id FROM bodegas WHERE es_principal;

INSERT INTO medicamentos (id, nombre, concentracion, presentacion_id, marca) VALUES
  ('f2000000-0000-0000-0000-000000000186', 'Medicamento 186', '10 mg',
   (SELECT id FROM presentaciones WHERE nombre = 'Tableta'), 'Generico');

INSERT INTO proveedores (id, nombre, tipo) VALUES
  ('f3000000-0000-0000-0000-000000000186', 'Proveedor 186', 'comercial');

INSERT INTO lotes (id, medicamento_id, proveedor_id, numero_lote, origen, cantidad_ingresada, fecha_ingreso, fecha_vencimiento, costo_unitario) VALUES
  ('f4000000-0000-0000-0000-000000000186', 'f2000000-0000-0000-0000-000000000186',
   'f3000000-0000-0000-0000-000000000186', 'L-186', 'compra', 100, CURRENT_DATE - 30,
   CURRENT_DATE + 365, 2.00);

INSERT INTO existencias (lote_id, bodega_id, cantidad_disponible) VALUES
  ('f4000000-0000-0000-0000-000000000186', (SELECT id FROM principal_186), 100);

-- J1 y J3 del proyecto uno con el botiquin uno; J2 del proyecto dos con el botiquin dos; J4 del
-- proyecto dos con el botiquin uno (planificadas pueden compartir bodega, 00179).
INSERT INTO jornadas (id, nombre, fecha, comunidad_id, responsable_id, proyecto_id, botiquin_bodega_id) VALUES
  ('f7000000-0000-0000-0000-000000000001', 'Jornada 186 J1', (NOW() AT TIME ZONE 'America/Guatemala')::date,
   'f6000000-0000-0000-0000-000000000186', 'f0000000-0000-0000-0000-000000000186',
   'f5000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001'),
  ('f7000000-0000-0000-0000-000000000002', 'Jornada 186 J2', (NOW() AT TIME ZONE 'America/Guatemala')::date,
   'f6000000-0000-0000-0000-000000000186', 'f0000000-0000-0000-0000-000000000186',
   'f5000000-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-000000000002'),
  ('f7000000-0000-0000-0000-000000000003', 'Jornada 186 J3', (NOW() AT TIME ZONE 'America/Guatemala')::date,
   'f6000000-0000-0000-0000-000000000186', 'f0000000-0000-0000-0000-000000000186',
   'f5000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001'),
  ('f7000000-0000-0000-0000-000000000004', 'Jornada 186 J4', (NOW() AT TIME ZONE 'America/Guatemala')::date,
   'f6000000-0000-0000-0000-000000000186', 'f0000000-0000-0000-0000-000000000186',
   'f5000000-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-000000000001');

INSERT INTO pacientes (id, nombres, apellidos, fecha_nacimiento, sexo, comunidad_id, telefono_contacto, idioma)
VALUES
  ('f8000000-0000-0000-0000-000000000186', 'Paciente', 'Prueba186', '1990-01-01', 'Femenino',
   'f6000000-0000-0000-0000-000000000186', '5555-0186', 'espanol'),
  ('f8000000-0000-0000-0000-000000000187', 'Paciente', 'Prueba187', '1991-01-01', 'Masculino',
   'f6000000-0000-0000-0000-000000000186', '5555-0187', 'espanol');

INSERT INTO expedientes (id, paciente_id, numero_ficha) VALUES
  ('f9000000-0000-0000-0000-000000000186', 'f8000000-0000-0000-0000-000000000186', 'F-186'),
  ('f9000000-0000-0000-0000-000000000187', 'f8000000-0000-0000-0000-000000000187', 'F-187');

CREATE TEMP VIEW consumo_j1 AS
  SELECT * FROM fn_consumo_de_insumos_de_jornada('f7000000-0000-0000-0000-000000000001')
  WHERE lote_id = 'f4000000-0000-0000-0000-000000000186';

-- ============================================================================
-- 1. Cargar e iniciar: lo que ya es de la jornada no se traspasa
-- ============================================================================
SELECT set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000186', TRUE);

SELECT fn_cargar_insumo_a_bodega_de_jornada('f7000000-0000-0000-0000-000000000001',
  'f4000000-0000-0000-0000-000000000186', (SELECT id FROM principal_186), 20);

UPDATE jornadas SET estado = 'en curso' WHERE id = 'f7000000-0000-0000-0000-000000000001';

-- Una atencion solo se registra en una jornada en curso.
INSERT INTO atenciones (id, paciente_id, jornada_id) VALUES
  ('fa000000-0000-0000-0000-000000000001', 'f8000000-0000-0000-0000-000000000186',
   'f7000000-0000-0000-0000-000000000001'),
  ('fa000000-0000-0000-0000-000000000002', 'f8000000-0000-0000-0000-000000000187',
   'f7000000-0000-0000-0000-000000000001');

INSERT INTO consultas (id, expediente_id, atencion_id, medico_id, jornada_id, motivo_consulta) VALUES
  ('fb000000-0000-0000-0000-000000000001', 'f9000000-0000-0000-0000-000000000186',
   'fa000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000187',
   'f7000000-0000-0000-0000-000000000001', 'motivo de prueba 186'),
  ('fb000000-0000-0000-0000-000000000002', 'f9000000-0000-0000-0000-000000000187',
   'fa000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000186',
   'f7000000-0000-0000-0000-000000000001', 'otro motivo de prueba 186');

SELECT is(
  (SELECT COUNT(*) FROM movimientos_inventario WHERE motivo LIKE 'Traspaso a la jornada Jornada 186 J1%'),
  0::bigint,
  'iniciar una jornada cuya bodega solo tiene lo suyo no registra traspaso'
);

-- ============================================================================
-- 2. 1B: la receta del medico queda pendiente, enlazada y comprometida
-- ============================================================================
SELECT set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000187', TRUE);

CREATE TEMP TABLE receta_medico AS
SELECT fn_generar_receta(
  'fb000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000187', NULL,
  '[{"medicamento_id": "f2000000-0000-0000-0000-000000000186",
     "lote_id": "f4000000-0000-0000-0000-000000000186",
     "bodega_id": "f1000000-0000-0000-0000-000000000001",
     "dosis": "1", "frecuencia": "cada 8h", "duracion": "3 dias",
     "cantidad_entregada": 5}]'::jsonb
) AS id;

SELECT is(
  (SELECT estado::TEXT FROM movimientos_inventario WHERE receta_id = (SELECT id FROM receta_medico)),
  'pendiente',
  'la salida de la receta del medico queda pendiente y enlazada a la receta'
);

SELECT results_eq(
  $$ SELECT cantidad_disponible, cantidad_fisica, cantidad_comprometida
     FROM vista_lotes_disponibles
     WHERE lote_id = 'f4000000-0000-0000-0000-000000000186'
       AND bodega_id = 'f1000000-0000-0000-0000-000000000001' $$,
  $$ VALUES (15, 20, 5) $$,
  'lo disponible descuenta lo comprometido en la salida pendiente'
);

SELECT throws_ok(
  $$ SELECT fn_generar_receta(
       'fb000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000187', NULL,
       '[{"medicamento_id": "f2000000-0000-0000-0000-000000000186",
          "lote_id": "f4000000-0000-0000-0000-000000000186",
          "bodega_id": "f1000000-0000-0000-0000-000000000001",
          "dosis": "1", "frecuencia": "cada 8h", "duracion": "3 dias",
          "cantidad_entregada": 16}]'::jsonb) $$,
  'Existencia insuficiente en el lote f4000000-0000-0000-0000-000000000186. Disponible: 15, solicitado: 16.',
  'la siguiente receta no puede usar lo comprometido'
);

-- ============================================================================
-- 3. 2A: consumo por jornada
-- ============================================================================
SELECT set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000186', TRUE);

SELECT results_eq(
  $$ SELECT cargado, entregado, devuelto, pendiente, queda, en_bodega FROM consumo_j1 $$,
  $$ VALUES (20::bigint, 5::bigint, 0::bigint, 5::bigint, 15::bigint, 20::bigint) $$,
  'queda es cargado - entregado - devuelto, y lo pendiente se ve aparte'
);

SELECT throws_ok(
  $$ SELECT fn_devolver_de_bodega_de_jornada('f7000000-0000-0000-0000-000000000001',
       'f4000000-0000-0000-0000-000000000186', (SELECT id FROM principal_186), 16) $$,
  '23514',
  'De ese lote, a esta jornada le quedan 15 unidad(es): no se puede devolver mas.',
  'no se devuelve mas de lo que le queda a la jornada'
);

-- ============================================================================
-- 4. 3B: cargar desde la bodega de otra jornada en curso queda en las dos
-- ============================================================================
SELECT lives_ok(
  $$ SELECT fn_cargar_insumo_a_bodega_de_jornada('f7000000-0000-0000-0000-000000000002',
       'f4000000-0000-0000-0000-000000000186', 'f1000000-0000-0000-0000-000000000001', 4) $$,
  'se puede cargar desde la bodega movil de otra jornada en curso'
);

SELECT is((SELECT devuelto FROM consumo_j1), 4::bigint,
  'lo que salio de su bodega cuenta como devuelto en la jornada que la tenia');

SELECT is(
  (SELECT cargado FROM fn_consumo_de_insumos_de_jornada('f7000000-0000-0000-0000-000000000002')
   WHERE lote_id = 'f4000000-0000-0000-0000-000000000186'),
  4::bigint,
  'y como cargado en la que lo recibe'
);

-- ============================================================================
-- 5. 4A: anular una receta
-- ============================================================================
SELECT set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000187', TRUE);

UPDATE recetas
SET estado = 'anulada', motivo_anulacion = 'prueba 186',
    anulada_por = 'f0000000-0000-0000-0000-000000000187', anulada_en = NOW()
WHERE id = (SELECT id FROM receta_medico);

SELECT is(
  (SELECT estado::TEXT FROM movimientos_inventario
   WHERE receta_id = (SELECT id FROM receta_medico) AND tipo = 'salida'),
  'rechazado',
  'anular la receta rechaza su salida pendiente'
);

SELECT set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000186', TRUE);

SELECT results_eq(
  $$ SELECT entregado, pendiente, queda FROM consumo_j1 $$,
  $$ VALUES (0::bigint, 0::bigint, 16::bigint) $$,
  'una receta anulada deja de contar y lo comprometido se libera'
);

-- Una receta de la administradora se aprueba al emitirla; anularla devuelve lo que salio.
CREATE TEMP TABLE receta_admin AS
SELECT fn_generar_receta(
  'fb000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000186', NULL,
  '[{"medicamento_id": "f2000000-0000-0000-0000-000000000186",
     "lote_id": "f4000000-0000-0000-0000-000000000186",
     "bodega_id": "f1000000-0000-0000-0000-000000000001",
     "dosis": "1", "frecuencia": "cada 8h", "duracion": "3 dias",
     "cantidad_entregada": 3}]'::jsonb
) AS id;

SELECT is(
  (SELECT cantidad_disponible FROM existencias
   WHERE lote_id = 'f4000000-0000-0000-0000-000000000186'
     AND bodega_id = 'f1000000-0000-0000-0000-000000000001'),
  13,
  'la receta aprobada desconto la existencia'
);

UPDATE recetas
SET estado = 'anulada', motivo_anulacion = 'prueba 186 admin',
    anulada_por = 'f0000000-0000-0000-0000-000000000186', anulada_en = NOW()
WHERE id = (SELECT id FROM receta_admin);

SELECT is(
  (SELECT cantidad_disponible FROM existencias
   WHERE lote_id = 'f4000000-0000-0000-0000-000000000186'
     AND bodega_id = 'f1000000-0000-0000-0000-000000000001'),
  16,
  'anular la receta aprobada devuelve el medicamento a la bodega'
);

SELECT is((SELECT queda FROM consumo_j1), 16::bigint,
  'y el consumo de la jornada sigue cuadrando');

-- ============================================================================
-- 6. Traspaso al iniciar
-- ============================================================================
UPDATE jornadas SET estado = 'finalizada' WHERE id = 'f7000000-0000-0000-0000-000000000001';
UPDATE jornadas SET estado = 'en curso' WHERE id = 'f7000000-0000-0000-0000-000000000003';

SELECT is(
  (SELECT cargado FROM fn_consumo_de_insumos_de_jornada('f7000000-0000-0000-0000-000000000003')
   WHERE lote_id = 'f4000000-0000-0000-0000-000000000186'),
  16::bigint,
  'al iniciar, el sobrante de la jornada anterior pasa a la nueva como cargado'
);

SELECT is((SELECT queda FROM consumo_j1), 0::bigint,
  'y en la anterior cuenta como devuelto: ya no le queda nada');

SELECT is(
  (SELECT cantidad_disponible FROM existencias
   WHERE lote_id = 'f4000000-0000-0000-0000-000000000186'
     AND bodega_id = 'f1000000-0000-0000-0000-000000000001'),
  16,
  'el traspaso no cambia el inventario fisico'
);

-- ============================================================================
-- 7. Cargar una bodega que otra jornada tiene en curso
-- ============================================================================
SELECT throws_ok(
  $$ SELECT fn_cargar_insumo_a_bodega_de_jornada('f7000000-0000-0000-0000-000000000004',
       'f4000000-0000-0000-0000-000000000186', (SELECT id FROM principal_186), 1) $$,
  '55000', NULL,
  'no se carga una bodega que otra jornada tiene en curso'
);

-- ============================================================================
-- 8. Insumos del proyecto sin contar dos veces
-- ============================================================================
SELECT results_eq(
  $$ SELECT
       (SELECT COALESCE(SUM(queda), 0) FROM fn_insumos_de_proyecto('f5000000-0000-0000-0000-000000000001')),
       (SELECT COALESCE(SUM(queda), 0) FROM fn_insumos_de_proyecto('f5000000-0000-0000-0000-000000000002')) $$,
  $$ VALUES (16::numeric, 4::numeric) $$,
  'cada unidad cuenta en el proyecto de la jornada a la que le queda, aunque la bodega se comparta'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.fn_insumos_de_proyecto(uuid)', 'EXECUTE'),
  'anon no ejecuta fn_insumos_de_proyecto'
);

-- ============================================================================
-- 9. Una jornada que ya estaba en curso con un ingreso directo (anterior a la 00186)
-- ============================================================================
-- J2 tiene 4 cargadas; entra un ingreso directo de 6 a su bodega, sin jornada. Tras el traspaso
-- que la 00186 hace con las jornadas en curso, lo que le queda es lo que hay en la bodega.
UPDATE jornadas SET estado = 'en curso' WHERE id = 'f7000000-0000-0000-0000-000000000002';
INSERT INTO movimientos_inventario (tipo, lote_id, bodega_id, cantidad, motivo, registrado_por)
VALUES ('ingreso', 'f4000000-0000-0000-0000-000000000186', 'f1000000-0000-0000-0000-000000000002',
        6, 'Ingreso directo de prueba 186', 'f0000000-0000-0000-0000-000000000186');
SELECT fn_traspasar_sobrante_a_jornada('f7000000-0000-0000-0000-000000000002');

SELECT results_eq(
  $$ SELECT c.queda, c.en_bodega
     FROM fn_consumo_de_insumos_de_jornada('f7000000-0000-0000-0000-000000000002') c
     WHERE c.lote_id = 'f4000000-0000-0000-0000-000000000186' $$,
  $$ VALUES (10::bigint, 10::bigint) $$,
  'el traspaso deja a una jornada en curso cuadrando con lo que hay en su bodega'
);

-- ============================================================================
-- 10. Rechazar en Validacion la entrega de una receta la anula
-- ============================================================================
-- J3 esta en curso con el botiquin uno (seccion 6). El medico receta 2 y su salida queda pendiente.
INSERT INTO atenciones (id, paciente_id, jornada_id) VALUES
  ('fa000000-0000-0000-0000-000000000003', 'f8000000-0000-0000-0000-000000000186',
   'f7000000-0000-0000-0000-000000000003');
INSERT INTO consultas (id, expediente_id, atencion_id, medico_id, jornada_id, motivo_consulta) VALUES
  ('fb000000-0000-0000-0000-000000000003', 'f9000000-0000-0000-0000-000000000186',
   'fa000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000187',
   'f7000000-0000-0000-0000-000000000003', 'motivo de prueba 186 J3');

SELECT set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000187', TRUE);
CREATE TEMP TABLE receta_rechazada AS
SELECT fn_generar_receta(
  'fb000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000187', NULL,
  '[{"medicamento_id": "f2000000-0000-0000-0000-000000000186",
     "lote_id": "f4000000-0000-0000-0000-000000000186",
     "bodega_id": "f1000000-0000-0000-0000-000000000001",
     "dosis": "1", "frecuencia": "cada 8h", "duracion": "3 dias",
     "cantidad_entregada": 2}]'::jsonb
) AS id;

-- Un ajuste pendiente rechazado no anula la receta: corrige el ajuste.
SELECT fn_ajustar_entrega_receta(
  (SELECT id FROM receta_detalle WHERE receta_id = (SELECT id FROM receta_rechazada)), 3);

SELECT set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000186', TRUE);
UPDATE movimientos_inventario
SET estado = 'rechazado', motivo_rechazo = 'el ajuste no corresponde',
    aprobado_por = 'f0000000-0000-0000-0000-000000000186', aprobado_en = NOW()
WHERE receta_id = (SELECT id FROM receta_rechazada) AND motivo LIKE 'Ajuste de entrega%';

SELECT is(
  (SELECT estado::TEXT FROM recetas WHERE id = (SELECT id FROM receta_rechazada)),
  'emitida',
  'rechazar el ajuste de una receta no la anula'
);

UPDATE movimientos_inventario
SET estado = 'rechazado', motivo_rechazo = 'no se entrego',
    aprobado_por = 'f0000000-0000-0000-0000-000000000186', aprobado_en = NOW()
WHERE receta_id = (SELECT id FROM receta_rechazada) AND motivo LIKE 'Entrega por receta%';

SELECT results_eq(
  $$ SELECT estado::TEXT, anulada_por, motivo_anulacion FROM recetas
     WHERE id = (SELECT id FROM receta_rechazada) $$,
  $$ VALUES ('anulada', 'f0000000-0000-0000-0000-000000000186'::uuid,
             'Anulada por la administracion al rechazar su salida de inventario: no se entrego') $$,
  'rechazar la entrega de una receta la anula, a nombre de quien rechazo y con su motivo'
);

SELECT is(
  (SELECT entregado FROM fn_consumo_de_insumos_de_jornada('f7000000-0000-0000-0000-000000000003')
   WHERE lote_id = 'f4000000-0000-0000-0000-000000000186'),
  0::bigint,
  'la receta anulada deja de contar como entregada en la jornada'
);

-- ============================================================================
-- 11. La entrega de una receta se valida completa
-- ============================================================================
-- Un segundo lote en el botiquin uno, para una receta con dos salidas.
INSERT INTO lotes (id, medicamento_id, proveedor_id, numero_lote, origen, cantidad_ingresada, fecha_ingreso, fecha_vencimiento, costo_unitario) VALUES
  ('f4000000-0000-0000-0000-000000000187', 'f2000000-0000-0000-0000-000000000186',
   'f3000000-0000-0000-0000-000000000186', 'L-187', 'compra', 10, CURRENT_DATE - 30,
   CURRENT_DATE + 300, 1.00);
INSERT INTO existencias (lote_id, bodega_id, cantidad_disponible) VALUES
  ('f4000000-0000-0000-0000-000000000187', 'f1000000-0000-0000-0000-000000000001', 10);

INSERT INTO atenciones (id, paciente_id, jornada_id) VALUES
  ('fa000000-0000-0000-0000-000000000004', 'f8000000-0000-0000-0000-000000000187',
   'f7000000-0000-0000-0000-000000000003');
INSERT INTO consultas (id, expediente_id, atencion_id, medico_id, jornada_id, motivo_consulta) VALUES
  ('fb000000-0000-0000-0000-000000000004', 'f9000000-0000-0000-0000-000000000187',
   'fa000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000187',
   'f7000000-0000-0000-0000-000000000003', 'motivo de prueba 187 J3');

SELECT set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000187', TRUE);
CREATE TEMP TABLE receta_conjunto AS
SELECT fn_generar_receta(
  'fb000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000187', NULL,
  '[{"medicamento_id": "f2000000-0000-0000-0000-000000000186",
     "lote_id": "f4000000-0000-0000-0000-000000000186",
     "bodega_id": "f1000000-0000-0000-0000-000000000001",
     "dosis": "1", "frecuencia": "cada 8h", "duracion": "3 dias", "cantidad_entregada": 1},
    {"medicamento_id": "f2000000-0000-0000-0000-000000000186",
     "lote_id": "f4000000-0000-0000-0000-000000000187",
     "bodega_id": "f1000000-0000-0000-0000-000000000001",
     "dosis": "1", "frecuencia": "cada 8h", "duracion": "3 dias", "cantidad_entregada": 1}]'::jsonb
) AS id;

SELECT results_eq(
  $$ SELECT
       (SELECT count(*) FROM notificaciones
        WHERE perfil_id = 'f0000000-0000-0000-0000-000000000186'
          AND origen_tabla = 'recetas' AND origen_id = (SELECT id FROM receta_conjunto)),
       (SELECT count(*) FROM notificaciones n
        JOIN movimientos_inventario m ON m.id = n.origen_id
        WHERE n.origen_tabla = 'movimientos_inventario'
          AND m.receta_id = (SELECT id FROM receta_conjunto)) $$,
  $$ VALUES (1::bigint, 0::bigint) $$,
  'la entrega de una receta avisa una sola vez, por receta, y no por medicamento'
);

SELECT set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000186', TRUE);
UPDATE movimientos_inventario
SET estado = 'aprobado', aprobado_por = 'f0000000-0000-0000-0000-000000000186', aprobado_en = NOW()
WHERE id = (
  SELECT id FROM movimientos_inventario
  WHERE receta_id = (SELECT id FROM receta_conjunto) AND lote_id = 'f4000000-0000-0000-0000-000000000186'
);

SELECT is(
  (SELECT count(*) FROM movimientos_inventario
   WHERE receta_id = (SELECT id FROM receta_conjunto) AND estado = 'aprobado'),
  2::bigint,
  'aprobar una salida de la entrega aprueba la receta completa'
);

SELECT is(
  (SELECT cantidad_disponible FROM existencias
   WHERE lote_id = 'f4000000-0000-0000-0000-000000000187'
     AND bodega_id = 'f1000000-0000-0000-0000-000000000001'),
  9,
  'y descuenta tambien la existencia del otro lote'
);

-- ============================================================================
-- 12. Los indicadores de la jornada no cuentan recetas anuladas
-- ============================================================================
-- Las dos recetas de J1 se anularon (seccion 5).
SELECT results_eq(
  $$ SELECT tratamientos_entregados, medicamentos_utilizados FROM vista_reporte_impacto
     WHERE jornada_id = 'f7000000-0000-0000-0000-000000000001' $$,
  $$ VALUES (0::bigint, 0::bigint) $$,
  'el Resumen de la jornada no cuenta las recetas anuladas'
);

SELECT * FROM finish();
ROLLBACK;
