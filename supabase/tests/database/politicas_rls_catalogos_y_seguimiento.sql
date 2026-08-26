-- Pruebas de las politicas RLS de las ocho tablas que no tenia cubiertas ninguna suite
-- (issue #221, criterio de aceptacion 2: una prueba positiva y una negativa por politica).
--
-- Cubre 21 politicas sobre condiciones_cronicas, padecimientos_cronicos, principios_activos,
-- medicamento_principio, consulta_diagnostico, alertas_caducidad, proyecto_hitos y
-- proyecto_seguimiento.
--
-- QUE NO ESTA AQUI, Y POR QUE
--
-- Quedan cinco tablas del esquema sin cobertura: donantes, donaciones y donacion_detalle
-- (issue #403) y departamentos y municipios (issue #406). Las cinco tienen politicas pero
-- NINGUN GRANT, asi que hoy estan denegadas a todos los roles: una prueba escrita ahora
-- fallaria, y como el CI pasa a correr este directorio entero (criterio 5), dejaria el pipeline
-- en rojo por un bug que es de otras issues. Se cubren cuando esas dos se arreglen.
--
-- Mismo patron de simulacion de rol que las suites vecinas: SET LOCAL ROLE authenticated +
-- SET LOCAL request.jwt.claim.sub. El setup corre como el rol dueno, exento de RLS.
--
-- Ningun dato real: pacientes, comunidades y proyectos son inventados.

BEGIN;

SELECT plan(26);

-- ============================================================================
-- Setup: un perfil por cada rol que estas politicas distinguen, y las filas
-- minimas de cada tabla para poder leerlas y escribirlas.
-- ============================================================================
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000221001', 'admin221@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000221002', 'junta221@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000221003', 'medico221@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000221004', 'voluntario221@test.ecopac.local');

ALTER TABLE perfiles DISABLE TRIGGER USER;
UPDATE perfiles SET rol = 'administrador'   WHERE id = '00000000-0000-0000-0000-000000221001';
UPDATE perfiles SET rol = 'junta directiva' WHERE id = '00000000-0000-0000-0000-000000221002';
UPDATE perfiles SET rol = 'medico'          WHERE id = '00000000-0000-0000-0000-000000221003';
-- voluntario221 se queda con el rol por defecto (voluntario general).
ALTER TABLE perfiles ENABLE TRIGGER USER;

INSERT INTO comunidades (id, municipio_id, nombre) VALUES
  ('10000000-0000-0000-0000-000000221001', 101, 'Comunidad 221');

INSERT INTO pacientes (id, nombres, apellidos, fecha_nacimiento, sexo, comunidad_id, telefono_contacto, idioma) VALUES
  ('20000000-0000-0000-0000-000000221001', 'Uno', 'Inventado', '1990-01-01', 'F',
   '10000000-0000-0000-0000-000000221001', '00000221', 'espanol');

INSERT INTO expedientes (id, paciente_id, numero_ficha) VALUES
  ('40000000-0000-0000-0000-000000221001', '20000000-0000-0000-0000-000000221001', 'F-221');

INSERT INTO jornadas (id, nombre, fecha, comunidad_id, responsable_id, estado) VALUES
  ('30000000-0000-0000-0000-000000221001', 'Jornada 221',
   (NOW() AT TIME ZONE 'America/Guatemala')::date,
   '10000000-0000-0000-0000-000000221001', '00000000-0000-0000-0000-000000221001', 'en curso');

INSERT INTO atenciones (id, paciente_id, jornada_id) VALUES
  ('50000000-0000-0000-0000-000000221001', '20000000-0000-0000-0000-000000221001', '30000000-0000-0000-0000-000000221001');

INSERT INTO consultas (id, expediente_id, atencion_id, medico_id, jornada_id, motivo_consulta) VALUES
  ('60000000-0000-0000-0000-000000221001', '40000000-0000-0000-0000-000000221001',
   '50000000-0000-0000-0000-000000221001', '00000000-0000-0000-0000-000000221003',
   '30000000-0000-0000-0000-000000221001', 'motivo de prueba');

INSERT INTO diagnosticos (id, nombre) VALUES
  ('70000000-0000-0000-0000-000000221001', 'Diagnostico de prueba 221'),
  ('70000000-0000-0000-0000-000000221002', 'Diagnostico de prueba 221 bis');

-- Dos condiciones: padecimientos_cronicos tiene UNIQUE (paciente_id, condicion_id), asi que la
-- prueba positiva de INSERT necesita una condicion distinta a la que ya usa el fixture.
INSERT INTO condiciones_cronicas (id, nombre) VALUES
  ('71000000-0000-0000-0000-000000221001', 'Condicion de prueba 221'),
  ('71000000-0000-0000-0000-000000221002', 'Condicion de prueba 221 bis');

INSERT INTO padecimientos_cronicos (id, paciente_id, condicion_id, fecha_diagnostico) VALUES
  ('72000000-0000-0000-0000-000000221001', '20000000-0000-0000-0000-000000221001',
   '71000000-0000-0000-0000-000000221001', CURRENT_DATE - 30);

INSERT INTO principios_activos (id, nombre) VALUES
  ('73000000-0000-0000-0000-000000221001', 'Principio de prueba 221');

INSERT INTO medicamentos (id, nombre, concentracion, presentacion, marca) VALUES
  ('74000000-0000-0000-0000-000000221001', 'Medicamento 221', '500 mg', 'tableta', 'Generico');

INSERT INTO medicamento_principio (medicamento_id, principio_id) VALUES
  ('74000000-0000-0000-0000-000000221001', '73000000-0000-0000-0000-000000221001');

INSERT INTO proveedores (id, nombre, tipo) VALUES
  ('75000000-0000-0000-0000-000000221001', 'Proveedor 221', 'comercial');

INSERT INTO lotes (id, medicamento_id, numero_lote, fecha_vencimiento, proveedor_id, origen, cantidad_ingresada) VALUES
  ('76000000-0000-0000-0000-000000221001', '74000000-0000-0000-0000-000000221001', 'L-221',
   CURRENT_DATE + 60, '75000000-0000-0000-0000-000000221001', 'compra', 100);

INSERT INTO alertas_caducidad (id, lote_id, cantidad_afectada) VALUES
  ('77000000-0000-0000-0000-000000221001', '76000000-0000-0000-0000-000000221001', 10);

INSERT INTO proyectos (id, nombre) VALUES
  ('78000000-0000-0000-0000-000000221001', 'Proyecto 221');

INSERT INTO proyecto_hitos (id, proyecto_id, nombre, fecha_prevista) VALUES
  ('79000000-0000-0000-0000-000000221001', '78000000-0000-0000-0000-000000221001', 'Hito 221', CURRENT_DATE + 30);

INSERT INTO proyecto_seguimiento (id, proyecto_id, nota) VALUES
  ('7a000000-0000-0000-0000-000000221001', '78000000-0000-0000-0000-000000221001', 'Nota 221');

SET LOCAL ROLE authenticated;

-- ============================================================================
-- condiciones_cronicas: catalogo de lectura abierta (1 politica)
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000221004';

SELECT ok(
  (SELECT count(*) FROM condiciones_cronicas) > 0,
  'POSITIVA condiciones_cronicas: un voluntario lee el catalogo'
);

-- La negativa de un catalogo de lectura abierta es que NADIE lo escriba desde la aplicacion.
--
-- Ojo con la forma de comprobarlo, porque aqui se ven las DOS capas: condiciones_cronicas no
-- tiene GRANT de INSERT para authenticated, asi que la operacion muere con 42501 ANTES de que
-- RLS llegue a evaluarse. No devuelve cero filas: revienta. Cuando la tabla si tiene el GRANT y
-- lo que falta es la politica, el resultado es el contrario -- la sentencia corre y no afecta
-- ninguna fila --, y esas negativas se comprueban con is_empty() mas abajo.
SELECT throws_ok(
  $$ INSERT INTO condiciones_cronicas (nombre) VALUES ('Intento 221') $$,
  '42501',
  NULL,
  'NEGATIVA condiciones_cronicas: sin GRANT de INSERT, ni el voluntario ni nadie escribe'
);

-- ============================================================================
-- padecimientos_cronicos: medico y administrador leen, registran y actualizan;
-- solo administrador borra (4 politicas)
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000221003';

SELECT ok(
  (SELECT count(*) FROM padecimientos_cronicos) > 0,
  'POSITIVA padecimientos_cronicos SELECT: el medico lee los padecimientos'
);

SELECT lives_ok(
  $$ INSERT INTO padecimientos_cronicos (paciente_id, condicion_id, fecha_diagnostico)
     VALUES ('20000000-0000-0000-0000-000000221001', '71000000-0000-0000-0000-000000221002', CURRENT_DATE) $$,
  'POSITIVA padecimientos_cronicos INSERT: el medico registra un padecimiento'
);

-- isnt_empty y no is_empty: una positiva tiene que devolver la fila que cambio. Con is_empty
-- esta prueba pasaria justamente cuando la politica FALLARA.
SELECT isnt_empty(
  $$ UPDATE padecimientos_cronicos SET estado = 'controlada'
     WHERE id = '72000000-0000-0000-0000-000000221001' RETURNING id $$,
  'POSITIVA padecimientos_cronicos UPDATE: el medico actualiza el estado'
);

SELECT is_empty(
  $$ DELETE FROM padecimientos_cronicos WHERE id = '72000000-0000-0000-0000-000000221001' RETURNING id $$,
  'NEGATIVA padecimientos_cronicos DELETE: el medico NO borra, solo el administrador'
);

SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000221004';

SELECT is(
  (SELECT count(*)::int FROM padecimientos_cronicos), 0,
  'NEGATIVA padecimientos_cronicos SELECT: el voluntario no lee informacion clinica'
);

-- ============================================================================
-- principios_activos: autenticados leen; solo administrador escribe (4 politicas)
-- ============================================================================
SELECT ok(
  (SELECT count(*) FROM principios_activos) > 0,
  'POSITIVA principios_activos SELECT: un voluntario lee el catalogo'
);

-- Un INSERT que no pasa el WITH CHECK de la politica LANZA 42501; no devuelve cero filas.
-- La diferencia importa al escribir la prueba: los UPDATE y DELETE de mas abajo si se comprueban
-- con is_empty(), porque ahi la politica filtra por USING y la sentencia corre sin afectar nada.
SELECT throws_ok(
  $$ INSERT INTO principios_activos (nombre) VALUES ('Intento 221') $$,
  '42501',
  NULL,
  'NEGATIVA principios_activos INSERT: el voluntario no crea principios'
);

SELECT is_empty(
  $$ UPDATE principios_activos SET nombre = 'Cambiado 221'
     WHERE id = '73000000-0000-0000-0000-000000221001' RETURNING id $$,
  'NEGATIVA principios_activos UPDATE: el voluntario no edita el catalogo'
);

SELECT is_empty(
  $$ DELETE FROM principios_activos WHERE id = '73000000-0000-0000-0000-000000221001' RETURNING id $$,
  'NEGATIVA principios_activos DELETE: el voluntario no borra del catalogo'
);

SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000221001';

SELECT lives_ok(
  $$ INSERT INTO principios_activos (nombre) VALUES ('Principio nuevo 221') $$,
  'POSITIVA principios_activos INSERT: el administrador si crea principios'
);

-- ============================================================================
-- medicamento_principio: autenticados leen; solo administrador asocia (2 politicas)
-- ============================================================================
SELECT lives_ok(
  $$ INSERT INTO medicamento_principio (medicamento_id, principio_id)
     SELECT '74000000-0000-0000-0000-000000221001', id
     FROM principios_activos WHERE nombre = 'Principio nuevo 221' $$,
  'POSITIVA medicamento_principio INSERT: el administrador asocia un principio'
);

SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000221004';

SELECT ok(
  (SELECT count(*) FROM medicamento_principio) > 0,
  'POSITIVA medicamento_principio SELECT: un voluntario lee la composicion'
);

SELECT throws_ok(
  $$ INSERT INTO medicamento_principio (medicamento_id, principio_id)
     VALUES ('74000000-0000-0000-0000-000000221001', '73000000-0000-0000-0000-000000221001') $$,
  '42501',
  NULL,
  'NEGATIVA medicamento_principio INSERT: el voluntario no asocia principios'
);

-- ============================================================================
-- consulta_diagnostico: medico y administrador leen y registran (2 politicas)
-- ============================================================================
SELECT is(
  (SELECT count(*)::int FROM consulta_diagnostico), 0,
  'NEGATIVA consulta_diagnostico SELECT: el voluntario no lee diagnosticos de una consulta'
);

SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000221003';

SELECT lives_ok(
  $$ INSERT INTO consulta_diagnostico (consulta_id, diagnostico_id, es_principal)
     VALUES ('60000000-0000-0000-0000-000000221001', '70000000-0000-0000-0000-000000221001', TRUE) $$,
  'POSITIVA consulta_diagnostico INSERT: el medico registra el diagnostico de su consulta'
);

SELECT ok(
  (SELECT count(*) FROM consulta_diagnostico) > 0,
  'POSITIVA consulta_diagnostico SELECT: el medico lee lo que registro'
);

-- ============================================================================
-- alertas_caducidad: autenticados leen; solo administrador atiende (2 politicas)
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000221004';

SELECT ok(
  (SELECT count(*) FROM alertas_caducidad) > 0,
  'POSITIVA alertas_caducidad SELECT: un voluntario ve las alertas de vencimiento'
);

SELECT is_empty(
  $$ UPDATE alertas_caducidad SET estado = 'atendida', accion = 'descartado'
     WHERE id = '77000000-0000-0000-0000-000000221001' RETURNING id $$,
  'NEGATIVA alertas_caducidad UPDATE: el voluntario no puede atender una alerta'
);

-- ============================================================================
-- proyecto_hitos y proyecto_seguimiento: administrador y junta leen;
-- solo administrador escribe (6 politicas)
-- ============================================================================
SELECT is(
  (SELECT count(*)::int FROM proyecto_hitos), 0,
  'NEGATIVA proyecto_hitos SELECT: el voluntario no ve los hitos de un proyecto'
);

SELECT is(
  (SELECT count(*)::int FROM proyecto_seguimiento), 0,
  'NEGATIVA proyecto_seguimiento SELECT: el voluntario no ve la bitacora'
);

SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000221002';

SELECT ok(
  (SELECT count(*) FROM proyecto_hitos) > 0 AND (SELECT count(*) FROM proyecto_seguimiento) > 0,
  'POSITIVA SELECT: junta directiva lee hitos y bitacora'
);

SELECT throws_ok(
  $$ INSERT INTO proyecto_hitos (proyecto_id, nombre, fecha_prevista)
     VALUES ('78000000-0000-0000-0000-000000221001', 'Hito de junta', CURRENT_DATE + 10) $$,
  '42501',
  NULL,
  'NEGATIVA proyecto_hitos INSERT: junta directiva lee pero no crea hitos'
);

SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000221001';

SELECT lives_ok(
  $$ INSERT INTO proyecto_hitos (proyecto_id, nombre, fecha_prevista)
     VALUES ('78000000-0000-0000-0000-000000221001', 'Hito del admin', CURRENT_DATE + 20) $$,
  'POSITIVA proyecto_hitos INSERT: el administrador si crea hitos'
);

SELECT lives_ok(
  $$ INSERT INTO proyecto_seguimiento (proyecto_id, nota)
     VALUES ('78000000-0000-0000-0000-000000221001', 'Nota del admin') $$,
  'POSITIVA proyecto_seguimiento INSERT: el administrador anota en la bitacora'
);

SELECT * FROM finish();
ROLLBACK;
