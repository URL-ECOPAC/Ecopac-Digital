-- Pruebas de la 00153: una donacion puede ser para una jornada, y su proyecto sale de la jornada.
-- Corre con: supabase test db
--
-- Ningun dato real.

BEGIN;

SELECT plan(5);

-- Desde la 00178 toda jornada nueva lleva una bodega movil. Estas pruebas no tratan de bodegas:
-- sus jornadas reciben una de prueba como DEFAULT de la columna, que el ROLLBACK del final deshace.
INSERT INTO bodegas (id, nombre, es_movil) VALUES
  ('5b000000-0000-0000-0000-000000000178', 'Bodega movil de prueba 00178', TRUE);
ALTER TABLE jornadas ALTER COLUMN botiquin_bodega_id SET DEFAULT '5b000000-0000-0000-0000-000000000178';

INSERT INTO comunidades (id, municipio_id, nombre) VALUES
  ('10000000-0000-0000-0000-000000001531', 101, 'Comunidad de prueba 1531');

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000015311', 'admin1531@test.ecopac.local');

ALTER TABLE perfiles DISABLE TRIGGER USER;
UPDATE perfiles SET rol = 'administrador' WHERE id = '00000000-0000-0000-0000-000000015311';
ALTER TABLE perfiles ENABLE TRIGGER USER;

INSERT INTO proyectos (id, nombre) VALUES
  ('50000000-0000-0000-0000-000000001531', 'Proyecto 1531'),
  ('50000000-0000-0000-0000-000000001532', 'Otro proyecto 1531');

-- La jornada sin proyecto es una anterior a la 00169, que desde entonces ya no se puede crear:
-- se salta el trigger para tenerla, porque lo que se prueba es como se trata a esas jornadas.
ALTER TABLE jornadas DISABLE TRIGGER trg_jornadas_proyecto_obligatorio_al_crear;
INSERT INTO jornadas (id, nombre, fecha, comunidad_id, responsable_id, proyecto_id) VALUES
  ('40000000-0000-0000-0000-000000001531', 'Jornada 1531', CURRENT_DATE + 30,
   '10000000-0000-0000-0000-000000001531', '00000000-0000-0000-0000-000000015311',
   '50000000-0000-0000-0000-000000001531'),
  ('40000000-0000-0000-0000-000000001532', 'Jornada sin proyecto 1531', CURRENT_DATE + 31,
   '10000000-0000-0000-0000-000000001531', '00000000-0000-0000-0000-000000015311', NULL);
ALTER TABLE jornadas ENABLE TRIGGER trg_jornadas_proyecto_obligatorio_al_crear;

INSERT INTO donantes (id, nombre, tipo) VALUES
  ('d0000000-0000-0000-0000-000000015311', 'Donante 1531', 'organizacion');

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000015311';

SELECT lives_ok(
  $$ SELECT fn_registrar_donacion(
       'd0000000-0000-0000-0000-000000015311', 'dinero', CURRENT_DATE,
       '[{"descripcion": "Aporte 1531", "monto": 500}]'::jsonb,
       '50000000-0000-0000-0000-000000001532', 'Para la jornada',
       '40000000-0000-0000-0000-000000001531') $$,
  'se registra una donacion para una jornada'
);

SELECT is(
  (SELECT row(jornada_id, proyecto_id)::text FROM donaciones WHERE observaciones = 'Para la jornada'),
  row('40000000-0000-0000-0000-000000001531'::uuid, '50000000-0000-0000-0000-000000001531'::uuid)::text,
  'el proyecto es el de la jornada, aunque se haya mandado otro'
);

SELECT lives_ok(
  $$ SELECT fn_registrar_donacion(
       'd0000000-0000-0000-0000-000000015311', 'dinero', CURRENT_DATE,
       '[{"descripcion": "Aporte 1531 b", "monto": 100}]'::jsonb,
       '50000000-0000-0000-0000-000000001532', 'Jornada sin proyecto',
       '40000000-0000-0000-0000-000000001532') $$,
  'una donacion para una jornada sin proyecto tambien se registra'
);

SELECT is(
  (SELECT proyecto_id FROM donaciones WHERE observaciones = 'Jornada sin proyecto'),
  NULL::uuid,
  'y queda sin proyecto: el de la jornada, que no tiene'
);

SELECT lives_ok(
  $$ SELECT fn_registrar_donacion(
       'd0000000-0000-0000-0000-000000015311', 'dinero', CURRENT_DATE,
       '[{"descripcion": "Aporte 1531 c", "monto": 50}]'::jsonb,
       '50000000-0000-0000-0000-000000001532', 'Solo proyecto') $$,
  'sin jornada se sigue registrando con el proyecto elegido, como antes'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
