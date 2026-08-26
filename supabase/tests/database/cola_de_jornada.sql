-- Pruebas de la cola de la jornada y del cierre de atenciones
-- (issue #173, RF-24, migracion 00060).
-- Corre con: supabase test db
--
-- Mismo patron de simulacion de rol que las suites vecinas: SET LOCAL ROLE authenticated +
-- SET LOCAL request.jwt.claim.sub. El setup corre como el rol dueno de las tablas, exento de RLS.
--
-- LA PRUEBA QUE JUSTIFICA EL DISENO es la del bloque 4: que un voluntario general vea EXACTAMENTE
-- la misma etapa que un medico. Un voluntario no puede leer consultas ni recetas (00033), asi que
-- si vista_cola_jornada tuviera security_invoker = TRUE veria a todo paciente ya atendido como si
-- siguiera esperando consulta. Ninguna prueba de JavaScript puede cubrir eso.
--
-- Ningun dato real: la comunidad, la jornada y los pacientes son inventados.

BEGIN;

SELECT plan(13);

-- ============================================================================
-- Setup: una jornada en curso, un medico y un voluntario asignados, uno sin asignar,
-- y cuatro pacientes, uno por etapa del flujo.
-- ============================================================================
INSERT INTO comunidades (id, municipio_id, nombre) VALUES
  ('10000000-0000-0000-0000-000000000173', 101, 'Comunidad de prueba 173');

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000000173', 'medico173@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000000174', 'voluntario173@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000000175', 'medico-ajeno173@test.ecopac.local');

ALTER TABLE perfiles DISABLE TRIGGER USER;
UPDATE perfiles SET rol = 'medico' WHERE id = '00000000-0000-0000-0000-000000000173';
UPDATE perfiles SET rol = 'medico' WHERE id = '00000000-0000-0000-0000-000000000175';
-- voluntario173 se queda con el rol por defecto (voluntario general).
ALTER TABLE perfiles ENABLE TRIGGER USER;

INSERT INTO jornadas (id, nombre, fecha, comunidad_id, responsable_id, estado) VALUES
  ('30000000-0000-0000-0000-000000000173', 'Jornada de prueba 173',
   (NOW() AT TIME ZONE 'America/Guatemala')::date,
   '10000000-0000-0000-0000-000000000173', '00000000-0000-0000-0000-000000000173', 'en curso');

-- El medico y el voluntario estan asignados; medico-ajeno NO.
INSERT INTO jornada_personal (jornada_id, perfil_id, rol_en_jornada, hora_inicio, hora_fin) VALUES
  ('30000000-0000-0000-0000-000000000173', '00000000-0000-0000-0000-000000000173', 'medico', '08:00', '16:00'),
  ('30000000-0000-0000-0000-000000000173', '00000000-0000-0000-0000-000000000174', 'voluntario general', '08:00', '16:00');

INSERT INTO pacientes (id, nombres, apellidos, fecha_nacimiento, sexo, comunidad_id, telefono_contacto, idioma) VALUES
  ('20000000-0000-0000-0000-000000000101', 'Uno',    'Inventado', '1990-01-01', 'F', '10000000-0000-0000-0000-000000000173', '00000001', 'espanol'),
  ('20000000-0000-0000-0000-000000000102', 'Dos',    'Inventado', '1990-01-01', 'F', '10000000-0000-0000-0000-000000000173', '00000002', 'espanol'),
  ('20000000-0000-0000-0000-000000000103', 'Tres',   'Inventado', '1990-01-01', 'M', '10000000-0000-0000-0000-000000000173', '00000003', 'espanol'),
  ('20000000-0000-0000-0000-000000000104', 'Cuatro', 'Inventado', '1990-01-01', 'M', '10000000-0000-0000-0000-000000000173', '00000004', 'espanol');

INSERT INTO expedientes (id, paciente_id, numero_ficha) VALUES
  ('40000000-0000-0000-0000-000000000103', '20000000-0000-0000-0000-000000000103', 'F-0173-3'),
  ('40000000-0000-0000-0000-000000000104', '20000000-0000-0000-0000-000000000104', 'F-0173-4');

-- Los created_at van explicitos y escalonados. NOW() es constante dentro de una transaccion,
-- asi que sin esto la atencion, el triaje y la consulta quedarian con la MISMA marca de tiempo y
-- la prueba de esperando_desde no distinguiria nada. Con una hora de diferencia se ve de verdad
-- que cada paciente espera desde que entro a su etapa actual.
INSERT INTO atenciones (id, paciente_id, jornada_id, created_at) VALUES
  ('50000000-0000-0000-0000-000000000101', '20000000-0000-0000-0000-000000000101', '30000000-0000-0000-0000-000000000173', NOW() - INTERVAL '3 hours'),
  ('50000000-0000-0000-0000-000000000102', '20000000-0000-0000-0000-000000000102', '30000000-0000-0000-0000-000000000173', NOW() - INTERVAL '3 hours'),
  ('50000000-0000-0000-0000-000000000103', '20000000-0000-0000-0000-000000000103', '30000000-0000-0000-0000-000000000173', NOW() - INTERVAL '3 hours'),
  ('50000000-0000-0000-0000-000000000104', '20000000-0000-0000-0000-000000000104', '30000000-0000-0000-0000-000000000173', NOW() - INTERVAL '3 hours');

-- Paciente Dos: con triaje, sin consulta.
INSERT INTO triajes (atencion_id, presion_sistolica, presion_diastolica, frecuencia_cardiaca, tomado_por, tomado_en, created_at) VALUES
  ('50000000-0000-0000-0000-000000000102', 120, 80, 70, '00000000-0000-0000-0000-000000000174', NOW(), NOW() - INTERVAL '2 hours');

-- Pacientes Tres y Cuatro: con triaje y con consulta.
INSERT INTO triajes (atencion_id, presion_sistolica, presion_diastolica, frecuencia_cardiaca, tomado_por, tomado_en, created_at) VALUES
  ('50000000-0000-0000-0000-000000000103', 118, 78, 68, '00000000-0000-0000-0000-000000000174', NOW(), NOW() - INTERVAL '2 hours'),
  ('50000000-0000-0000-0000-000000000104', 130, 85, 75, '00000000-0000-0000-0000-000000000174', NOW(), NOW() - INTERVAL '2 hours');

INSERT INTO consultas (id, expediente_id, atencion_id, medico_id, jornada_id, motivo_consulta, created_at) VALUES
  ('60000000-0000-0000-0000-000000000103', '40000000-0000-0000-0000-000000000103',
   '50000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000173',
   '30000000-0000-0000-0000-000000000173', 'motivo de prueba', NOW() - INTERVAL '1 hour'),
  ('60000000-0000-0000-0000-000000000104', '40000000-0000-0000-0000-000000000104',
   '50000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000173',
   '30000000-0000-0000-0000-000000000173', 'motivo de prueba', NOW() - INTERVAL '1 hour');

-- Solo el paciente Tres sale con receta: es el que espera entrega.
INSERT INTO recetas (consulta_id, medico_id, folio) VALUES
  ('60000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000173', 'R-0173-3');

-- ============================================================================
-- 1. Las cuatro etapas, vistas por el medico asignado
-- ============================================================================
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000173';

SELECT is(
  (SELECT etapa FROM vista_cola_jornada WHERE atencion_id = '50000000-0000-0000-0000-000000000101'),
  'espera triaje',
  'sin triaje, el paciente espera triaje'
);

SELECT is(
  (SELECT etapa FROM vista_cola_jornada WHERE atencion_id = '50000000-0000-0000-0000-000000000102'),
  'espera consulta',
  'con triaje y sin consulta, espera consulta'
);

SELECT is(
  (SELECT etapa FROM vista_cola_jornada WHERE atencion_id = '50000000-0000-0000-0000-000000000103'),
  'espera entrega',
  'con consulta y con receta, espera entrega'
);

SELECT is(
  (SELECT etapa FROM vista_cola_jornada WHERE atencion_id = '50000000-0000-0000-0000-000000000104'),
  'lista para cerrar',
  'con consulta y SIN receta no hay nada que entregar: queda lista para cerrar'
);

-- ============================================================================
-- 2. esperando_desde es el inicio de la etapa actual, no el de la atencion
-- ============================================================================
-- Es lo que pide el criterio de aceptacion 3: a quien acaban de pasar a consulta no lleva
-- esperando desde que se registro.
SELECT is(
  (SELECT esperando_desde FROM vista_cola_jornada WHERE atencion_id = '50000000-0000-0000-0000-000000000103'),
  (SELECT created_at FROM consultas WHERE atencion_id = '50000000-0000-0000-0000-000000000103'),
  'quien ya paso por consulta espera desde la consulta, no desde que se registro'
);

SELECT is(
  (SELECT esperando_desde FROM vista_cola_jornada WHERE atencion_id = '50000000-0000-0000-0000-000000000102'),
  (SELECT created_at FROM triajes WHERE atencion_id = '50000000-0000-0000-0000-000000000102'),
  'quien ya paso por triaje espera desde el triaje'
);

SELECT is(
  (SELECT esperando_desde FROM vista_cola_jornada WHERE atencion_id = '50000000-0000-0000-0000-000000000101'),
  (SELECT iniciada_en FROM vista_cola_jornada WHERE atencion_id = '50000000-0000-0000-0000-000000000101'),
  'quien todavia espera triaje espera desde que se registro'
);

-- ============================================================================
-- 3. La cola no expone datos clinicos
-- ============================================================================
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vista_cola_jornada'
      AND column_name IN ('motivo_consulta', 'diagnostico', 'presion_sistolica', 'glucosa', 'dpi', 'folio')
  ),
  'la cola no expone motivo, diagnostico, signos vitales ni DPI'
);

