-- Pruebas de los ajustes de la issue #964: saturacion de oxigeno y frecuencia respiratoria en
-- triajes (00190), y la salida de inventario a un paciente sin consulta (00191).
-- Corre con: supabase test db
--
-- El setup corre como el rol dueno de las tablas, exento de RLS: lo que se prueba son los CHECK,
-- el trigger de la entrega y la fusion de pacientes, que se comportan igual para todos.
--
-- Ningun dato real: la comunidad, los pacientes, los medicamentos y los lotes son inventados.

BEGIN;

SELECT plan(14);

-- Desde la 00169 toda jornada nueva lleva proyecto, y desde la 00178 una bodega movil. Estas
-- pruebas no tratan de eso: reciben uno de prueba como DEFAULT, que el ROLLBACK deshace.
INSERT INTO proyectos (id, nombre) VALUES
  ('5f000000-0000-0000-0000-000000000169', 'Proyecto de prueba 00169');
ALTER TABLE jornadas ALTER COLUMN proyecto_id SET DEFAULT '5f000000-0000-0000-0000-000000000169';

INSERT INTO bodegas (id, nombre, es_movil) VALUES
  ('5b000000-0000-0000-0000-000000000178', 'Bodega movil de prueba 00178', TRUE);
ALTER TABLE jornadas ALTER COLUMN botiquin_bodega_id SET DEFAULT '5b000000-0000-0000-0000-000000000178';

-- ============================================================================
-- Setup
-- ============================================================================
INSERT INTO comunidades (id, municipio_id, nombre) VALUES
  ('10000000-0000-0000-0000-000000000964', 101, 'Comunidad de prueba 964');

-- Un voluntario (el rol por defecto del trigger de perfiles) y una administradora.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000000964', 'voluntario964@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000000965', 'admin964@test.ecopac.local');

ALTER TABLE perfiles DISABLE TRIGGER USER;
UPDATE perfiles SET rol = 'administrador' WHERE id = '00000000-0000-0000-0000-000000000965';
ALTER TABLE perfiles ENABLE TRIGGER USER;

INSERT INTO pacientes (id, nombres, apellidos, fecha_nacimiento, sexo, comunidad_id, telefono_contacto, idioma) VALUES
  ('20000000-0000-0000-0000-000000000964', 'Uno', 'Inventado964', '1990-01-01', 'Femenino', '10000000-0000-0000-0000-000000000964', '5555-0964', 'espanol'),
  ('20000000-0000-0000-0000-000000000965', 'Dos', 'Inventado964', '1990-01-01', 'Masculino', '10000000-0000-0000-0000-000000000964', '5555-0965', 'espanol'),
  ('20000000-0000-0000-0000-000000000966', 'Tres', 'Inventado964', '1990-01-01', 'Femenino', '10000000-0000-0000-0000-000000000964', '5555-0966', 'espanol');

INSERT INTO expedientes (id, paciente_id, numero_ficha) VALUES
  ('40000000-0000-0000-0000-000000000964', '20000000-0000-0000-0000-000000000964', 'F-0964'),
  ('40000000-0000-0000-0000-000000000965', '20000000-0000-0000-0000-000000000965', 'F-0965'),
  ('40000000-0000-0000-0000-000000000966', '20000000-0000-0000-0000-000000000966', 'F-0966');

INSERT INTO jornadas (id, nombre, fecha, comunidad_id, responsable_id) VALUES
  ('30000000-0000-0000-0000-000000000964', 'Jornada 964',
   (NOW() AT TIME ZONE 'America/Guatemala')::date,
   '10000000-0000-0000-0000-000000000964', '00000000-0000-0000-0000-000000000964');

UPDATE jornadas SET estado = 'en curso' WHERE id = '30000000-0000-0000-0000-000000000964';

INSERT INTO atenciones (id, paciente_id, jornada_id) VALUES
  ('50000000-0000-0000-0000-000000000964', '20000000-0000-0000-0000-000000000964', '30000000-0000-0000-0000-000000000964'),
  ('50000000-0000-0000-0000-000000000965', '20000000-0000-0000-0000-000000000965', '30000000-0000-0000-0000-000000000964'),
  ('50000000-0000-0000-0000-000000000966', '20000000-0000-0000-0000-000000000966', '30000000-0000-0000-0000-000000000964');

