-- Pruebas de la 00174: inicio y cierre reales de una jornada se llenan solos. Corre con:
-- supabase test db
--
-- Dentro de una transaccion NOW() no avanza, asi que se comprueba si la fecha esta o no esta, no
-- su hora exacta.

BEGIN;

SELECT plan(8);

-- ============================================================================
-- Setup
-- ============================================================================
INSERT INTO comunidades (id, municipio_id, nombre) VALUES
  ('10000000-0000-0000-0000-000000001741', 101, 'Comunidad de prueba 1741');

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000017411', 'admin1741@test.ecopac.local');

ALTER TABLE perfiles DISABLE TRIGGER USER;
UPDATE perfiles SET rol = 'administrador' WHERE id = '00000000-0000-0000-0000-000000017411';
ALTER TABLE perfiles ENABLE TRIGGER USER;

INSERT INTO proyectos (id, nombre) VALUES
  ('50000000-0000-0000-0000-000000001741', 'Proyecto 1741');

INSERT INTO jornadas (id, nombre, fecha, comunidad_id, responsable_id, proyecto_id) VALUES
  ('40000000-0000-0000-0000-000000001741', 'Jornada 1741', CURRENT_DATE,
   '10000000-0000-0000-0000-000000001741', '00000000-0000-0000-0000-000000017411',
   '50000000-0000-0000-0000-000000001741');

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000017411';

-- ============================================================================
-- Planificada: sin fechas reales
-- ============================================================================
SELECT is(
  (SELECT fecha_inicio_real FROM jornadas WHERE id = '40000000-0000-0000-0000-000000001741'),
  NULL,
  'una jornada planificada no tiene inicio real'
);

-- ============================================================================
-- En curso: inicio real
-- ============================================================================
UPDATE jornadas SET estado = 'en curso' WHERE id = '40000000-0000-0000-0000-000000001741';

SELECT isnt(
  (SELECT fecha_inicio_real FROM jornadas WHERE id = '40000000-0000-0000-0000-000000001741'),
  NULL,
  'pasar a en curso fija el inicio real'
);

SELECT is(
  (SELECT fecha_fin_real FROM jornadas WHERE id = '40000000-0000-0000-0000-000000001741'),
  NULL,
  'en curso todavia no tiene cierre real'
);

-- ============================================================================
-- Finalizada: cierre real
-- ============================================================================
UPDATE jornadas SET estado = 'finalizada' WHERE id = '40000000-0000-0000-0000-000000001741';

SELECT isnt(
  (SELECT fecha_fin_real FROM jornadas WHERE id = '40000000-0000-0000-0000-000000001741'),
  NULL,
  'finalizar fija el cierre real'
);

-- ============================================================================
-- Reabrir: se borra el cierre, el inicio se queda
-- ============================================================================
UPDATE jornadas SET fecha_inicio_real = '2026-01-01 08:00:00+00'
WHERE id = '40000000-0000-0000-0000-000000001741';

UPDATE jornadas SET estado = 'en curso' WHERE id = '40000000-0000-0000-0000-000000001741';

SELECT is(
  (SELECT fecha_fin_real FROM jornadas WHERE id = '40000000-0000-0000-0000-000000001741'),
  NULL,
  'reabrir una jornada borra su cierre real'
);

SELECT is(
  (SELECT fecha_inicio_real FROM jornadas WHERE id = '40000000-0000-0000-0000-000000001741'),
  '2026-01-01 08:00:00+00'::timestamptz,
  'reabrir no mueve el inicio real'
);

-- ============================================================================
-- Editar otra cosa no toca las fechas
-- ============================================================================
UPDATE jornadas SET nombre = 'Jornada 1741 renombrada'
WHERE id = '40000000-0000-0000-0000-000000001741';

SELECT is(
  (SELECT fecha_inicio_real FROM jornadas WHERE id = '40000000-0000-0000-0000-000000001741'),
  '2026-01-01 08:00:00+00'::timestamptz,
  'editar el nombre no cambia el inicio real'
);

RESET ROLE;

SELECT is(
  has_function_privilege('authenticated', 'public.fn_fechas_reales_de_jornada()', 'EXECUTE'),
  false,
  'nadie llama directo a la funcion del trigger'
);

SELECT * FROM finish();
ROLLBACK;
