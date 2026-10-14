-- Pruebas de la 00176: lo que se receta en una jornada sale de su bodega de botiquin o, si no
-- tiene, de la bodega principal. Corre con: supabase test db
--
-- Mismo setup que receta_y_salida_atomicas.sql: corre como el rol dueno (sin RLS) y fija el sub
-- de la sesion porque fn_generar_receta pone registrado_por = auth.uid() en el movimiento.
--
-- Ningun dato real: la comunidad, el paciente, los medicamentos y los lotes son inventados.

BEGIN;

SELECT plan(8);

-- Desde la 00178 toda jornada nueva lleva una bodega movil. Estas pruebas no tratan de bodegas:
-- sus jornadas reciben una de prueba como DEFAULT de la columna, que el ROLLBACK del final deshace.
INSERT INTO bodegas (id, nombre, es_movil) VALUES
  ('5b000000-0000-0000-0000-000000000178', 'Bodega movil de prueba 00178', TRUE);
ALTER TABLE jornadas ALTER COLUMN botiquin_bodega_id SET DEFAULT '5b000000-0000-0000-0000-000000000178';

INSERT INTO proyectos (id, nombre) VALUES
  ('5f000000-0000-0000-0000-000000001761', 'Proyecto de prueba 1761');

INSERT INTO comunidades (id, municipio_id, nombre) VALUES
  ('10000000-0000-0000-0000-000000001761', 101, 'Comunidad de prueba 1761');

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000001761', 'medico1761@test.ecopac.local');

INSERT INTO pacientes (id, nombres, apellidos, fecha_nacimiento, sexo, comunidad_id, telefono_contacto, idioma)
VALUES (
  '20000000-0000-0000-0000-000000001761',
  'Paciente', 'Prueba1761', '1990-01-01', 'Femenino',
  '10000000-0000-0000-0000-000000001761', '5555-1761', 'espanol'
);

INSERT INTO expedientes (id, paciente_id, numero_ficha)
VALUES ('40000000-0000-0000-0000-000000001761', '20000000-0000-0000-0000-000000001761', 'F-1761');

-- Dos bodegas de prueba: la del botiquin de la jornada 1761 y otra cualquiera.
INSERT INTO bodegas (id, nombre, es_movil) VALUES
  ('70000000-0000-0000-0000-000000001761', 'Botiquin de prueba 1761', TRUE),
  ('70000000-0000-0000-0000-000000001762', 'Otra bodega 1762', FALSE);

-- 1761 con botiquin, 1762 sin botiquin. Desde la 00178 una jornada nueva no puede nacer sin
-- bodega: 1762 nace con la de prueba y despues se le quita con el trigger apagado, que es como
-- quedan las jornadas anteriores a la 00178.
INSERT INTO jornadas (id, nombre, fecha, comunidad_id, responsable_id, proyecto_id, botiquin_bodega_id) VALUES
  ('30000000-0000-0000-0000-000000001761', 'Jornada con botiquin 1761',
   (NOW() AT TIME ZONE 'America/Guatemala')::date,
   '10000000-0000-0000-0000-000000001761', '00000000-0000-0000-0000-000000001761',
   '5f000000-0000-0000-0000-000000001761', '70000000-0000-0000-0000-000000001761'),
  ('30000000-0000-0000-0000-000000001762', 'Jornada sin botiquin 1762',
   (NOW() AT TIME ZONE 'America/Guatemala')::date,
   '10000000-0000-0000-0000-000000001761', '00000000-0000-0000-0000-000000001761',
   '5f000000-0000-0000-0000-000000001761', '5b000000-0000-0000-0000-000000000178');

ALTER TABLE jornadas DISABLE TRIGGER trg_jornadas_requiere_bodega_movil_al_cambiar;
UPDATE jornadas SET botiquin_bodega_id = NULL WHERE id = '30000000-0000-0000-0000-000000001762';
ALTER TABLE jornadas ENABLE TRIGGER trg_jornadas_requiere_bodega_movil_al_cambiar;

UPDATE jornadas SET estado = 'en curso'
WHERE id IN ('30000000-0000-0000-0000-000000001761', '30000000-0000-0000-0000-000000001762');

INSERT INTO atenciones (id, paciente_id, jornada_id) VALUES
  ('50000000-0000-0000-0000-000000001761', '20000000-0000-0000-0000-000000001761',
   '30000000-0000-0000-0000-000000001761'),
  ('50000000-0000-0000-0000-000000001762', '20000000-0000-0000-0000-000000001761',
   '30000000-0000-0000-0000-000000001762');

INSERT INTO consultas (id, expediente_id, atencion_id, medico_id, jornada_id, motivo_consulta) VALUES
  ('60000000-0000-0000-0000-000000001761', '40000000-0000-0000-0000-000000001761',
   '50000000-0000-0000-0000-000000001761', '00000000-0000-0000-0000-000000001761',
   '30000000-0000-0000-0000-000000001761', 'motivo de prueba 1761'),
  ('60000000-0000-0000-0000-000000001762', '40000000-0000-0000-0000-000000001761',
   '50000000-0000-0000-0000-000000001762', '00000000-0000-0000-0000-000000001761',
   '30000000-0000-0000-0000-000000001762', 'motivo de prueba 1762');