-- ============================================================================
-- 4. LA PRUEBA QUE JUSTIFICA EL SECURITY DEFINER
-- ============================================================================
-- El voluntario no puede leer consultas ni recetas. Si la vista fuera security_invoker, aqui
-- veria 'espera consulta' para los pacientes Tres y Cuatro, y la cola mandaria a atender dos
-- veces a la misma persona.
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000174';

SELECT is(
  (SELECT count(*)::int FROM consultas),
  0,
  'confirmado: el voluntario NO puede leer la tabla consultas'
);

SELECT is(
  (SELECT etapa FROM vista_cola_jornada WHERE atencion_id = '50000000-0000-0000-0000-000000000103'),
  'espera entrega',
  'aun sin poder leer consultas, el voluntario ve la MISMA etapa que el medico'
);

SELECT is(
  (SELECT count(*)::int FROM vista_cola_jornada WHERE jornada_id = '30000000-0000-0000-0000-000000000173'),
  4,
  'el voluntario ve la cola completa de su jornada'
);

-- ============================================================================
-- 5. Quien no esta asignado a la jornada no ve su cola
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000175';

SELECT is(
  (SELECT count(*)::int FROM vista_cola_jornada WHERE jornada_id = '30000000-0000-0000-0000-000000000173'),
  0,
  'un medico que no participa en la jornada no ve ni un paciente de su cola'
);

-- ============================================================================
-- 6. Cerrar retira de la cola
-- ============================================================================
RESET ROLE;
UPDATE atenciones
SET cerrada_en = NOW(), motivo_cierre = 'el paciente se retiro'
WHERE id = '50000000-0000-0000-0000-000000000101';

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000173';

SELECT is(
  (SELECT count(*)::int FROM vista_cola_jornada WHERE atencion_id = '50000000-0000-0000-0000-000000000101'),
  0,
  'una atencion cerrada desaparece de la cola (criterio de aceptacion 5)'
);

SELECT * FROM finish();
ROLLBACK;
