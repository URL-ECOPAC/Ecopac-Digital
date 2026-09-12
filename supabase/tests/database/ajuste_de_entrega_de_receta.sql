-- Pruebas de fn_ajustar_entrega_receta (issue #764, migracion 00125).
-- Corre con: supabase test db
--
-- El riesgo que estas pruebas cubren es el doble descuento: fn_generar_receta (00112) ya
-- descuenta el inventario de forma atomica con la cantidad recetada, asi que corregir esa
-- cantidad despues NO puede volver a aplicar el total, solo la diferencia contra el ultimo valor
-- confirmado (cantidad_ajustada si ya existe, si no cantidad_entregada). Por eso el flujo de
-- prueba encadena tres ajustes sobre el MISMO renglon (10 -> 12 -> 7 -> 7) y comprueba en cada
-- paso que el movimiento nuevo es solo por la diferencia, nunca por el total.
--
-- Ademas de la logica, se prueba la verificacion de rol A MANO (la funcion es SECURITY DEFINER
-- porque cantidad_ajustada no tiene policy de UPDATE para nadie, asi que no hay RLS que la
-- proteja): un rol sin permiso tiene que rechazarse igual que si la tabla si tuviera policy.
--
-- Ningun dato real: la comunidad, el paciente, los medicamentos y los lotes son inventados.

BEGIN;

SELECT plan(19);

-- ============================================================================
-- Setup
-- ============================================================================
INSERT INTO comunidades (id, municipio_id, nombre) VALUES
  ('10000000-0000-0000-0000-000000000764', 101, 'Comunidad de prueba 764');

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000000764', 'medico764@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000000765', 'admin764@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000000766', 'voluntario764@test.ecopac.local');

ALTER TABLE perfiles DISABLE TRIGGER trg_perfiles_impedir_cambio_de_rol_propio;
UPDATE perfiles SET rol = 'medico' WHERE id = '00000000-0000-0000-0000-000000000764';
UPDATE perfiles SET rol = 'administrador' WHERE id = '00000000-0000-0000-0000-000000000765';
UPDATE perfiles SET rol = 'voluntario general' WHERE id = '00000000-0000-0000-0000-000000000766';
ALTER TABLE perfiles ENABLE TRIGGER trg_perfiles_impedir_cambio_de_rol_propio;

INSERT INTO pacientes (id, nombres, apellidos, fecha_nacimiento, sexo, comunidad_id, telefono_contacto, idioma)
VALUES (
  '20000000-0000-0000-0000-000000000764',
  'Paciente', 'Prueba764', '1990-01-01', 'F',
  '10000000-0000-0000-0000-000000000764', '5555-0764', 'espanol'
);

INSERT INTO expedientes (id, paciente_id, numero_ficha)
VALUES (
  '40000000-0000-0000-0000-000000000764',
  '20000000-0000-0000-0000-000000000764',
  'F-0764'
);

INSERT INTO jornadas (id, nombre, fecha, comunidad_id, responsable_id) VALUES
  ('30000000-0000-0000-0000-000000000764', 'Jornada 764',
   (NOW() AT TIME ZONE 'America/Guatemala')::date,
   '10000000-0000-0000-0000-000000000764', '00000000-0000-0000-0000-000000000765');

UPDATE jornadas SET estado = 'en curso'
WHERE id = '30000000-0000-0000-0000-000000000764';

INSERT INTO atenciones (id, paciente_id, jornada_id) VALUES
  ('50000000-0000-0000-0000-000000000764',
   '20000000-0000-0000-0000-000000000764',
   '30000000-0000-0000-0000-000000000764');

INSERT INTO consultas (id, expediente_id, atencion_id, medico_id, jornada_id, motivo_consulta)
VALUES (
  '60000000-0000-0000-0000-000000000764',
  '40000000-0000-0000-0000-000000000764',
  '50000000-0000-0000-0000-000000000764',
  '00000000-0000-0000-0000-000000000764',
  '30000000-0000-0000-0000-000000000764',
  'motivo de prueba 764'
),
(
  '60000000-0000-0000-0000-000000000765',
  '40000000-0000-0000-0000-000000000764',
  '50000000-0000-0000-0000-000000000764',
  '00000000-0000-0000-0000-000000000764',
  '30000000-0000-0000-0000-000000000764',
  'motivo de prueba 765 (renglon sin lote)'
);

INSERT INTO bodegas (id, nombre) VALUES
  ('70000000-0000-0000-0000-000000000764', 'Bodega de prueba 764');

INSERT INTO proveedores (id, nombre, tipo) VALUES
  ('80000000-0000-0000-0000-000000000764', 'Proveedor de prueba 764', 'comercial');

INSERT INTO medicamentos (id, nombre, concentracion, presentacion, marca) VALUES
  ('90000000-0000-0000-0000-000000000764', 'Medicamento A 764', '500mg', 'tableta', 'Generico');

-- Lote con existencia de sobra: alcanza para el ajuste hacia arriba de la prueba 3.
INSERT INTO lotes (id, medicamento_id, numero_lote, fecha_vencimiento, proveedor_id, origen, cantidad_ingresada)
VALUES
  ('a0000000-0000-0000-0000-000000000764', '90000000-0000-0000-0000-000000000764',
   'LOTE-A-764', CURRENT_DATE + 365, '80000000-0000-0000-0000-000000000764', 'compra', 100);

INSERT INTO existencias (lote_id, bodega_id, cantidad_disponible) VALUES
  ('a0000000-0000-0000-0000-000000000764', '70000000-0000-0000-0000-000000000764', 50);

-- Quien genera la receta y quien luego ajusta: medico (movimiento nace pendiente, 00028).
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000764';

-- ============================================================================
-- 1. Generar la receta original: 10 unidades del lote con existencia de sobra
-- ============================================================================
SELECT lives_ok(
  $$ SELECT fn_generar_receta(
       '60000000-0000-0000-0000-000000000764',
       '00000000-0000-0000-0000-000000000764',
       'indicaciones de prueba 764',
       '[{"medicamento_id": "90000000-0000-0000-0000-000000000764",
          "lote_id": "a0000000-0000-0000-0000-000000000764",
          "bodega_id": "70000000-0000-0000-0000-000000000764",
          "dosis": "1 tableta", "frecuencia": "cada 8h", "duracion": "5 dias",
          "cantidad_entregada": 10}]'::jsonb
     ) $$,
  'la receta original se emite con su movimiento de salida (10 unidades)'
);

