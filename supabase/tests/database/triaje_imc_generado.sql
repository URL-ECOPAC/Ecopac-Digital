-- Pruebas del IMC generado y de los signos parciales del triaje (issue #117, RF-07).
-- Corre con: supabase test db
--
-- Estas pruebas no simulan roles: lo que verifican es la columna generada de la 00013, que se
-- comporta igual para todos. Las politicas de triajes se prueban en
-- politicas_rls_atenciones_consultas_recetas.sql.
--
-- POR QUE EXISTEN, SI LA 00013 NO ES DE ESTA ISSUE
--
-- El criterio de aceptacion 4 dice que el IMC se lee de la base y no se recalcula en el cliente.
-- packages/shared/pacientes/triaje.api.js depende de eso: nunca envia `imc` y lo pide de vuelta.
-- Si una migracion futura cambiara la formula o quitara la columna generada, el cliente empezaria
-- a mostrar un IMC equivocado sin que nada fallara. Esto lo fija.
--
-- Ningun dato real: la comunidad, la jornada y los pacientes son inventados.

BEGIN;

SELECT plan(12);

-- ============================================================================
-- Setup: una jornada en curso -- la exige el trigger de la 00055 -- y tres pacientes.
-- ============================================================================
INSERT INTO comunidades (id, municipio_id, nombre) VALUES
  ('10000000-0000-0000-0000-000000000117', 101, 'Comunidad de prueba 117');

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000000117', 'medico117@test.ecopac.local');

ALTER TABLE perfiles DISABLE TRIGGER USER;
UPDATE perfiles SET rol = 'medico' WHERE id = '00000000-0000-0000-0000-000000000117';
ALTER TABLE perfiles ENABLE TRIGGER USER;

INSERT INTO jornadas (id, nombre, fecha, comunidad_id, responsable_id, estado) VALUES
  ('30000000-0000-0000-0000-000000000117', 'Jornada de prueba 117',
   (NOW() AT TIME ZONE 'America/Guatemala')::date,
   '10000000-0000-0000-0000-000000000117', '00000000-0000-0000-0000-000000000117', 'en curso');

INSERT INTO pacientes (id, nombres, apellidos, fecha_nacimiento, sexo, comunidad_id, telefono_contacto, idioma) VALUES
  ('20000000-0000-0000-0000-000000000117', 'Uno',  'Inventado', '1990-01-01', 'Femenino', '10000000-0000-0000-0000-000000000117', '00000117', 'espanol'),
  ('20000000-0000-0000-0000-000000000118', 'Dos',  'Inventado', '1990-01-01', 'Masculino', '10000000-0000-0000-0000-000000000117', '00000118', 'espanol'),
  ('20000000-0000-0000-0000-000000000119', 'Tres', 'Inventado', '1990-01-01', 'Femenino', '10000000-0000-0000-0000-000000000117', '00000119', 'espanol'),
  -- Dos mas para los casos del IMC imposible (issue #699): atenciones es UNIQUE por paciente y
  -- jornada, y triajes lo es por atencion, asi que cada caso nuevo necesita su propio paciente.
  ('20000000-0000-0000-0000-000000000120', 'Cuatro', 'Inventado', '1990-01-01', 'Masculino', '10000000-0000-0000-0000-000000000117', '00000120', 'espanol'),
  ('20000000-0000-0000-0000-000000000121', 'Cinco', 'Inventado', '2026-01-01', 'Femenino', '10000000-0000-0000-0000-000000000117', '00000121', 'espanol');

INSERT INTO atenciones (id, paciente_id, jornada_id) VALUES
  ('50000000-0000-0000-0000-000000000117', '20000000-0000-0000-0000-000000000117', '30000000-0000-0000-0000-000000000117'),
  ('50000000-0000-0000-0000-000000000118', '20000000-0000-0000-0000-000000000118', '30000000-0000-0000-0000-000000000117'),
  ('50000000-0000-0000-0000-000000000119', '20000000-0000-0000-0000-000000000119', '30000000-0000-0000-0000-000000000117'),
  ('50000000-0000-0000-0000-000000000120', '20000000-0000-0000-0000-000000000120', '30000000-0000-0000-0000-000000000117'),
  ('50000000-0000-0000-0000-000000000121', '20000000-0000-0000-0000-000000000121', '30000000-0000-0000-0000-000000000117');

-- ============================================================================
-- 1. El IMC se calcula solo, con la talla en CENTIMETROS
-- ============================================================================
-- 70 kg y 170 cm -> 70 / 1.70^2 = 24.22 -> 24.2 redondeado a un decimal.
-- Si la talla se interpretara en metros, el resultado seria absurdo y esta prueba lo cazaria.
INSERT INTO triajes (atencion_id, presion_sistolica, presion_diastolica, frecuencia_cardiaca,
                     peso, talla, tomado_por)
VALUES ('50000000-0000-0000-0000-000000000117', 120, 80, 70, 70.0, 170.0,
        '00000000-0000-0000-0000-000000000117');

SELECT is(
  (SELECT imc FROM triajes WHERE atencion_id = '50000000-0000-0000-0000-000000000117'),
  24.2::NUMERIC(4,1),
  '70 kg y 170 cm dan un IMC de 24.2: la talla se interpreta en centimetros'
);

-- ============================================================================
-- 2. Signos parciales: sin peso ni talla el IMC queda NULL, no en cero ni en error
-- ============================================================================
-- Es el criterio de aceptacion 2. En algunas comunidades no hay bascula.
INSERT INTO triajes (atencion_id, presion_sistolica, presion_diastolica, frecuencia_cardiaca,
                     tomado_por)
VALUES ('50000000-0000-0000-0000-000000000118', 118, 78, 68,
        '00000000-0000-0000-0000-000000000117');

SELECT is(
  (SELECT imc FROM triajes WHERE atencion_id = '50000000-0000-0000-0000-000000000118'),
  NULL::NUMERIC(4,1),
  'sin peso ni talla el IMC es NULL: un triaje parcial se guarda igual'
);

SELECT is(
  (SELECT glucosa FROM triajes WHERE atencion_id = '50000000-0000-0000-0000-000000000118'),
  NULL::SMALLINT,
  'glucosa opcional: en algunas comunidades no hay glucometro'
);

-- ============================================================================
-- 3. Con solo uno de los dos, el IMC tampoco se inventa
-- ============================================================================
INSERT INTO triajes (atencion_id, presion_sistolica, presion_diastolica, frecuencia_cardiaca,
                     peso, tomado_por)
VALUES ('50000000-0000-0000-0000-000000000119', 130, 85, 75, 68.0,
        '00000000-0000-0000-0000-000000000117');

SELECT is(
  (SELECT imc FROM triajes WHERE atencion_id = '50000000-0000-0000-0000-000000000119'),
  NULL::NUMERIC(4,1),
  'con peso pero sin talla el IMC queda NULL'
);

-- ============================================================================
-- 4. El IMC no se puede escribir: por eso la API nunca lo envia
-- ============================================================================
SELECT throws_ok(
  $$ UPDATE triajes SET imc = 99.9
     WHERE atencion_id = '50000000-0000-0000-0000-000000000117' $$,
  '428C9',
  NULL,
  'la columna imc es generada y Postgres rechaza escribirla'
);

-- ============================================================================
-- 5. Y se recalcula solo al corregir el peso
-- ============================================================================
-- Es lo que hace que actualizarTriaje() no tenga que tocar el IMC.
UPDATE triajes SET peso = 80.0
WHERE atencion_id = '50000000-0000-0000-0000-000000000117';

SELECT is(
  (SELECT imc FROM triajes WHERE atencion_id = '50000000-0000-0000-0000-000000000117'),
  27.7::NUMERIC(4,1),
  'corregir el peso recalcula el IMC sin que el cliente lo toque'
);

-- ============================================================================
-- 6. Una combinacion imposible se rechaza, y ya no revienta la columna (issue #699)
-- ============================================================================
--
-- Peso y talla pasan sus propios CHECK por separado -- peso entre 1 y 400, talla entre 30 y 250 --
-- y su combinacion sigue siendo imposible: 400 kg con 30 cm da un IMC de 4444.4.
--
-- Hasta la 00133 la columna era NUMERIC(4,1), el valor no cabia y el INSERT moria con
-- `numeric field overflow` (22003): un error crudo de Postgres, que no nombra ninguna columna,
-- delante de quien esta atendiendo. Ahora cabe y lo rechaza chk_triajes_imc_rango con un 23514,
-- que si tiene nombre y el cliente puede traducir.
--
-- El espejo en el cliente es validarTriaje() (packages/shared/pacientes/triaje.validaciones.js),
-- que lo dice antes de salir; esto es la red de abajo, la que protege aunque nadie pase por ahi.
SELECT throws_ok(
  $$ INSERT INTO triajes (atencion_id, presion_sistolica, presion_diastolica, frecuencia_cardiaca,
                          peso, talla, tomado_por)
     VALUES ('50000000-0000-0000-0000-000000000118', 120, 80, 70, 400.0, 30.0,
             '00000000-0000-0000-0000-000000000117') $$,
  '23514',
  NULL,
  '400 kg con 30 cm se rechazan por el CHECK del IMC, no por un desborde numerico'
);

-- LO QUE ESTA MIGRACION NO PUEDE ARREGLAR, Y CONVIENE TENER ESCRITO
--
-- Una columna generada se calcula ANTES de comprobar los CHECK de la tabla. Con una talla fuera
-- de su propio rango -- 1.62, la talla tecleada en metros -- el IMC sale de 266.700 y desborda
-- incluso NUMERIC(6,1), asi que ese caso sigue muriendo con 22003 y no con el CHECK. Ampliar mas
-- la columna no lo resuelve: siempre hay una talla mas chica.
--
-- No es el defecto de la issue -- ese es la combinacion de valores ADMISIBLES, que ya no revienta --
-- y en la aplicacion nadie lo ve: validarTriaje() rechaza una talla menor de 30 cm antes de salir.
-- Queda fijado aqui para que el dia que alguien lo vea sepa que es conocido.
SELECT throws_ok(
  $$ INSERT INTO triajes (atencion_id, presion_sistolica, presion_diastolica, frecuencia_cardiaca,
                          peso, talla, tomado_por)
     VALUES ('50000000-0000-0000-0000-000000000118', 120, 80, 70, 70.0, 1.62,
             '00000000-0000-0000-0000-000000000117') $$,
  '22003',
  NULL,
  'una talla fuera de rango desborda antes de llegar al CHECK: la para el cliente, no la base'
);

-- El caso que describe la issue: la talla de un lactante con el peso de un adulto. Los dos valores
-- son admisibles por separado -- 52 cm pasa el CHECK de talla, 70 kg el de peso -- y su IMC es
-- 258.9. Antes cabia en NUMERIC(4,1)? No: por eso reventaba. Ahora cabe, y lo rechaza el CHECK.
SELECT throws_ok(
  $$ INSERT INTO triajes (atencion_id, presion_sistolica, presion_diastolica, frecuencia_cardiaca,
                          peso, talla, tomado_por)
     VALUES ('50000000-0000-0000-0000-000000000120', 120, 80, 70, 70.0, 52.0,
             '00000000-0000-0000-0000-000000000117') $$,
  '23514',
  NULL,
  'el peso de un adulto con la talla de un lactante se rechaza con un error con nombre'
);

-- Y el rango sigue admitiendo lo que de verdad pasa en jornada: un lactante de 4 kg y 52 cm da
-- un IMC de 14.8, bajo pero real.
SELECT lives_ok(
  $$ INSERT INTO triajes (atencion_id, presion_sistolica, presion_diastolica, frecuencia_cardiaca,
                          peso, talla, tomado_por)
     VALUES ('50000000-0000-0000-0000-000000000121', 110, 70, 120, 4.0, 52.0,
             '00000000-0000-0000-0000-000000000117') $$,
  'un lactante de 4 kg y 52 cm entra: el rango no aprieta sobre datos reales'
);

-- ============================================================================
-- 7. Ningun signo es obligatorio (00135, issue #840)
-- ============================================================================
-- Hasta la 00135 presion y frecuencia cardiaca eran NOT NULL; en jornada muchas veces no hay
-- tensiometro. Lo que la base exige ahora es al menos un signo y la presion completa, y eso lo
-- prueban chk_triajes_al_menos_un_signo y chk_triajes_presion_completa.
SELECT is(
  (SELECT count(*)::int FROM information_schema.columns
   WHERE table_name = 'triajes'
     AND column_name IN ('presion_sistolica', 'presion_diastolica', 'frecuencia_cardiaca')
     AND is_nullable = 'YES'),
  3,
  'presion sistolica, diastolica y frecuencia cardiaca son opcionales desde la 00135'
);

SELECT is(
  (SELECT count(*)::int FROM information_schema.columns
   WHERE table_name = 'triajes'
     AND column_name IN ('glucosa', 'peso', 'talla', 'temperatura')
     AND is_nullable = 'YES'),
  4,
  'glucosa, peso, talla y temperatura si admiten NULL'
);

SELECT * FROM finish();
ROLLBACK;
