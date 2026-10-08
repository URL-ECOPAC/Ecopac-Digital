-- Pruebas de la 00181: la bodega principal tambien puede ser la bodega de una jornada (issue #927,
-- seccion 5). Corre con: supabase test db
--
-- Corre como el rol dueno (sin RLS) y fija el sub de la sesion: la carga, la devolucion y el
-- consumo preguntan es_administrador(), y fn_generar_receta pone registrado_por = auth.uid().
--
-- La bodega principal es la del seed (hay exactamente una, 00176). Ningun dato real: la comunidad,
-- el paciente, el medicamento y los lotes son inventados.

BEGIN;

SELECT plan(13);

-- ============================================================================
-- Setup
-- ============================================================================
INSERT INTO auth.users (id, email) VALUES
  ('e0000000-0000-0000-0000-000000000181', 'admin181@test.ecopac.local'),
  ('e0000000-0000-0000-0000-000000000182', 'medico181@test.ecopac.local');

ALTER TABLE perfiles DISABLE TRIGGER USER;
UPDATE perfiles SET rol = 'administrador' WHERE id = 'e0000000-0000-0000-0000-000000000181';
ALTER TABLE perfiles ENABLE TRIGGER USER;

INSERT INTO proyectos (id, nombre) VALUES
  ('e5000000-0000-0000-0000-000000000181', 'Proyecto de prueba 181');

INSERT INTO comunidades (id, municipio_id, nombre) VALUES
  ('e6000000-0000-0000-0000-000000000181', 101, 'Comunidad de prueba 181');

INSERT INTO bodegas (id, nombre, es_movil) VALUES
  ('e1000000-0000-0000-0000-000000000001', 'Bodega fija 181', FALSE),
  ('e1000000-0000-0000-0000-000000000002', 'Botiquin movil 181', TRUE),
  ('e1000000-0000-0000-0000-000000000003', 'Otro botiquin 181', TRUE);

CREATE TEMP VIEW principal_181 AS SELECT id FROM bodegas WHERE es_principal;

INSERT INTO medicamentos (id, nombre, concentracion, presentacion_id, marca) VALUES
  ('e2000000-0000-0000-0000-000000000181', 'Medicamento 181', '500 mg',
   (SELECT id FROM presentaciones WHERE nombre = 'Tableta'), 'Generico');

INSERT INTO proveedores (id, nombre, tipo) VALUES
  ('e3000000-0000-0000-0000-000000000181', 'Proveedor 181', 'comercial');

-- Dos lotes en la principal: uno se receta en la jornada y el otro no. El segundo no puede
-- aparecer en el consumo de la jornada: es existencia de la organizacion, no de la jornada.
INSERT INTO lotes (id, medicamento_id, proveedor_id, numero_lote, origen, cantidad_ingresada, fecha_ingreso, fecha_vencimiento, costo_unitario) VALUES
  ('e4000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000181', 'e3000000-0000-0000-0000-000000000181', 'L-181-A', 'compra', 100, CURRENT_DATE - 100, CURRENT_DATE + 365, 2.00),
  ('e4000000-0000-0000-0000-000000000002', 'e2000000-0000-0000-0000-000000000181', 'e3000000-0000-0000-0000-000000000181', 'L-181-B', 'compra', 100, CURRENT_DATE - 100, CURRENT_DATE + 365, 3.00);

INSERT INTO existencias (lote_id, bodega_id, cantidad_disponible) VALUES
  ('e4000000-0000-0000-0000-000000000001', (SELECT id FROM principal_181), 60),
  ('e4000000-0000-0000-0000-000000000002', (SELECT id FROM principal_181), 40);

-- ============================================================================
-- 1. La principal se acepta; otra fija no
-- ============================================================================
SELECT lives_ok(
  $$ INSERT INTO jornadas (id, nombre, fecha, comunidad_id, responsable_id, proyecto_id, botiquin_bodega_id)
     VALUES ('e7000000-0000-0000-0000-000000000001', 'Jornada principal 181 A',
             (NOW() AT TIME ZONE 'America/Guatemala')::date,
             'e6000000-0000-0000-0000-000000000181', 'e0000000-0000-0000-0000-000000000181',
             'e5000000-0000-0000-0000-000000000181', (SELECT id FROM principal_181)) $$,
  'una jornada nace con la bodega principal'
);

