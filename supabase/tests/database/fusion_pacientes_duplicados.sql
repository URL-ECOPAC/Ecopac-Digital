-- Pruebas de fn_fusionar_pacientes() (issue #637, migraciones 00101 y 00119). Corre con:
-- supabase test db
--
-- pgTAP NO corre en CI (docs/CI-CD.md no lo lista entre los workflows de GitHub Actions): esta
-- suite protege la entrega si alguien la corre a mano con el stack local, no es una guarda
-- automatica. Ver PLAN.md / notas de deploy de #637.
--
-- Mismo patron que politicas_rls_pacientes_expedientes.sql para simular una sesion
-- (SET LOCAL ROLE authenticated + request.jwt.claim.sub) y que jornada_en_curso_atenciones.sql
-- para sembrar jornadas en un estado puntual con INSERT directo.
--
-- Grupo 1 (assertions 1-9) es el gate del criterio 2: prueba, fila por fila, que
-- fn_fusionar_pacientes() de verdad mueve atenciones, padecimientos_cronicos y consultas -- y que
-- las recetas, que cuelgan de consultas.id sin tocarse, quedan alcanzables desde el sobreviviente.
--
-- Grupo 2 (assertion 10) documenta un defecto encontrado al escribir esta prueba, FUERA del
-- alcance de #637 (no se toca aqui, ver PLAN.md): fn_fusionar_pacientes reasigna
-- atenciones.paciente_id con un UPDATE simple, y ese UPDATE dispara
-- trg_validar_jornada_en_curso_atenciones (00055) igual que cualquier otro UPDATE de esa tabla,
-- sin importar que columna cambio. Esa funcion exige que la jornada de la atencion este
-- 'en curso'; una jornada ya finalizada -el caso normal, porque una fusion casi siempre se hace
-- despues de que la jornada termino- hace que la fusion entera aborte. Es un defecto de las
-- migraciones ya aplicadas (00055/00101), no algo que #637 haya introducido, y las instrucciones
-- de esta tarea piden documentarlo, no corregirlo silenciosamente.
--
-- Grupo 3 (assertion 11) prueba el ELSE que agrega la 00119: si alguno de los dos pacientes no
-- tiene expediente, la fusion aborta en vez de saltarse la reasignacion de consultas en silencio.
--
-- Ningun dato real: comunidad, jornadas y pacientes son inventados.

BEGIN;

SELECT plan(11);

-- ============================================================================
-- Setup: una comunidad, un administrador (fusiona) y un medico (dueno de consultas/recetas).
-- ============================================================================
INSERT INTO comunidades (id, municipio_id, nombre) VALUES
  ('10000000-0000-0000-0000-000000000637', 101, 'Comunidad de prueba 637');

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000000637', 'admin637@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000000638', 'medico637@test.ecopac.local');

-- Mismo motivo que politicas_rls_pacientes_expedientes.sql: DISABLE TRIGGER USER (no un nombre
-- puntual) para poder fijar el rol sin que el trigger que bloquea el auto-cambio de rol (00031)
-- se interponga.
ALTER TABLE perfiles DISABLE TRIGGER USER;
UPDATE perfiles SET rol = 'administrador' WHERE id = '00000000-0000-0000-0000-000000000637';
UPDATE perfiles SET rol = 'medico' WHERE id = '00000000-0000-0000-0000-000000000638';
ALTER TABLE perfiles ENABLE TRIGGER USER;

-- ============================================================================
-- Grupo 1: dos pacientes, cada uno con una atencion en jornada distinta (las dos EN CURSO -- el
-- otro estado posible, finalizada, es justo lo que el grupo 2 documenta que rompe la fusion hoy),
-- una condicion cronica distinta y una consulta con receta.
-- ============================================================================
INSERT INTO pacientes (id, nombres, apellidos, fecha_nacimiento, sexo, comunidad_id, telefono_contacto, idioma) VALUES
  ('20000000-0000-0000-0000-000000000637', 'Sobreviviente', 'Grupo1', '1990-01-01', 'F',
   '10000000-0000-0000-0000-000000000637', '5555-0001', 'espanol'),
  ('20000000-0000-0000-0000-000000000638', 'Absorbido', 'Grupo1', '1990-01-01', 'F',
   '10000000-0000-0000-0000-000000000637', '5555-0002', 'espanol');

INSERT INTO expedientes (id, paciente_id, numero_ficha) VALUES
  ('40000000-0000-0000-0000-000000000637', '20000000-0000-0000-0000-000000000637', 'F-637-A'),
  ('40000000-0000-0000-0000-000000000638', '20000000-0000-0000-0000-000000000638', 'F-637-B');

INSERT INTO jornadas (id, nombre, fecha, comunidad_id, responsable_id, estado) VALUES
  ('30000000-0000-0000-0000-000000000637', 'Jornada sobreviviente 637',
   (NOW() AT TIME ZONE 'America/Guatemala')::date,
   '10000000-0000-0000-0000-000000000637', '00000000-0000-0000-0000-000000000637', 'en curso'),
  ('30000000-0000-0000-0000-000000000638', 'Jornada absorbido 637',
   (NOW() AT TIME ZONE 'America/Guatemala')::date,
   '10000000-0000-0000-0000-000000000637', '00000000-0000-0000-0000-000000000637', 'en curso');

INSERT INTO atenciones (id, paciente_id, jornada_id) VALUES
  ('50000000-0000-0000-0000-000000000637', '20000000-0000-0000-0000-000000000637',
   '30000000-0000-0000-0000-000000000637'),
  ('50000000-0000-0000-0000-000000000638', '20000000-0000-0000-0000-000000000638',
   '30000000-0000-0000-0000-000000000638');

INSERT INTO padecimientos_cronicos (id, paciente_id, condicion_id, fecha_diagnostico) VALUES
  ('80000000-0000-0000-0000-000000000637', '20000000-0000-0000-0000-000000000637',
   (SELECT id FROM condiciones_cronicas WHERE nombre = 'Diabetes'), '2020-01-01'),
  ('80000000-0000-0000-0000-000000000638', '20000000-0000-0000-0000-000000000638',
   (SELECT id FROM condiciones_cronicas WHERE nombre = 'Hipertension'), '2021-01-01');

INSERT INTO consultas (id, expediente_id, atencion_id, medico_id, jornada_id, motivo_consulta) VALUES
  ('60000000-0000-0000-0000-000000000637', '40000000-0000-0000-0000-000000000637',
   '50000000-0000-0000-0000-000000000637', '00000000-0000-0000-0000-000000000638',
   '30000000-0000-0000-0000-000000000637', 'Motivo sobreviviente 637'),
  ('60000000-0000-0000-0000-000000000638', '40000000-0000-0000-0000-000000000638',
   '50000000-0000-0000-0000-000000000638', '00000000-0000-0000-0000-000000000638',
   '30000000-0000-0000-0000-000000000638', 'Motivo absorbido 637');

INSERT INTO recetas (id, consulta_id, medico_id) VALUES
  ('70000000-0000-0000-0000-000000000637', '60000000-0000-0000-0000-000000000637',
   '00000000-0000-0000-0000-000000000638'),
  ('70000000-0000-0000-0000-000000000638', '60000000-0000-0000-0000-000000000638',
   '00000000-0000-0000-0000-000000000638');

-- ============================================================================
-- Grupo 2: un absorbido con una atencion en una jornada que EMPIEZA en curso (para poder
-- registrar la atencion) y despues se finaliza (para reproducir el caso normal: la fusion se
-- intenta despues de que la jornada ya termino).
-- ============================================================================
INSERT INTO pacientes (id, nombres, apellidos, fecha_nacimiento, sexo, comunidad_id, telefono_contacto, idioma) VALUES
  ('20000000-0000-0000-0000-000000000639', 'Sobreviviente', 'Grupo2', '1985-02-02', 'M',
   '10000000-0000-0000-0000-000000000637', '5555-0003', 'espanol'),
  ('20000000-0000-0000-0000-000000000640', 'Absorbido', 'Grupo2', '1985-02-02', 'M',
   '10000000-0000-0000-0000-000000000637', '5555-0004', 'espanol');

INSERT INTO expedientes (id, paciente_id, numero_ficha) VALUES
  ('40000000-0000-0000-0000-000000000639', '20000000-0000-0000-0000-000000000639', 'F-637-C'),
  ('40000000-0000-0000-0000-000000000640', '20000000-0000-0000-0000-000000000640', 'F-637-D');

INSERT INTO jornadas (id, nombre, fecha, comunidad_id, responsable_id, estado) VALUES
  ('30000000-0000-0000-0000-000000000639', 'Jornada absorbido 639 (empieza en curso)',
   (NOW() AT TIME ZONE 'America/Guatemala')::date,
   '10000000-0000-0000-0000-000000000637', '00000000-0000-0000-0000-000000000637', 'en curso');

INSERT INTO atenciones (id, paciente_id, jornada_id) VALUES
  ('50000000-0000-0000-0000-000000000639', '20000000-0000-0000-0000-000000000640',
   '30000000-0000-0000-0000-000000000639');

-- La jornada ya termino para cuando alguien intenta fusionar: esto es lo normal, no un caso raro.
UPDATE jornadas SET estado = 'finalizada' WHERE id = '30000000-0000-0000-0000-000000000639';

-- ============================================================================
-- Grupo 3: un absorbido SIN expediente (defensivo -- no alcanzable hoy por la app, ver 00119)
-- para probar el ELSE que agrega la 00119.
-- ============================================================================
INSERT INTO pacientes (id, nombres, apellidos, fecha_nacimiento, sexo, comunidad_id, telefono_contacto, idioma) VALUES
  ('20000000-0000-0000-0000-000000000641', 'Sobreviviente', 'Grupo3', '1975-03-03', 'F',
   '10000000-0000-0000-0000-000000000637', '5555-0005', 'espanol'),
  ('20000000-0000-0000-0000-000000000642', 'Absorbido', 'Grupo3', '1975-03-03', 'F',
   '10000000-0000-0000-0000-000000000637', '5555-0006', 'espanol');

INSERT INTO expedientes (id, paciente_id, numero_ficha) VALUES
  ('40000000-0000-0000-0000-000000000641', '20000000-0000-0000-0000-000000000641', 'F-637-E');
-- '...642' (el absorbido del grupo 3) no tiene expediente a proposito.

-- ============================================================================
-- Sesion: de aca en adelante se actua como el administrador, que es quien puede fusionar.
-- ============================================================================
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000637';

-- ----------------------------------------------------------------------------
-- Grupo 1: la fusion en si tiene que completarse sin error.
-- ----------------------------------------------------------------------------
SELECT lives_ok(
  $$ SELECT fn_fusionar_pacientes('20000000-0000-0000-0000-000000000637', '20000000-0000-0000-0000-000000000638') $$,
  'fn_fusionar_pacientes completa sin error cuando las dos jornadas estan en curso (criterio 2)'
);

SELECT is(
  (SELECT paciente_id FROM atenciones WHERE id = '50000000-0000-0000-0000-000000000638'),
  '20000000-0000-0000-0000-000000000637'::uuid,
  'la atencion del absorbido queda bajo el sobreviviente'
);

SELECT is(
  (SELECT paciente_id FROM atenciones WHERE id = '50000000-0000-0000-0000-000000000637'),
  '20000000-0000-0000-0000-000000000637'::uuid,
  'la atencion que ya era del sobreviviente sigue siendo suya (no se pierde ni se duplica)'
);

SELECT is(
  (SELECT paciente_id FROM padecimientos_cronicos WHERE id = '80000000-0000-0000-0000-000000000638'),
  '20000000-0000-0000-0000-000000000637'::uuid,
  'la condicion cronica del absorbido (Hipertension) queda bajo el sobreviviente'
);

SELECT is(
  (SELECT expediente_id FROM consultas WHERE id = '60000000-0000-0000-0000-000000000638'),
  '40000000-0000-0000-0000-000000000637'::uuid,
  'la consulta del absorbido se reasigna al expediente del sobreviviente'
);

SELECT is(
  (SELECT count(*)::int
     FROM recetas r
     JOIN consultas c ON c.id = r.consulta_id
    WHERE c.expediente_id = '40000000-0000-0000-0000-000000000637'),
  2,
  'las dos recetas (propia y la del absorbido) quedan alcanzables desde el expediente sobreviviente, via su consulta'
);

SELECT is(
  (SELECT fecha_baja FROM pacientes WHERE id = '20000000-0000-0000-0000-000000000638'),
  CURRENT_DATE,
  'el absorbido queda dado de baja el mismo dia de la fusion'
);

SELECT ok(
  (SELECT fecha_baja FROM pacientes WHERE id = '20000000-0000-0000-0000-000000000637') IS NULL,
  'el sobreviviente no queda dado de baja'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM fusiones_pacientes
     WHERE paciente_absorbido_id = '20000000-0000-0000-0000-000000000638'
       AND paciente_sobreviviente_id = '20000000-0000-0000-0000-000000000637'
       AND realizada_por = '00000000-0000-0000-0000-000000000637'
       AND realizada_en IS NOT NULL
  ),
  'fusiones_pacientes registra el par, quien la hizo y cuando (criterio 4, consultable despues para el criterio 6)'
);

