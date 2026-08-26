-- Pruebas del trigger que exige jornada en curso para registrar una atencion
-- (issue #172, RF-24, migracion 00055).
-- Corre con: supabase test db
--
-- Estas pruebas NO simulan roles ni tocan RLS: el setup corre como el rol dueno de las tablas,
-- que esta exento de politicas. Es a proposito. Lo que se comprueba aqui es el trigger, y un
-- trigger corre igual para todos: si dependiera del rol seria una politica, no un trigger. Las
-- politicas de atenciones ya se prueban en politicas_rls_atenciones_consultas_recetas.sql.
--
-- Se recorren los cuatro estados de estado_jornada (00001) y no los tres que menciona el
-- criterio de aceptacion: cancelada tambien tiene que bloquear.
--
-- Ningun dato real: la comunidad, la jornada y el paciente son inventados.

BEGIN;

SELECT plan(7);

-- ============================================================================
-- Setup: una comunidad, un paciente y cuatro jornadas, una por estado.
-- ============================================================================
INSERT INTO comunidades (id, municipio_id, nombre) VALUES
  ('10000000-0000-0000-0000-000000000172', 101, 'Comunidad de prueba 172');

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000000172', 'responsable172@test.ecopac.local');

INSERT INTO pacientes (id, nombres, apellidos, fecha_nacimiento, sexo, comunidad_id, telefono_contacto, idioma)
VALUES (
  '20000000-0000-0000-0000-000000000172',
  'Paciente', 'Prueba172', '1990-01-01', 'F',
  '10000000-0000-0000-0000-000000000172', '5555-0172', 'espanol'
);

INSERT INTO expedientes (id, paciente_id, numero_ficha)
VALUES (
  '40000000-0000-0000-0000-000000000172',
  '20000000-0000-0000-0000-000000000172',
  'F-0172'
);

-- Las jornadas se crean y despues se les fija el estado con UPDATE: la 00051 valida las
-- transiciones con un trigger, y este INSERT directo con el estado final lo esquiva igual que
-- lo hacen las suites vecinas.
INSERT INTO jornadas (id, nombre, fecha, comunidad_id, responsable_id, estado) VALUES
  ('30000000-0000-0000-0000-000000000172', 'Jornada planificada 172',
   (NOW() AT TIME ZONE 'America/Guatemala')::date,
   '10000000-0000-0000-0000-000000000172', '00000000-0000-0000-0000-000000000172', 'planificada'),
  ('30000000-0000-0000-0000-000000000173', 'Jornada en curso 172',
   (NOW() AT TIME ZONE 'America/Guatemala')::date,
   '10000000-0000-0000-0000-000000000172', '00000000-0000-0000-0000-000000000172', 'en curso'),
  ('30000000-0000-0000-0000-000000000174', 'Jornada finalizada 172',
   (NOW() AT TIME ZONE 'America/Guatemala')::date,
   '10000000-0000-0000-0000-000000000172', '00000000-0000-0000-0000-000000000172', 'finalizada'),
  ('30000000-0000-0000-0000-000000000175', 'Jornada cancelada 172',
   (NOW() AT TIME ZONE 'America/Guatemala')::date,
   '10000000-0000-0000-0000-000000000172', '00000000-0000-0000-0000-000000000172', 'cancelada');

-- ============================================================================
-- 1. El unico estado que deja registrar es "en curso"
-- ============================================================================
SELECT lives_ok(
  $$ INSERT INTO atenciones (id, paciente_id, jornada_id)
     VALUES ('50000000-0000-0000-0000-000000000173',
             '20000000-0000-0000-0000-000000000172',
             '30000000-0000-0000-0000-000000000173') $$,
  'una jornada en curso si admite registrar la atencion'
);

-- ============================================================================
-- 2. Los otros tres estados la rechazan
-- ============================================================================
SELECT throws_ok(
  $$ INSERT INTO atenciones (paciente_id, jornada_id)
     VALUES ('20000000-0000-0000-0000-000000000172',
             '30000000-0000-0000-0000-000000000172') $$,
  'No se puede registrar la atencion: la jornada asociada no esta en curso (estado actual: planificada).',
  'una jornada planificada rechaza la atencion, y el mensaje dice en que estado esta'
);

SELECT throws_ok(
  $$ INSERT INTO atenciones (paciente_id, jornada_id)
     VALUES ('20000000-0000-0000-0000-000000000172',
             '30000000-0000-0000-0000-000000000174') $$,
  'No se puede registrar la atencion: la jornada asociada no esta en curso (estado actual: finalizada).',
  'una jornada finalizada rechaza la atencion'
);

SELECT throws_ok(
  $$ INSERT INTO atenciones (paciente_id, jornada_id)
     VALUES ('20000000-0000-0000-0000-000000000172',
             '30000000-0000-0000-0000-000000000175') $$,
  'No se puede registrar la atencion: la jornada asociada no esta en curso (estado actual: cancelada).',
  'una jornada cancelada rechaza la atencion'
);

-- ============================================================================
-- 3. El UPDATE tambien esta cubierto, no solo el INSERT
-- ============================================================================
-- Mover una atencion ya creada a una jornada que no esta en curso es la misma operacion
-- prohibida que crearla ahi; por eso el trigger es BEFORE INSERT OR UPDATE.
SELECT throws_ok(
  $$ UPDATE atenciones
     SET jornada_id = '30000000-0000-0000-0000-000000000174'
     WHERE id = '50000000-0000-0000-0000-000000000173' $$,
  'No se puede registrar la atencion: la jornada asociada no esta en curso (estado actual: finalizada).',
  'no se puede mover una atencion a una jornada finalizada con UPDATE'
);

-- ============================================================================
-- 4. El mensaje distingue atenciones de consultas
-- ============================================================================
-- Es el motivo por el que la 00055 escribe una funcion propia en vez de colgar el trigger de
-- consultas: validar_jornada_en_curso() dice "No se puede registrar la consulta", y eso manda
-- a buscar el problema en la tabla equivocada.
SELECT throws_ok(
  $$ INSERT INTO consultas (expediente_id, atencion_id, medico_id, jornada_id, motivo_consulta)
     VALUES ('40000000-0000-0000-0000-000000000172',
             '50000000-0000-0000-0000-000000000173',
             '00000000-0000-0000-0000-000000000172',
             '30000000-0000-0000-0000-000000000174',
             'motivo de prueba') $$,
  'No se puede registrar la consulta: La jornada asociada no esta en curso (Estado actual: finalizada).',
  'el mensaje de consultas (00018) sigue nombrando la consulta, no la atencion'
);

-- ============================================================================
-- 5. La regla no depende del cliente
-- ============================================================================
-- Criterio de aceptacion 4: el trigger existe y esta colgado de atenciones, asi que corre
-- aunque la peticion no venga de la aplicacion.
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE c.relname = 'atenciones'
      AND t.tgname = 'trg_validar_jornada_en_curso_atenciones'
      AND NOT t.tgisinternal
  ),
  'el trigger esta colgado de atenciones y no depende de que el cliente lo respete'
);

SELECT * FROM finish();
ROLLBACK;
