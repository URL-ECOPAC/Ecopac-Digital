-- Pruebas de la 00187: una donacion de dinero recibida para una jornada entra sola a su
-- presupuesto, como un aporte de origen "donacion".
-- Corre con: supabase test db
--
-- Ningun dato real.

BEGIN;

SELECT plan(13);

-- Desde la 00178 toda jornada nueva lleva una bodega movil. Estas pruebas no tratan de bodegas:
-- sus jornadas reciben una de prueba como DEFAULT de la columna, que el ROLLBACK del final deshace.
INSERT INTO bodegas (id, nombre, es_movil) VALUES
  ('5b000000-0000-0000-0000-000000001870', 'Bodega movil de prueba 00187', TRUE);
ALTER TABLE jornadas ALTER COLUMN botiquin_bodega_id SET DEFAULT '5b000000-0000-0000-0000-000000001870';

INSERT INTO comunidades (id, municipio_id, nombre) VALUES
  ('10000000-0000-0000-0000-000000001870', 101, 'Comunidad de prueba 1870');

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000018701', 'admin1870@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000018702', 'medico1870@test.ecopac.local');

ALTER TABLE perfiles DISABLE TRIGGER USER;
UPDATE perfiles SET rol = 'administrador' WHERE id = '00000000-0000-0000-0000-000000018701';
UPDATE perfiles SET rol = 'medico' WHERE id = '00000000-0000-0000-0000-000000018702';
ALTER TABLE perfiles ENABLE TRIGGER USER;

-- El medico registra donaciones por delegacion, pero no gestiona jornadas.
INSERT INTO usuario_permiso (perfil_id, permiso_id, concedido, otorgado_por)
SELECT '00000000-0000-0000-0000-000000018702', id, TRUE, '00000000-0000-0000-0000-000000018701'
FROM permisos WHERE clave = 'donaciones.registrar';

INSERT INTO proyectos (id, nombre) VALUES
  ('50000000-0000-0000-0000-000000001870', 'Proyecto 1870');

INSERT INTO jornadas (id, nombre, fecha, comunidad_id, responsable_id, proyecto_id) VALUES
  ('40000000-0000-0000-0000-000000001871', 'Jornada 1871', CURRENT_DATE + 30,
   '10000000-0000-0000-0000-000000001870', '00000000-0000-0000-0000-000000018701',
   '50000000-0000-0000-0000-000000001870'),
  ('40000000-0000-0000-0000-000000001872', 'Jornada 1872', CURRENT_DATE + 31,
   '10000000-0000-0000-0000-000000001870', '00000000-0000-0000-0000-000000018701',
   '50000000-0000-0000-0000-000000001870'),
  ('40000000-0000-0000-0000-000000001873', 'Jornada cancelada 1873', CURRENT_DATE + 32,
   '10000000-0000-0000-0000-000000001870', '00000000-0000-0000-0000-000000018701',
   '50000000-0000-0000-0000-000000001870');

-- Lo que se prueba es como trata el aporte a una jornada que ya no esta activa, no como se llega
-- a cancelarla: se salta la maquina de estados.
ALTER TABLE jornadas DISABLE TRIGGER USER;
UPDATE jornadas SET estado = 'cancelada' WHERE id = '40000000-0000-0000-0000-000000001873';
ALTER TABLE jornadas ENABLE TRIGGER USER;

INSERT INTO donantes (id, nombre, tipo) VALUES
  ('d0000000-0000-0000-0000-000000018701', 'Donante 1870', 'organizacion');

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000018701';

-- ============================================================================
-- La donacion de dinero para una jornada entra a su presupuesto
-- ============================================================================
SELECT lives_ok(
  $$ SELECT fn_registrar_donacion(
       'd0000000-0000-0000-0000-000000018701', 'dinero', CURRENT_DATE,
       '[{"descripcion": "Aporte 1870 a", "monto": 300}, {"descripcion": "Aporte 1870 b", "monto": 200}]'::jsonb,
       NULL, 'Dinero para la 1871',
       '40000000-0000-0000-0000-000000001871') $$,
  'se registra una donacion de dinero para una jornada'
);

SELECT is(
  (SELECT count(*)::int FROM jornada_presupuesto_origen
   WHERE jornada_id = '40000000-0000-0000-0000-000000001871'),
  1,
  'la jornada recibe un solo aporte, aunque la donacion tenga dos renglones'
);