-- ============================================================================
-- 2. Ajustar hacia ARRIBA (10 -> 12): un movimiento de salida nuevo, solo por 2
-- ============================================================================
SELECT lives_ok(
  $$ SELECT fn_ajustar_entrega_receta(
       (SELECT id FROM receta_detalle
        WHERE receta_id = (SELECT id FROM recetas WHERE consulta_id = '60000000-0000-0000-0000-000000000764')),
       12
     ) $$,
  'ajustar hacia arriba (10 -> 12) no revienta'
);

SELECT is(
  (SELECT cantidad_ajustada FROM receta_detalle
   WHERE receta_id = (SELECT id FROM recetas WHERE consulta_id = '60000000-0000-0000-0000-000000000764')),
  12,
  'cantidad_ajustada queda en 12'
);

SELECT is(
  (SELECT ajustada_por FROM receta_detalle
   WHERE receta_id = (SELECT id FROM recetas WHERE consulta_id = '60000000-0000-0000-0000-000000000764')),
  '00000000-0000-0000-0000-000000000764'::uuid,
  'ajustada_por queda en quien ajusto'
);

SELECT is(
  (SELECT COUNT(*)::int FROM movimientos_inventario
   WHERE lote_id = 'a0000000-0000-0000-0000-000000000764' AND tipo = 'salida'),
  2,
  'hay dos salidas: la original (10) y el ajuste (2), no una salida reescrita por 12'
);

-- created_at es NOW(), igual para las dos filas dentro de la misma transaccion: no sirve para
-- distinguir cual es la mas reciente. MIN(cantidad) si es determinista, porque las dos
-- cantidades (10 original, 2 del ajuste) son distintas.
SELECT is(
  (SELECT MIN(cantidad) FROM movimientos_inventario
   WHERE lote_id = 'a0000000-0000-0000-0000-000000000764' AND tipo = 'salida'),
  2,
  'el movimiento del ajuste es solo por la diferencia (2), no por las 12 completas'
);

-- ============================================================================
-- 3. Ajustar hacia ABAJO (12 -> 7): un ingreso nuevo por la diferencia (5)
-- ============================================================================
SELECT lives_ok(
  $$ SELECT fn_ajustar_entrega_receta(
       (SELECT id FROM receta_detalle
        WHERE receta_id = (SELECT id FROM recetas WHERE consulta_id = '60000000-0000-0000-0000-000000000764')),
       7
     ) $$,
  'ajustar hacia abajo (12 -> 7) no revienta'
);

SELECT is(
  (SELECT cantidad_ajustada FROM receta_detalle
   WHERE receta_id = (SELECT id FROM recetas WHERE consulta_id = '60000000-0000-0000-0000-000000000764')),
  7,
  'cantidad_ajustada queda en 7'
);

SELECT is(
  (SELECT COUNT(*)::int FROM movimientos_inventario
   WHERE lote_id = 'a0000000-0000-0000-0000-000000000764' AND tipo = 'ingreso'),
  1,
  'entregar menos de lo confirmado devuelve la diferencia como un ingreso, no borra la salida'
);

