-- Pruebas de las politicas RLS de vistas agregadas: vista_reporte_impacto,
-- vista_lotes_disponibles y pacientes_reporte (issue #90, migracion 00041).
-- Corre con: supabase test db
--
-- Mismo patron que las suites ya mergeadas (#87/#88/00039): SET LOCAL ROLE
-- authenticated + SET LOCAL request.jwt.claim.sub simula un usuario de cada rol.
-- Los fixtures se insertan como postgres (superusuario, bypasea RLS) antes de
-- impersonar, en orden de dependencias: comunidad -> perfiles -> paciente ->
-- expediente -> jornada (en curso, lo exige el trigger de consultas de 00018) ->
-- personal asignado -> atencion -> consulta -> medicamento -> receta ->
-- receta_detalle -> lote -> proyecto.

BEGIN;

SELECT plan(30);

-- ============================================================================
-- Setup
-- ============================================================================
INSERT INTO comunidades (id, municipio_id, nombre) VALUES
  ('10000000-0000-0000-0000-000000000091', 101, 'Comunidad prueba vistas 91');

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000001001', 'admin91@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000001002', 'junta91@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000001003', 'socio91@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000001004', 'medico91@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000001005', 'voluntario91@test.ecopac.local');

-- DISABLE TRIGGER USER (no un nombre puntual): el trigger que bloquea el
-- auto-cambio de rol (00038) ya esta mergeado; USER desactiva todos los triggers
-- de usuario sobre perfiles sin necesitar saber cuales existen (patron de #88).
ALTER TABLE perfiles DISABLE TRIGGER USER;

UPDATE perfiles SET rol = 'administrador'   WHERE id = '00000000-0000-0000-0000-000000001001';
UPDATE perfiles SET rol = 'junta directiva' WHERE id = '00000000-0000-0000-0000-000000001002';
UPDATE perfiles SET rol = 'socio fundador'  WHERE id = '00000000-0000-0000-0000-000000001003';
UPDATE perfiles SET rol = 'medico'          WHERE id = '00000000-0000-0000-0000-000000001004';
-- voluntario1005 se queda con el rol por defecto (voluntario general).

ALTER TABLE perfiles ENABLE TRIGGER USER;

-- Paciente y su expediente (00009: expedientes requiere paciente_id UNIQUE y
-- numero_ficha UNIQUE).
INSERT INTO pacientes (id, nombres, apellidos, fecha_nacimiento, sexo, comunidad_id, telefono_contacto, idioma)
VALUES ('90000000-0000-0000-0000-000000001f01', 'Paciente', 'Prueba', '1990-01-01', 'F',
        '10000000-0000-0000-0000-000000000091', '5555-1000', 'espanol');

INSERT INTO expedientes (id, paciente_id, numero_ficha) VALUES
  ('e0000000-0000-0000-0000-0000000010e1', '90000000-0000-0000-0000-000000001f01', 'FICHA-91-001');

-- Jornada con estado 'en curso' (el trigger trg_validar_jornada_en_curso de 00018
-- exige ese estado para insertar consultas; dispara tambien para superusuario).
-- responsable_id es NOT NULL desde 00012; fecha futura por el check de 00012.
INSERT INTO jornadas (id, nombre, fecha, comunidad_id, responsable_id) VALUES
  ('40000000-0000-0000-0000-000000001a01', 'Jornada con personal 91', CURRENT_DATE + 30,
   '10000000-0000-0000-0000-000000000091', '00000000-0000-0000-0000-000000001001');

UPDATE jornadas SET estado = 'en curso' WHERE id = '40000000-0000-0000-0000-000000001a01';

INSERT INTO jornada_personal (jornada_id, perfil_id, rol_en_jornada, hora_inicio, hora_fin) VALUES
  ('40000000-0000-0000-0000-000000001a01', '00000000-0000-0000-0000-000000001004', 'medico', '08:00', '13:00'),
  ('40000000-0000-0000-0000-000000001a01', '00000000-0000-0000-0000-000000001005', 'voluntario general', '08:00', '13:00');

-- Cadena clinica: atencion -> consulta -> receta -> receta_detalle.
-- consultas (00018) exige expediente_id, atencion_id, medico_id, jornada_id y
-- motivo_consulta. receta_detalle (00019) exige medicamento_id, dosis,
-- frecuencia, duracion y cantidad_entregada > 0.
INSERT INTO atenciones (id, paciente_id, jornada_id) VALUES
  ('50000000-0000-0000-0000-000000001b01', '90000000-0000-0000-0000-000000001f01', '40000000-0000-0000-0000-000000001a01');

INSERT INTO consultas (id, expediente_id, atencion_id, medico_id, jornada_id, motivo_consulta) VALUES
  ('60000000-0000-0000-0000-000000001c01', 'e0000000-0000-0000-0000-0000000010e1',
   '50000000-0000-0000-0000-000000001b01', '00000000-0000-0000-0000-000000001004',
   '40000000-0000-0000-0000-000000001a01', 'Consulta de prueba 91');

-- medicamentos (00016) exige nombre, concentracion, presentacion y marca.
INSERT INTO medicamentos (id, nombre, concentracion, presentacion, marca) VALUES
  ('a0000000-0000-0000-0000-0000000010a1', 'Medicamento prueba 91', '500 mg', 'tableta', 'Generico');

INSERT INTO recetas (id, consulta_id, medico_id) VALUES
  ('70000000-0000-0000-0000-000000001d01', '60000000-0000-0000-0000-000000001c01', '00000000-0000-0000-0000-000000001004');

INSERT INTO receta_detalle (id, receta_id, medicamento_id, dosis, frecuencia, duracion, cantidad_entregada) VALUES
  ('80000000-0000-0000-0000-000000001e01', '70000000-0000-0000-0000-000000001d01',
   'a0000000-0000-0000-0000-0000000010a1', '500 mg', 'cada 8 horas', '7 dias', 2);

-- Lote vigente con stock para vista_lotes_disponibles (00019/00020, unificado en 00047).
INSERT INTO proveedores (id, nombre, tipo) VALUES
  ('c0000000-0000-0000-0000-0000000010c1', 'Proveedor prueba vistas 91', 'comercial');

INSERT INTO bodegas (id, nombre) VALUES
  ('d0000000-0000-0000-0000-0000000010d1', 'Bodega prueba vistas 91');

INSERT INTO lotes (id, medicamento_id, numero_lote, proveedor_id, origen, cantidad_ingresada, fecha_vencimiento) VALUES
  ('b0000000-0000-0000-0000-0000000010b1', 'a0000000-0000-0000-0000-0000000010a1', 'LOTE-91-001',
   'c0000000-0000-0000-0000-0000000010c1', 'compra', 100, CURRENT_DATE + 60);

INSERT INTO existencias (lote_id, bodega_id, cantidad_disponible) VALUES
  ('b0000000-0000-0000-0000-0000000010b1', 'd0000000-0000-0000-0000-0000000010d1', 100);

-- Proyecto: da contenido a proyecto_estado_historial (trigger de 00029) para que
-- la negativa de lectura de junta se pruebe sobre una tabla con datos.
INSERT INTO proyectos (id, nombre) VALUES
  ('50000000-0000-0000-0000-000000001901', 'Proyecto de prueba 91');

-- ============================================================================
-- administrador: acceso total a todas las vistas
-- ============================================================================
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000001001';

SELECT ok(
  (SELECT count(*) FROM vista_reporte_impacto) >= 1,
  'administrador ve vista_reporte_impacto'
);

SELECT ok(
  (SELECT count(*) FROM vista_lotes_disponibles) >= 1,
  'administrador ve vista_lotes_disponibles'
);

SELECT ok(
  (SELECT count(*) FROM pacientes_reporte) >= 1,
  'administrador ve pacientes_reporte'
);

SELECT ok(
  (SELECT count(*) FROM vista_lotes_disponibles WHERE lote_id = 'b0000000-0000-0000-0000-0000000010b1') = 1,
  'administrador ve el lote disponible del fixture'
);

-- ============================================================================
-- junta directiva: ve las vistas agregadas, no los historiales de estado
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000001002';

SELECT ok(
  (SELECT count(*) FROM vista_reporte_impacto) >= 1,
  'junta directiva ve vista_reporte_impacto'
);

SELECT ok(
  (SELECT count(*) FROM vista_lotes_disponibles) >= 1,
  'junta directiva ve vista_lotes_disponibles'
);

SELECT ok(
  (SELECT count(*) FROM pacientes_reporte) >= 1,
  'junta directiva ve pacientes_reporte'
);

SELECT ok(
  (SELECT count(*) FROM vista_lotes_disponibles WHERE lote_id = 'b0000000-0000-0000-0000-0000000010b1') = 1,
  'junta directiva ve el lote disponible del fixture'
);

-- Los historiales tienen datos (alta + cambio de estado de la jornada, alta del
-- proyecto), pero la politica de 00039 es solo administrador.
SELECT ok(
  (SELECT count(*) FROM jornada_estado_historial) = 0,
  'junta directiva NO ve jornada_estado_historial'
);

SELECT ok(
  (SELECT count(*) FROM proyecto_estado_historial) = 0,
  'junta directiva NO ve proyecto_estado_historial'
);

-- ============================================================================
-- socio fundador: mismos permisos que junta directiva sobre las vistas agregadas
-- (issue #404, es_consultivo()); el inventario es lectura abierta para autenticados
-- (00034), incluido socio
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000001003';

-- CAMBIO DE CONTRATO (migracion 00054, issue de reportes agregados sin filas clinicas).
-- Antes socio fundador no veia la vista. Esa migracion quito las cuatro politicas de
-- "junta directiva lee ... para reportes" sobre atenciones, consultas, recetas y receta_detalle
-- -- para que los roles consultivos dejaran de tener acceso a filas clinicas -- y a cambio dejo
-- la vista agregando como owner, con este WHERE:
--
--   WHERE public.es_administrador() OR public.es_consultivo()
--
-- O sea que socio fundador si ve los AGREGADOS, y nunca las filas de las que salen.
SELECT ok(
  (SELECT count(*) FROM vista_reporte_impacto) > 0,
  'socio fundador SI ve los agregados de vista_reporte_impacto (00054)'
);

-- CAMBIO DE CONTRATO (issue #404, migracion 00078): pacientes_reporte tambien es un
-- subconjunto no identificable (id, comunidad_id), no una fila clinica. El WHERE de la
-- vista comparaba antes solo contra 'junta directiva' a mano y dejaba fuera a socio
-- fundador; ahora usa es_consultivo() y los dos roles ven exactamente lo mismo.
SELECT ok(
  (SELECT count(*) FROM pacientes_reporte) >= 1,
  'socio fundador ve pacientes_reporte, igual que junta directiva (issue #404)'
);

SELECT ok(
  (SELECT count(*) FROM vista_lotes_disponibles) >= 1,
  'socio fundador ve vista_lotes_disponibles (inventario abierto a autenticados, 00034)'
);

-- ============================================================================
-- medico: solo su jornada asignada en reporte_impacto; ve lotes; no historial
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000001004';

-- CAMBIO DE CONTRATO (00054): el WHERE de la vista solo admite administrador, junta directiva y
-- socio fundador. El personal de campo dejo de verla, aunque este asignado a la jornada: para
-- trabajar tiene la cola de la jornada (vista_cola_jornada, 00060), no el reporte de impacto.
SELECT ok(
  (SELECT count(*) FROM vista_reporte_impacto WHERE jornada_id = '40000000-0000-0000-0000-000000001a01') = 0,
  'medico ya NO ve vista_reporte_impacto, ni su propia jornada (00054)'
);

SELECT ok(
  (SELECT count(*) FROM vista_reporte_impacto WHERE jornada_id <> '40000000-0000-0000-0000-000000001a01') = 0,
  'medico NO ve jornadas donde no esta asignado'
);

SELECT ok(
  (SELECT count(*) FROM vista_lotes_disponibles) >= 1,
  'medico ve vista_lotes_disponibles'
);

SELECT ok(
  (SELECT count(*) FROM jornada_estado_historial) = 0,
  'medico NO ve jornada_estado_historial'
);

-- ============================================================================
-- voluntario general: mismas restricciones de lectura que medico
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000001005';

-- CAMBIO DE CONTRATO (00054): mismo motivo que con el medico.
SELECT ok(
  (SELECT count(*) FROM vista_reporte_impacto WHERE jornada_id = '40000000-0000-0000-0000-000000001a01') = 0,
  'voluntario ya NO ve vista_reporte_impacto, ni su propia jornada (00054)'
);

SELECT ok(
  (SELECT count(*) FROM vista_reporte_impacto WHERE jornada_id <> '40000000-0000-0000-0000-000000001a01') = 0,
  'voluntario NO ve jornadas donde no esta asignado'
);

SELECT ok(
  (SELECT count(*) FROM vista_lotes_disponibles) >= 1,
  'voluntario ve vista_lotes_disponibles'
);

SELECT ok(
  (SELECT count(*) FROM jornada_estado_historial) = 0,
  'voluntario NO ve jornada_estado_historial'
);

-- ============================================================================
-- reportes.exportar concedido puntualmente a voluntario (issue #409): las vistas y la funcion
-- de reportes, antes exclusivas de administrador y los roles consultivos, ahora se permiten.
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000001001';

SELECT lives_ok(
  $$ INSERT INTO usuario_permiso (perfil_id, permiso_id, concedido, otorgado_por)
     SELECT '00000000-0000-0000-0000-000000001005', id, true, '00000000-0000-0000-0000-000000001001'
     FROM permisos WHERE clave = 'reportes.exportar' $$,
  'administrador concede reportes.exportar a voluntario1005 (issue #409)'
);

SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000001005';

SELECT ok(
  (SELECT count(*) FROM vista_reporte_impacto) >= 1,
  'voluntario con reportes.exportar concedido puntualmente ve vista_reporte_impacto (issue #409)'
);

SELECT ok(
  (SELECT count(*) FROM pacientes_reporte) >= 1,
  'voluntario con reportes.exportar concedido puntualmente ve pacientes_reporte (issue #409)'
);

SELECT lives_ok(
  $$ SELECT * FROM fn_reporte_pacientes_atendidos() $$,
  'voluntario con reportes.exportar concedido puntualmente puede llamar fn_reporte_pacientes_atendidos (issue #409)'
);

-- ============================================================================
-- Verificaciones estructurales: security_invoker y columnas expuestas
-- ============================================================================
-- CAMBIO DE CONTRATO (00054): vista_reporte_impacto paso a security_invoker = FALSE A PROPOSITO.
-- Es lo que le permite agregar sobre atenciones, consultas y recetas sin que junta directiva ni
-- socio fundador tengan politica de lectura sobre esas tablas. Quien acota las filas es el WHERE
-- de la vista, no RLS. vista_lotes_disponibles sigue en TRUE, que es lo correcto para ella:
-- su contenido no es clinico y las politicas de inventario ya lo gobiernan.
SELECT ok(
  (SELECT reloptions @> ARRAY['security_invoker=false'] FROM pg_class WHERE relname = 'vista_reporte_impacto'),
  'vista_reporte_impacto tiene security_invoker = FALSE (00054)'
);

SELECT ok(
  (SELECT reloptions @> ARRAY['security_invoker=true'] FROM pg_class WHERE relname = 'vista_lotes_disponibles'),
  'vista_lotes_disponibles tiene security_invoker = TRUE'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_class 
    WHERE relname = 'pacientes_reporte' 
    AND reloptions @> ARRAY['security_invoker=true']
  ),
  'pacientes_reporte NO tiene security_invoker (SECURITY DEFINER, patron perfiles_directorio)'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vista_reporte_impacto'
    AND column_name IN ('nombres', 'apellidos', 'dpi', 'diagnostico')
  ),
  'vista_reporte_impacto NO expone columnas sensibles (nombres, apellidos, dpi, diagnostico)'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pacientes_reporte'
    AND column_name IN ('nombres', 'apellidos', 'dpi', 'fecha_nacimiento', 'sexo', 'telefono_contacto', 'idioma', 'fecha_baja')
  ),
  'pacientes_reporte SOLO expone id y comunidad_id'
);

SELECT * FROM finish();
ROLLBACK;