INSERT INTO bodegas (id, nombre, es_movil) VALUES
  ('70000000-0000-0000-0000-000000000964', 'Bodega de prueba 964', FALSE);

INSERT INTO proveedores (id, nombre, tipo) VALUES
  ('80000000-0000-0000-0000-000000000964', 'Proveedor de prueba 964', 'comercial');

INSERT INTO medicamentos (id, nombre, concentracion, presentacion_id, marca) VALUES
  ('90000000-0000-0000-0000-000000000964', 'Medicamento 964', '500mg',
   (SELECT id FROM presentaciones WHERE nombre = 'Tableta'), 'Generico');

INSERT INTO lotes (id, medicamento_id, numero_lote, fecha_vencimiento, proveedor_id, origen, cantidad_ingresada)
VALUES ('a0000000-0000-0000-0000-000000000964', '90000000-0000-0000-0000-000000000964',
        'LOTE-964', CURRENT_DATE + 365, '80000000-0000-0000-0000-000000000964', 'compra', 100);

INSERT INTO existencias (lote_id, bodega_id, cantidad_disponible) VALUES
  ('a0000000-0000-0000-0000-000000000964', '70000000-0000-0000-0000-000000000964', 50);

-- registrado_por es NOT NULL y los triggers de movimientos miran auth.uid(): el voluntario, para
-- que lo que registre nazca pendiente.
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000964';

-- ============================================================================
-- 1. Saturacion de oxigeno y frecuencia respiratoria (00190)
-- ============================================================================
SELECT lives_ok(
  $$ INSERT INTO triajes (atencion_id, saturacion_oxigeno, tomado_por)
     VALUES ('50000000-0000-0000-0000-000000000964', 97, '00000000-0000-0000-0000-000000000964') $$,
  'un triaje con solo la saturacion es un triaje valido'
);

SELECT lives_ok(
  $$ INSERT INTO triajes (atencion_id, frecuencia_respiratoria, tomado_por)
     VALUES ('50000000-0000-0000-0000-000000000965', 18, '00000000-0000-0000-0000-000000000964') $$,
  'un triaje con solo la frecuencia respiratoria es un triaje valido'
);

SELECT throws_ok(
  $$ INSERT INTO triajes (atencion_id, saturacion_oxigeno, tomado_por)
     VALUES ('50000000-0000-0000-0000-000000000966', 101, '00000000-0000-0000-0000-000000000964') $$,
  '23514', NULL,
  'una saturacion de 101 % se rechaza'
);

SELECT throws_ok(
  $$ INSERT INTO triajes (atencion_id, frecuencia_respiratoria, tomado_por)
     VALUES ('50000000-0000-0000-0000-000000000966', 3, '00000000-0000-0000-0000-000000000964') $$,
  '23514', NULL,
  'una frecuencia respiratoria de 3 se rechaza'
);

SELECT throws_ok(
  $$ INSERT INTO triajes (atencion_id, tomado_por)
     VALUES ('50000000-0000-0000-0000-000000000966', '00000000-0000-0000-0000-000000000964') $$,
  '23514', NULL,
  'un triaje sin ningun signo se sigue rechazando'
);

-- ============================================================================
-- 2. La entrega o venta a paciente dice a quien (00191)
-- ============================================================================
SELECT throws_ok(
  $$ INSERT INTO movimientos_inventario (tipo, lote_id, bodega_id, cantidad, motivo, registrado_por)
     VALUES ('salida', 'a0000000-0000-0000-0000-000000000964', '70000000-0000-0000-0000-000000000964',
             2, 'entrega', '00000000-0000-0000-0000-000000000964') $$,
  '23514', 'Una entrega o venta a paciente dice a que paciente: elige al paciente.',
  'una entrega a paciente sin paciente se rechaza'
);

