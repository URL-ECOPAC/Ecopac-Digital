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

SELECT plan(8);

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
  ('20000000-0000-0000-0000-000000000117', 'Uno',  'Inventado', '1990-01-01', 'F', '10000000-0000-0000-0000-000000000117', '00000117', 'espanol'),
  ('20000000-0000-0000-0000-000000000118', 'Dos',  'Inventado', '1990-01-01', 'M', '10000000-0000-0000-0000-000000000117', '00000118', 'espanol'),
  ('20000000-0000-0000-0000-000000000119', 'Tres', 'Inventado', '1990-01-01', 'F', '10000000-0000-0000-0000-000000000117', '00000119', 'espanol');

INSERT INTO atenciones (id, paciente_id, jornada_id) VALUES
  ('50000000-0000-0000-0000-000000000117', '20000000-0000-0000-0000-000000000117', '30000000-0000-0000-0000-000000000117'),
  ('50000000-0000-0000-0000-000000000118', '20000000-0000-0000-0000-000000000118', '30000000-0000-0000-0000-000000000117'),
  ('50000000-0000-0000-0000-000000000119', '20000000-0000-0000-0000-000000000119', '30000000-0000-0000-0000-000000000117');

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
-- 6. Los tres signos obligatorios siguen siendolo
-- ============================================================================
-- Fija el reparto que CAMPOS_TRIAJE replica: presion y frecuencia cardiaca no son opcionales.
SELECT is(
  (SELECT count(*)::int FROM information_schema.columns
   WHERE table_name = 'triajes'
     AND column_name IN ('presion_sistolica', 'presion_diastolica', 'frecuencia_cardiaca')
     AND is_nullable = 'NO'),
  3,
  'presion sistolica, diastolica y frecuencia cardiaca son NOT NULL'
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
