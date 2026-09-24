-- Pruebas de las politicas RLS de las ocho tablas que no tenia cubiertas ninguna suite
-- (issue #221, criterio de aceptacion 2: una prueba positiva y una negativa por politica).
--
-- Cubre 21 politicas sobre condiciones_cronicas, padecimientos_cronicos, principios_activos,
-- medicamento_principio, consulta_diagnostico, alertas_caducidad, proyecto_hitos y
-- proyecto_seguimiento.
--
-- Se suman aqui, ademas, dos pruebas de departamentos y municipios (issue #406, migracion
-- 00073): una positiva y una negativa por tabla, en el mismo estilo GRANT-primero que usa la
-- negativa de principios_activos mas abajo -- no hace falta simular RLS filtrando filas, porque
-- antes de 00073 la operacion moria por falta de GRANT sin llegar a evaluar ninguna politica, y
-- la negativa de anon sigue probando exactamente eso.
--
-- condiciones_cronicas era el tercer ejemplo de ese estilo hasta la 00140 (issue #850), que le
-- dio GRANT de INSERT y UPDATE. Su cobertura propia vive en escritura_catalogo_condiciones.sql;
-- aqui queda la lectura y la negativa de los roles consultivos.
--
-- QUE NO ESTA AQUI, Y POR QUE
--
-- donantes, donaciones y donacion_detalle no estan en esta suite: tenian politicas pero ningun
-- GRANT -- la misma clase de vacio que tenian departamentos y municipios antes de 00073 -- y
-- ademas las politicas mismas estaban rotas (issue #403, migracion 00083). Su cobertura vive en
-- politicas_rls_donaciones.sql, aparte, porque es su propio modulo y su propia issue.
--
-- Mismo patron de simulacion de rol que las suites vecinas: SET LOCAL ROLE authenticated +
-- SET LOCAL request.jwt.claim.sub. El setup corre como el rol dueno, exento de RLS.
--
-- Ningun dato real: pacientes, comunidades, departamentos, municipios y proyectos son
-- inventados. Los ids de departamentos/municipios de prueba (900221) estan fuera del rango real
-- de Guatemala (1-22 y 101-2299 aprox., ver supabase/seed.sql) para no chocar con esas filas.

BEGIN;

SELECT plan(33);

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

-- Ids fuera del rango real de Guatemala (departamentos 1-22, municipios ~101-2299, ver
-- supabase/seed.sql) para no chocar con las filas reales que carga ese seed.
INSERT INTO departamentos (id, nombre) VALUES
  (900221, 'Departamento de prueba 221');

INSERT INTO municipios (id, departamento_id, nombre) VALUES
  (900221, 900221, 'Municipio de prueba 221');

INSERT INTO comunidades (id, municipio_id, nombre) VALUES
  ('10000000-0000-0000-0000-000000221001', 101, 'Comunidad 221');

INSERT INTO pacientes (id, nombres, apellidos, fecha_nacimiento, sexo, comunidad_id, telefono_contacto, idioma) VALUES
  ('20000000-0000-0000-0000-000000221001', 'Uno', 'Inventado', '1990-01-01', 'Femenino',
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

INSERT INTO medicamentos (id, nombre, concentracion, presentacion_id, marca) VALUES
  ('74000000-0000-0000-0000-000000221001', 'Medicamento 221', '500 mg',
   (SELECT id FROM presentaciones WHERE nombre = 'Tableta'), 'Generico');

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

-- Hasta la 00140 la negativa de esta tabla era que NADIE la escribiera: no tenia GRANT de
-- INSERT, asi que el intento del voluntario moria con 42501 antes de que RLS se evaluara. La
-- 00140 (issue #850) abrio el alta a los tres roles que atienden -- administrador, medico y
-- voluntario general --, de modo que ese intento ahora funciona y la negativa se mudo a los dos
-- roles consultivos, que desde la 00054 no tocan ninguna fila clinica.
--
-- Sigue siendo un throws_ok y no un is_empty porque un INSERT que no pasa el WITH CHECK lanza
-- 42501 igual que la falta de GRANT. La otra forma -- la sentencia corre y no afecta ninguna
-- fila -- es la de un UPDATE filtrado por USING, y esas se comprueban con is_empty() mas abajo.
--
-- El reparto completo de la 00140, con sus positivas y el indice de nombre normalizado, esta en
-- escritura_catalogo_condiciones.sql.
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000221002';

SELECT throws_ok(
  $$ INSERT INTO condiciones_cronicas (nombre) VALUES ('Intento 221') $$,
  '42501',
  NULL,
  'NEGATIVA condiciones_cronicas: un rol consultivo no escribe el catalogo clinico (00140)'
);

-- ============================================================================
-- departamentos y municipios: catalogo de lectura abierta (issue #406, 2 politicas)
-- ============================================================================
-- RLS ya tenia la politica publica desde 00006, lo que faltaba era el GRANT que la migracion
-- 00073 completo. La negativa de anon prueba esa capa exacta: sin GRANT, la sentencia muere con
-- 42501 antes de que la politica USING (true) llegue a evaluarse.
--
-- Vuelve la sesion del voluntario, que es de quien hablan las dos positivas de aqui abajo: el
-- bloque anterior la habia cambiado a junta directiva para su negativa.
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000221004';

SELECT ok(
  (SELECT count(*) FROM departamentos WHERE id = 900221) > 0,
  'POSITIVA departamentos SELECT: un voluntario lee el catalogo de departamentos'
);

SELECT ok(
  (SELECT count(*) FROM municipios WHERE id = 900221) > 0,
  'POSITIVA municipios SELECT: un voluntario lee el catalogo de municipios'
);

-- La negativa de estos dos es que NADIE los escriba desde la aplicacion, y siguen siendo el
-- caso puro de "falta el GRANT": sin INSERT concedido a authenticated, la sentencia muere con
-- 42501 antes de que RLS llegue a evaluarse. condiciones_cronicas ya no sirve de ejemplo de
-- esto: la 00140 le concedio el GRANT, y su negativa es ahora la de un WITH CHECK que falla.
SELECT throws_ok(
  $$ INSERT INTO departamentos (id, nombre) VALUES (900222, 'Intento 221') $$,
  '42501',
  NULL,
  'NEGATIVA departamentos: sin GRANT de INSERT, ni el voluntario ni nadie escribe'
);

SELECT throws_ok(
  $$ INSERT INTO municipios (id, departamento_id, nombre) VALUES (900222, 900221, 'Intento 221') $$,
  '42501',
  NULL,
  'NEGATIVA municipios: sin GRANT de INSERT, ni el voluntario ni nadie escribe'
);

SET LOCAL ROLE anon;

SELECT throws_ok(
  $$ SELECT count(*) FROM departamentos $$,
  '42501',
  NULL,
  'NEGATIVA departamentos SELECT: anon no tiene GRANT, ni siquiera llega a evaluar la politica publica'
);

SELECT throws_ok(
  $$ SELECT count(*) FROM municipios $$,
  '42501',
  NULL,
  'NEGATIVA municipios SELECT: anon no tiene GRANT, ni siquiera llega a evaluar la politica publica'
);

SET LOCAL ROLE authenticated;

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

-- Desde la 00138 (issue #755) nadie hace UPDATE directo sobre alertas_caducidad: se atiende con
-- fn_atender_alerta_caducidad, que ademas descuenta el stock. Por eso el voluntario ya no choca
-- con la politica (fila invisible, resultado vacio) sino con el GRANT (42501).
SELECT throws_ok(
  $$ UPDATE alertas_caducidad SET estado = 'atendida', accion = 'descartado'
     WHERE id = '77000000-0000-0000-0000-000000221001' RETURNING id $$,
  '42501',
  NULL,
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

-- ISSUE #864: junta directiva leia los hitos y la bitacora de avance de un proyecto (00053,
-- ampliada por la 00080). La 00141 deja las dos politicas en es_administrador(): los dos roles
-- consultivos se quedan con Reportes como unica pantalla y ya no entran a proyectos.
SELECT is(
  (SELECT count(*) FROM proyecto_hitos)::int, 0,
  'NEGATIVA SELECT: junta directiva ya no lee los hitos (issue #864)'
);

SELECT is(
  (SELECT count(*) FROM proyecto_seguimiento)::int, 0,
  'NEGATIVA SELECT: junta directiva ya no lee la bitacora de avance (issue #864)'
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