-- ----------------------------------------------------------------------------
-- Grupo 2 (defecto encontrado, fuera de alcance de #637: ver el comentario de cabecera).
-- ----------------------------------------------------------------------------
SELECT throws_ok(
  $$ SELECT fn_fusionar_pacientes('20000000-0000-0000-0000-000000000639', '20000000-0000-0000-0000-000000000640') $$,
  'No se puede registrar la atencion: la jornada asociada no esta en curso (estado actual: finalizada).',
  'HOY fn_fusionar_pacientes falla si la atencion del absorbido esta en una jornada ya finalizada -- el caso normal, no uno raro. Defecto de 00055/00101, documentado en PLAN.md, no corregido en #637.'
);

-- ----------------------------------------------------------------------------
-- Grupo 3: el ELSE nuevo de la 00119.
-- ----------------------------------------------------------------------------
SELECT throws_ok(
  $$ SELECT fn_fusionar_pacientes('20000000-0000-0000-0000-000000000641', '20000000-0000-0000-0000-000000000642') $$,
  'No se puede fusionar con seguridad: uno de los dos pacientes no tiene expediente.',
  'la 00119 aborta la fusion si a alguno de los dos les falta el expediente, en vez de saltarse las consultas en silencio'
);

SELECT * FROM finish();

ROLLBACK;