SELECT is(
  (SELECT row(o.origen, o.monto, o.registrado_por)::text
   FROM jornada_presupuesto_origen o
   JOIN donaciones d ON d.id = o.donacion_id
   WHERE d.observaciones = 'Dinero para la 1871'),
  row('donacion'::origen_de_presupuesto, 500.00::numeric(12, 2),
      '00000000-0000-0000-0000-000000018701'::uuid)::text,
  'el aporte es de origen donacion, por el total donado, y lo registra quien registro la donacion'
);

SELECT is(
  (SELECT presupuesto_asignado FROM jornadas WHERE id = '40000000-0000-0000-0000-000000001871'),
  500.00::numeric,
  'el presupuesto de la jornada sube con la donacion'
);

-- La donacion ya esta asignada entera: no queda saldo para repartirla otra vez.
SELECT throws_ok(
  $$ INSERT INTO jornada_presupuesto_origen (jornada_id, origen, donacion_id, monto)
     SELECT '40000000-0000-0000-0000-000000001872', 'donacion', id, 1
     FROM donaciones WHERE observaciones = 'Dinero para la 1871' $$,
  '23514',
  NULL,
  'la donacion no se puede asignar otra vez por encima de su monto'
);

-- Quitar el aporte desde la jornada deja el dinero libre en la donacion.
SELECT lives_ok(
  $$ DELETE FROM jornada_presupuesto_origen
     WHERE jornada_id = '40000000-0000-0000-0000-000000001871' $$,
  'el aporte automatico se puede quitar como cualquier otro'
);

SELECT is(
  (SELECT presupuesto_asignado FROM jornadas WHERE id = '40000000-0000-0000-0000-000000001871'),
  0.00::numeric,
  'y el presupuesto de la jornada vuelve a bajar'
);

-- ============================================================================
-- Lo que NO entra al presupuesto
-- ============================================================================
SELECT lives_ok(
  $$ SELECT fn_registrar_donacion(
       'd0000000-0000-0000-0000-000000018701', 'dinero', CURRENT_DATE,
       '[{"descripcion": "Aporte 1870 c", "monto": 80}]'::jsonb,
       '50000000-0000-0000-0000-000000001870', 'Dinero sin jornada') $$,
  'una donacion de dinero sin jornada se registra como antes'
);

SELECT lives_ok(
  $$ SELECT fn_registrar_donacion(
       'd0000000-0000-0000-0000-000000018701', 'servicios', CURRENT_DATE,
       '[{"descripcion": "Servicio 1870", "monto": 150}]'::jsonb,
       NULL, 'Servicio para la 1872',
       '40000000-0000-0000-0000-000000001872') $$,
  'una donacion de servicios para una jornada se registra'
);

SELECT lives_ok(
  $$ SELECT fn_registrar_donacion(
       'd0000000-0000-0000-0000-000000018701', 'dinero', CURRENT_DATE,
       '[{"descripcion": "Aporte 1870 d", "monto": 90}]'::jsonb,
       NULL, 'Dinero para una cancelada',
       '40000000-0000-0000-0000-000000001873') $$,
  'una donacion de dinero para una jornada cancelada se registra'
);

SELECT is(
  (SELECT count(*)::int
   FROM jornada_presupuesto_origen o
   JOIN donaciones d ON d.id = o.donacion_id
   WHERE d.observaciones IN ('Dinero sin jornada', 'Servicio para la 1872', 'Dinero para una cancelada')),
  0,
  'sin jornada, sin ser dinero o con la jornada cancelada no se crea ningun aporte'
);

-- ============================================================================
-- Quien registra donaciones sin gestionar jornadas
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000018702';

SELECT lives_ok(
  $$ SELECT fn_registrar_donacion(
       'd0000000-0000-0000-0000-000000018701', 'dinero', CURRENT_DATE,
       '[{"descripcion": "Aporte 1870 e", "monto": 120}]'::jsonb,
       NULL, 'Dinero del medico para la 1872',
       '40000000-0000-0000-0000-000000001872') $$,
  'quien registra donaciones sin gestionar jornadas tambien registra una para una jornada'
);

RESET ROLE;

SELECT is(
  (SELECT row(o.monto, o.registrado_por)::text
   FROM jornada_presupuesto_origen o
   WHERE o.jornada_id = '40000000-0000-0000-0000-000000001872'),
  row(120.00::numeric(12, 2), '00000000-0000-0000-0000-000000018702'::uuid)::text,
  'y su dinero entra al presupuesto de la jornada, a su nombre'
);

SELECT * FROM finish();
ROLLBACK;
