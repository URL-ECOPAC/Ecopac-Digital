-- Pruebas de la migracion 00136 (issue #840, reglas B2 y G2, bloque F).
-- Corre con: supabase test db
--
-- Ningun signo vital es obligatorio, pero un triaje registra al menos uno y la presion va
-- completa. Y la cola de la jornada ya no deja en "espera triaje" a quien tuvo consulta sin signos.
--
-- Ningun dato real: comunidad, jornada y pacientes son inventados.

BEGIN;

SELECT plan(7);

INSERT INTO comunidades (id, municipio_id, nombre) VALUES
  ('10000000-0000-0000-0000-000000000135', 101, 'Comunidad de prueba 135');

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000000135', 'medico135@test.ecopac.local');

ALTER TABLE perfiles DISABLE TRIGGER USER;
-- Administrador: la vista de la cola solo muestra filas a la administracion o al personal de la
-- jornada (00060), y las dos ultimas pruebas la leen con su sesion.
UPDATE perfiles SET rol = 'administrador' WHERE id = '00000000-0000-0000-0000-000000000135';
ALTER TABLE perfiles ENABLE TRIGGER USER;

INSERT INTO jornadas (id, nombre, fecha, comunidad_id, responsable_id, estado) VALUES
  ('30000000-0000-0000-0000-000000000135', 'Jornada de prueba 135',
   (NOW() AT TIME ZONE 'America/Guatemala')::date,
   '10000000-0000-0000-0000-000000000135', '00000000-0000-0000-0000-000000000135', 'en curso');

INSERT INTO pacientes (id, nombres, apellidos, fecha_nacimiento, sexo, comunidad_id, idioma) VALUES
  ('20000000-0000-0000-0000-000000001351', 'Uno', 'Inventado', '1990-01-01', 'Femenino', '10000000-0000-0000-0000-000000000135', 'espanol'),
  ('20000000-0000-0000-0000-000000001352', 'Dos', 'Inventado', '1990-01-01', 'Masculino', '10000000-0000-0000-0000-000000000135', 'espanol'),
  ('20000000-0000-0000-0000-000000001353', 'Tres', 'Inventado', '1990-01-01', 'Femenino', '10000000-0000-0000-0000-000000000135', 'espanol');

INSERT INTO expedientes (id, paciente_id, numero_ficha) VALUES
  ('40000000-0000-0000-0000-000000001353', '20000000-0000-0000-0000-000000001353', 'F-0135-3');

INSERT INTO atenciones (id, paciente_id, jornada_id) VALUES
  ('50000000-0000-0000-0000-000000001351', '20000000-0000-0000-0000-000000001351', '30000000-0000-0000-0000-000000000135'),
  ('50000000-0000-0000-0000-000000001352', '20000000-0000-0000-0000-000000001352', '30000000-0000-0000-0000-000000000135'),
  ('50000000-0000-0000-0000-000000001353', '20000000-0000-0000-0000-000000001353', '30000000-0000-0000-0000-000000000135');

-- ============================================================================
-- Signos opcionales
-- ============================================================================
SELECT lives_ok(
  $$ INSERT INTO triajes (atencion_id, temperatura, tomado_por)
     VALUES ('50000000-0000-0000-0000-000000001351', 37.2, '00000000-0000-0000-0000-000000000135') $$,
  'un triaje con solo la temperatura, sin tensiometro, se registra'
);

SELECT throws_ok(
  $$ INSERT INTO triajes (atencion_id, tomado_por)
     VALUES ('50000000-0000-0000-0000-000000001352', '00000000-0000-0000-0000-000000000135') $$,
  '23514',
  NULL,
  'un triaje sin ningun signo no se registra'
);

SELECT throws_ok(
  $$ INSERT INTO triajes (atencion_id, presion_sistolica, tomado_por)
     VALUES ('50000000-0000-0000-0000-000000001352', 120, '00000000-0000-0000-0000-000000000135') $$,
  '23514',
  NULL,
  'una sistolica sin diastolica se rechaza: la presion va completa'
);

SELECT throws_ok(
  $$ UPDATE triajes SET temperatura = NULL
     WHERE atencion_id = '50000000-0000-0000-0000-000000001351' $$,
  '23514',
  NULL,
  'no se puede vaciar el unico signo de un triaje'
);

SELECT lives_ok(
  $$ UPDATE triajes SET presion_sistolica = 120, presion_diastolica = 80
     WHERE atencion_id = '50000000-0000-0000-0000-000000001351' $$,
  'agregar la presion completa a un triaje existente funciona'
);

-- ============================================================================
-- La cola, con signos opcionales
-- ============================================================================
INSERT INTO consultas (id, expediente_id, atencion_id, medico_id, jornada_id, motivo_consulta)
VALUES ('60000000-0000-0000-0000-000000001353', '40000000-0000-0000-0000-000000001353',
        '50000000-0000-0000-0000-000000001353', '00000000-0000-0000-0000-000000000135',
        '30000000-0000-0000-0000-000000000135', 'Consulta sin signos');

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000135';

SELECT is(
  (SELECT etapa FROM vista_cola_jornada WHERE atencion_id = '50000000-0000-0000-0000-000000001353'),
  'lista para cerrar',
  'una consulta sin triaje ya no deja al paciente en espera triaje'
);

SELECT is(
  (SELECT etapa FROM vista_cola_jornada WHERE atencion_id = '50000000-0000-0000-0000-000000001352'),
  'espera triaje',
  'sin nada registrado sigue en la primera etapa'
);

SELECT * FROM finish();
ROLLBACK;