SELECT throws_ok(
  $$ INSERT INTO jornadas (nombre, fecha, comunidad_id, responsable_id, proyecto_id, botiquin_bodega_id)
     VALUES ('Fija 181', CURRENT_DATE + 5, 'e6000000-0000-0000-0000-000000000181',
             'e0000000-0000-0000-0000-000000000181', 'e5000000-0000-0000-0000-000000000181',
             'e1000000-0000-0000-0000-000000000001') $$,
  '23514', NULL,
  'una bodega fija que no es la principal se sigue rechazando'
);

SELECT throws_ok(
  $$ INSERT INTO jornadas (nombre, fecha, comunidad_id, responsable_id, proyecto_id)
     VALUES ('Sin bodega 181', CURRENT_DATE + 5, 'e6000000-0000-0000-0000-000000000181',
             'e0000000-0000-0000-0000-000000000181', 'e5000000-0000-0000-0000-000000000181') $$,
  '23502', NULL,
  'la bodega sigue siendo obligatoria'
);

-- ============================================================================
-- 2. Varias jornadas en curso con la principal
-- ============================================================================
INSERT INTO jornadas (id, nombre, fecha, comunidad_id, responsable_id, proyecto_id, botiquin_bodega_id)
VALUES ('e7000000-0000-0000-0000-000000000002', 'Jornada principal 181 B',
        (NOW() AT TIME ZONE 'America/Guatemala')::date,
        'e6000000-0000-0000-0000-000000000181', 'e0000000-0000-0000-0000-000000000181',
        'e5000000-0000-0000-0000-000000000181', (SELECT id FROM principal_181));

SELECT lives_ok(
  $$ UPDATE jornadas SET estado = 'en curso'
     WHERE id IN ('e7000000-0000-0000-0000-000000000001', 'e7000000-0000-0000-0000-000000000002') $$,
  'dos jornadas en curso pueden usar la bodega principal a la vez'
);

-- ============================================================================
-- 3. Con la principal no se carga ni se devuelve
-- ============================================================================
SELECT set_config('request.jwt.claim.sub', 'e0000000-0000-0000-0000-000000000181', TRUE);

SELECT throws_ok(
  $$ SELECT fn_cargar_insumo_a_bodega_de_jornada('e7000000-0000-0000-0000-000000000001',
       'e4000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 1) $$,
  '55000',
  'La jornada usa la bodega principal: entrega directo de ella y no hay nada que cargar.',
  'a una jornada con la principal no se le carga nada'
);

SELECT throws_ok(
  $$ SELECT fn_devolver_de_bodega_de_jornada('e7000000-0000-0000-0000-000000000001',
       'e4000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 1) $$,
  '55000',
  'La jornada usa la bodega principal: no hay nada que devolver.',
  'de una jornada con la principal no se devuelve nada'
);

-- ============================================================================
-- 4. El consumo con la principal: solo lo entregado
-- ============================================================================
INSERT INTO pacientes (id, nombres, apellidos, fecha_nacimiento, sexo, comunidad_id, telefono_contacto, idioma)
VALUES ('e8000000-0000-0000-0000-000000000181', 'Paciente', 'Prueba181', '1990-01-01', 'Femenino',
        'e6000000-0000-0000-0000-000000000181', '5555-0181', 'espanol');

INSERT INTO expedientes (id, paciente_id, numero_ficha)
VALUES ('e9000000-0000-0000-0000-000000000181', 'e8000000-0000-0000-0000-000000000181', 'F-181');

INSERT INTO atenciones (id, paciente_id, jornada_id) VALUES
  ('ea000000-0000-0000-0000-000000000181', 'e8000000-0000-0000-0000-000000000181',
   'e7000000-0000-0000-0000-000000000001');

INSERT INTO consultas (id, expediente_id, atencion_id, medico_id, jornada_id, motivo_consulta) VALUES
  ('eb000000-0000-0000-0000-000000000181', 'e9000000-0000-0000-0000-000000000181',
   'ea000000-0000-0000-0000-000000000181', 'e0000000-0000-0000-0000-000000000182',
   'e7000000-0000-0000-0000-000000000001', 'motivo de prueba 181');

SELECT set_config('request.jwt.claim.sub', 'e0000000-0000-0000-0000-000000000182', TRUE);

SELECT lives_ok(
  format($$ SELECT fn_generar_receta(
       'eb000000-0000-0000-0000-000000000181',
       'e0000000-0000-0000-0000-000000000182',
       NULL,
       '[{"medicamento_id": "e2000000-0000-0000-0000-000000000181",
          "lote_id": "e4000000-0000-0000-0000-000000000001",
          "bodega_id": "%s",
          "dosis": "1 tableta", "frecuencia": "cada 8h", "duracion": "5 dias",
          "cantidad_entregada": 5}]'::jsonb
     ) $$, (SELECT id FROM principal_181)),
  'se receta desde la principal en una jornada que la usa'
);