SELECT is(
  (SELECT cantidad FROM movimientos_inventario
   WHERE lote_id = 'a0000000-0000-0000-0000-000000000764' AND tipo = 'ingreso'),
  5,
  'el ingreso de devolucion es exactamente la diferencia (12 - 7 = 5)'
);

-- ============================================================================
-- 4. Ajustar con la MISMA cantidad ya confirmada (7 -> 7): sin movimiento nuevo
-- ============================================================================
SELECT lives_ok(
  $$ SELECT fn_ajustar_entrega_receta(
       (SELECT id FROM receta_detalle
        WHERE receta_id = (SELECT id FROM recetas WHERE consulta_id = '60000000-0000-0000-0000-000000000764')),
       7
     ) $$,
  'confirmar la misma cantidad (7 -> 7) no revienta'
);

SELECT is(
  (SELECT COUNT(*)::int FROM movimientos_inventario WHERE lote_id = 'a0000000-0000-0000-0000-000000000764'),
  3,
  'sin diferencia no se crea un cuarto movimiento (siguen los 2 de salida + 1 de ingreso)'
);

-- ============================================================================
-- 5. Solo medico o administracion puede ajustar
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000766';

SELECT throws_ok(
  $$ SELECT fn_ajustar_entrega_receta(
       (SELECT id FROM receta_detalle
        WHERE receta_id = (SELECT id FROM recetas WHERE consulta_id = '60000000-0000-0000-0000-000000000764')),
       8
     ) $$,
  'Solo medico o administracion puede ajustar la entrega de una receta.',
  'voluntario general no puede ajustar una entrega'
);

SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000765';

SELECT lives_ok(
  $$ SELECT fn_ajustar_entrega_receta(
       (SELECT id FROM receta_detalle
        WHERE receta_id = (SELECT id FROM recetas WHERE consulta_id = '60000000-0000-0000-0000-000000000764')),
       8
     ) $$,
  'administracion si puede ajustar una entrega'
);

-- ============================================================================
-- 6. Validaciones basicas
-- ============================================================================
SELECT throws_ok(
  $$ SELECT fn_ajustar_entrega_receta(
       (SELECT id FROM receta_detalle
        WHERE receta_id = (SELECT id FROM recetas WHERE consulta_id = '60000000-0000-0000-0000-000000000764')),
       0
     ) $$,
  'La cantidad realmente entregada debe ser mayor que cero.',
  'cantidad_real en cero se rechaza'
);

SELECT throws_ok(
  $$ SELECT fn_ajustar_entrega_receta('00000000-0000-0000-0000-000000009999', 5) $$,
  'El renglon de receta indicado no existe.',
  'un receta_detalle_id que no existe se rechaza'
);

-- ============================================================================
-- 7. Un renglon sin lote/bodega no genera movimiento, y ajustarlo hacia otra
--    cantidad se rechaza (no hay inventario que corregir)
-- ============================================================================
SELECT lives_ok(
  $$ SELECT fn_generar_receta(
       '60000000-0000-0000-0000-000000000765',
       '00000000-0000-0000-0000-000000000764',
       NULL,
       '[{"medicamento_id": "90000000-0000-0000-0000-000000000764",
          "dosis": "1 tableta", "frecuencia": "cada 12h", "duracion": "5 dias",
          "cantidad_entregada": 5}]'::jsonb
     ) $$,
  'una receta sin lote especifico se emite sin generar movimiento (00019)'
);

SELECT throws_ok(
  $$ SELECT fn_ajustar_entrega_receta(
       (SELECT id FROM receta_detalle
        WHERE receta_id = (SELECT id FROM recetas WHERE consulta_id = '60000000-0000-0000-0000-000000000765')),
       8
     ) $$,
  'Este renglon no tiene lote y bodega asociados: no genero movimiento de inventario que ajustar.',
  'un renglon sin lote/bodega no se puede ajustar por inventario'
);

-- ============================================================================
-- 8. Una receta anulada no se puede ajustar
-- ============================================================================
UPDATE recetas
SET estado = 'anulada', motivo_anulacion = 'anulada para la prueba 764',
    anulada_por = '00000000-0000-0000-0000-000000000765', anulada_en = NOW()
WHERE consulta_id = '60000000-0000-0000-0000-000000000765';

SELECT throws_ok(
  $$ SELECT fn_ajustar_entrega_receta(
       (SELECT id FROM receta_detalle
        WHERE receta_id = (SELECT id FROM recetas WHERE consulta_id = '60000000-0000-0000-0000-000000000765')),
       5
     ) $$,
  'No se puede ajustar la entrega de una receta anulada.',
  'una receta anulada no se puede ajustar'
);

SELECT * FROM finish();
ROLLBACK;