INSERT INTO proveedores (id, nombre, tipo) VALUES
  ('80000000-0000-0000-0000-000000001761', 'Proveedor de prueba 1761', 'comercial');

INSERT INTO medicamentos (id, nombre, concentracion, presentacion_id, marca) VALUES
  ('90000000-0000-0000-0000-000000001761', 'Medicamento 1761', '500mg',
   (SELECT id FROM presentaciones WHERE nombre = 'Tableta'), 'Generico');

INSERT INTO lotes (id, medicamento_id, numero_lote, fecha_vencimiento, proveedor_id, origen, cantidad_ingresada)
VALUES
  ('a0000000-0000-0000-0000-000000001761', '90000000-0000-0000-0000-000000001761',
   'LOTE-1761', CURRENT_DATE + 365, '80000000-0000-0000-0000-000000001761', 'compra', 100);

INSERT INTO existencias (lote_id, bodega_id, cantidad_disponible) VALUES
  ('a0000000-0000-0000-0000-000000001761', '70000000-0000-0000-0000-000000001761', 20),
  ('a0000000-0000-0000-0000-000000001761', '70000000-0000-0000-0000-000000001762', 30);

SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000001761';

-- ============================================================================
-- La bodega principal
-- ============================================================================
SELECT is(
  (SELECT count(*)::int FROM bodegas WHERE es_principal),
  1,
  'hay exactamente una bodega principal'
);

SELECT throws_ok(
  $$ UPDATE bodegas SET es_principal = TRUE WHERE id = '70000000-0000-0000-0000-000000001762' $$,
  '23505', NULL,
  'no puede haber dos bodegas principales'
);

-- ============================================================================
-- De que bodega sale
-- ============================================================================
SELECT is(
  fn_bodega_de_entrega_de_consulta('60000000-0000-0000-0000-000000001761'),
  '70000000-0000-0000-0000-000000001761'::uuid,
  'con botiquin, sale de la bodega del botiquin'
);

SELECT is(
  fn_bodega_de_entrega_de_consulta('60000000-0000-0000-0000-000000001762'),
  (SELECT id FROM bodegas WHERE es_principal),
  'sin botiquin, sale de la bodega principal'
);

-- ============================================================================
-- fn_generar_receta
-- ============================================================================
SELECT throws_ok(
  $$ SELECT fn_generar_receta(
       '60000000-0000-0000-0000-000000001761',
       '00000000-0000-0000-0000-000000001761',
       NULL,
       '[{"medicamento_id": "90000000-0000-0000-0000-000000001761",
          "lote_id": "a0000000-0000-0000-0000-000000001761",
          "bodega_id": "70000000-0000-0000-0000-000000001762",
          "dosis": "1 tableta", "frecuencia": "cada 8h", "duracion": "5 dias",
          "cantidad_entregada": 5}]'::jsonb
     ) $$,
  '55000', NULL,
  'no se receta de una bodega que no es la del botiquin'
);

SELECT lives_ok(
  $$ SELECT fn_generar_receta(
       '60000000-0000-0000-0000-000000001761',
       '00000000-0000-0000-0000-000000001761',
       NULL,
       '[{"medicamento_id": "90000000-0000-0000-0000-000000001761",
          "lote_id": "a0000000-0000-0000-0000-000000001761",
          "bodega_id": "70000000-0000-0000-0000-000000001761",
          "dosis": "1 tableta", "frecuencia": "cada 8h", "duracion": "5 dias",
          "cantidad_entregada": 5}]'::jsonb
     ) $$,
  'se receta de la bodega del botiquin'
);

-- La existencia que se compara es la del lote en ESA bodega (20), no la suma de las dos (50).
-- Desde la 00186 se descuenta ademas lo comprometido: la receta de 5 de arriba quedo pendiente,
-- asi que lo disponible es 15 (issue #925).
SELECT throws_ok(
  $$ SELECT fn_generar_receta(
       '60000000-0000-0000-0000-000000001761',
       '00000000-0000-0000-0000-000000001761',
       NULL,
       '[{"medicamento_id": "90000000-0000-0000-0000-000000001761",
          "lote_id": "a0000000-0000-0000-0000-000000001761",
          "bodega_id": "70000000-0000-0000-0000-000000001761",
          "dosis": "1 tableta", "frecuencia": "cada 8h", "duracion": "5 dias",
          "cantidad_entregada": 40}]'::jsonb
     ) $$,
  'Existencia insuficiente en el lote a0000000-0000-0000-0000-000000001761. Disponible: 15, solicitado: 40.',
  'la existencia se cuenta en la bodega de entrega, no en todas'
);

SELECT is(
  has_function_privilege('authenticated', 'public.fn_bodega_de_entrega_de_consulta(uuid)', 'EXECUTE'),
  true,
  'el cliente puede preguntar de que bodega sale una consulta'
);

SELECT * FROM finish();
ROLLBACK;