SELECT lives_ok(
  $$ INSERT INTO movimientos_inventario (id, tipo, lote_id, bodega_id, cantidad, motivo, registrado_por, paciente_id)
     VALUES ('b0000000-0000-0000-0000-000000000964', 'salida', 'a0000000-0000-0000-0000-000000000964',
             '70000000-0000-0000-0000-000000000964', 2, 'entrega',
             '00000000-0000-0000-0000-000000000964', '20000000-0000-0000-0000-000000000965') $$,
  'una entrega a paciente con su paciente se registra'
);

SELECT is(
  (SELECT paciente_id FROM movimientos_inventario WHERE id = 'b0000000-0000-0000-0000-000000000964'),
  '20000000-0000-0000-0000-000000000965'::UUID,
  'la salida guarda el paciente'
);

SELECT lives_ok(
  $$ INSERT INTO movimientos_inventario (tipo, lote_id, bodega_id, cantidad, motivo, registrado_por)
     VALUES ('salida', 'a0000000-0000-0000-0000-000000000964', '70000000-0000-0000-0000-000000000964',
             1, 'baja', '00000000-0000-0000-0000-000000000964') $$,
  'otra salida no necesita paciente'
);

SELECT throws_ok(
  $$ INSERT INTO movimientos_inventario (tipo, lote_id, bodega_id, cantidad, motivo, registrado_por, paciente_id)
     VALUES ('ingreso', 'a0000000-0000-0000-0000-000000000964', '70000000-0000-0000-0000-000000000964',
             1, 'COMP-964', '00000000-0000-0000-0000-000000000964', '20000000-0000-0000-0000-000000000965') $$,
  '23514', NULL,
  'un ingreso no puede llevar paciente'
);

-- Una entrega de antes de la 00191, sin paciente y todavia pendiente: se simula apagando el
-- trigger nuevo para insertarla. Tiene que poder aprobarse igual.
ALTER TABLE movimientos_inventario DISABLE TRIGGER trg_movimientos_inventario_exigir_paciente_en_entrega;
INSERT INTO movimientos_inventario (id, tipo, lote_id, bodega_id, cantidad, motivo, registrado_por)
VALUES ('b0000000-0000-0000-0000-000000000965', 'salida', 'a0000000-0000-0000-0000-000000000964',
        '70000000-0000-0000-0000-000000000964', 1, 'entrega', '00000000-0000-0000-0000-000000000964');
ALTER TABLE movimientos_inventario ENABLE TRIGGER trg_movimientos_inventario_exigir_paciente_en_entrega;

SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000965';

SELECT lives_ok(
  $$ UPDATE movimientos_inventario
     SET estado = 'aprobado', aprobado_por = '00000000-0000-0000-0000-000000000965', aprobado_en = NOW()
     WHERE id = 'b0000000-0000-0000-0000-000000000965' $$,
  'una entrega anterior sin paciente se puede seguir aprobando'
);

-- ============================================================================
-- 3. La fusion de pacientes mueve estas salidas (00191)
-- ============================================================================
-- La entrega del paciente Dos ya aprobada: la fusion tiene que moverla aunque este finalizada.
UPDATE movimientos_inventario
SET estado = 'aprobado', aprobado_por = '00000000-0000-0000-0000-000000000965', aprobado_en = NOW()
WHERE id = 'b0000000-0000-0000-0000-000000000964';

SELECT lives_ok(
  $$ SELECT fn_fusionar_pacientes('20000000-0000-0000-0000-000000000966',
                                  '20000000-0000-0000-0000-000000000965') $$,
  'la administradora fusiona un paciente que tiene una entrega sin consulta'
);

SELECT is(
  (SELECT paciente_id FROM movimientos_inventario WHERE id = 'b0000000-0000-0000-0000-000000000964'),
  '20000000-0000-0000-0000-000000000966'::UUID,
  'la entrega pasa al paciente que se conserva'
);

SELECT is(
  (SELECT count(*)::INT FROM movimientos_inventario WHERE paciente_id = '20000000-0000-0000-0000-000000000965'),
  0,
  'al paciente absorbido no le queda ninguna'
);

SELECT * FROM finish();

ROLLBACK;
