-- Pruebas de las politicas RLS de vistas agregadas: vista_reporte_impacto,
-- vista_lotes_disponibles y pacientes_reporte (issue #90, migracion 00040).
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

SELECT plan(26);

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
  ('40000000-0000-0000-0000-000000001a01', '00000000-0000-0000-0000-000000001005', 'voluntario', '08:00', '13:00');

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

-- Lote vigente con stock para vista_lotes_disponibles (00024/00023).
INSERT INTO lotes_existencias (id, medicamento_id, numero_lote, fecha_vencimiento, cantidad) VALUES
  ('b0000000-0000-0000-0000-0000000010b1', 'a0000000-0000-0000-0000-0000000010a1', 'LOTE-91-001', CURRENT_DATE + 60, 100);

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
-- socio fundador: fuera del reporte de impacto y de pacientes_reporte; el
-- inventario es lectura abierta para autenticados (00034), incluido socio
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000001003';

SELECT ok(
  (SELECT count(*) FROM vista_reporte_impacto) = 0,
  'socio fundador NO ve vista_reporte_impacto'
);

SELECT ok(
  (SELECT count(*) FROM pacientes_reporte) = 0,
  'socio fundador NO ve pacientes_reporte'
);

SELECT ok(
  (SELECT count(*) FROM vista_lotes_disponibles) >= 1,
  'socio fundador ve vista_lotes_disponibles (inventario abierto a autenticados, 00034)'
);

-- ============================================================================
-- medico: solo su jornada asignada en reporte_impacto; ve lotes; no historial
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000001004';

SELECT ok(
  (SELECT count(*) FROM vista_reporte_impacto WHERE jornada_id = '40000000-0000-0000-0000-000000001a01') = 1,
  'medico ve su jornada asignada en vista_reporte_impacto'
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

SELECT ok(
  (SELECT count(*) FROM vista_reporte_impacto WHERE jornada_id = '40000000-0000-0000-0000-000000001a01') = 1,
  'voluntario ve su jornada asignada en vista_reporte_impacto'
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
-- Verificaciones estructurales: security_invoker y columnas expuestas
-- ============================================================================
SELECT ok(
  (SELECT reloptions @> ARRAY['security_invoker=true'] FROM pg_class WHERE relname = 'vista_reporte_impacto'),
  'vista_reporte_impacto tiene security_invoker = TRUE'
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