SELECT set_config('request.jwt.claim.sub', 'e0000000-0000-0000-0000-000000000181', TRUE);

SELECT results_eq(
  $$ SELECT lote_id, cargado, entregado, devuelto, en_bodega
     FROM fn_consumo_de_insumos_de_jornada('e7000000-0000-0000-0000-000000000001') $$,
  $$ VALUES ('e4000000-0000-0000-0000-000000000001'::uuid, 0::bigint, 5::bigint, 0::bigint, 0::bigint) $$,
  'con la principal, el consumo es solo lo entregado: ni la existencia de la principal ni sus otros lotes'
);

SELECT is(
  (SELECT count(*)::int FROM fn_consumo_de_insumos_de_jornada('e7000000-0000-0000-0000-000000000002')),
  0,
  'otra jornada con la principal y sin recetas no tiene consumo'
);

-- ============================================================================
-- 5. No se cambia de bodega con inventario cargado
-- ============================================================================
INSERT INTO jornadas (id, nombre, fecha, comunidad_id, responsable_id, proyecto_id, botiquin_bodega_id)
VALUES ('e7000000-0000-0000-0000-000000000003', 'Jornada movil 181',
        (NOW() AT TIME ZONE 'America/Guatemala')::date,
        'e6000000-0000-0000-0000-000000000181', 'e0000000-0000-0000-0000-000000000181',
        'e5000000-0000-0000-0000-000000000181', 'e1000000-0000-0000-0000-000000000002');

SELECT lives_ok(
  $$ UPDATE jornadas SET botiquin_bodega_id = 'e1000000-0000-0000-0000-000000000003'
     WHERE id = 'e7000000-0000-0000-0000-000000000003' $$,
  'sin nada cargado, la bodega se cambia libremente'
);

SELECT lives_ok(
  $$ SELECT fn_cargar_insumo_a_bodega_de_jornada('e7000000-0000-0000-0000-000000000003',
       'e4000000-0000-0000-0000-000000000002', (SELECT id FROM principal_181), 10) $$,
  'se carga el botiquin desde la principal'
);

SELECT throws_ok(
  $$ UPDATE jornadas SET botiquin_bodega_id = (SELECT id FROM principal_181)
     WHERE id = 'e7000000-0000-0000-0000-000000000003' $$,
  '55000', NULL,
  'con inventario cargado en el botiquin no se cambia de bodega'
);

SELECT fn_devolver_de_bodega_de_jornada('e7000000-0000-0000-0000-000000000003',
  'e4000000-0000-0000-0000-000000000002', (SELECT id FROM principal_181), 10);

SELECT lives_ok(
  $$ UPDATE jornadas SET botiquin_bodega_id = (SELECT id FROM principal_181)
     WHERE id = 'e7000000-0000-0000-0000-000000000003' $$,
  'una vez devuelto, se cambia a la bodega principal'
);

SELECT * FROM finish();
ROLLBACK;
