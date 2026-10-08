-- Pruebas de la migracion 00149. Corre con: supabase test db
--
-- 1. jornadas.orden_kanban y proyectos.orden_columna ya no existen.
-- 2. fuentes_de_presupuesto: quien registra aportes crea fuentes, el personal de campo no, el
--    nombre no se repite ignorando mayusculas, y una fuente solo va en un aporte externo.
--
-- La lectura de notificaciones para la administracion la prueba notificaciones.sql.
-- Ningun dato real.

BEGIN;

SELECT plan(9);

-- Desde la 00169 toda jornada nueva lleva proyecto. Estas pruebas no tratan de proyectos: sus
-- jornadas reciben uno de prueba como DEFAULT de la columna, que el ROLLBACK del final deshace.
INSERT INTO proyectos (id, nombre) VALUES
  ('5f000000-0000-0000-0000-000000000169', 'Proyecto de prueba 00169');
ALTER TABLE jornadas ALTER COLUMN proyecto_id SET DEFAULT '5f000000-0000-0000-0000-000000000169';

-- Desde la 00178 toda jornada nueva lleva una bodega movil. Estas pruebas no tratan de bodegas:
-- sus jornadas reciben una de prueba como DEFAULT de la columna, que el ROLLBACK del final deshace.
INSERT INTO bodegas (id, nombre, es_movil) VALUES
  ('5b000000-0000-0000-0000-000000000178', 'Bodega movil de prueba 00178', TRUE);
ALTER TABLE jornadas ALTER COLUMN botiquin_bodega_id SET DEFAULT '5b000000-0000-0000-0000-000000000178';

-- ============================================================================
-- 1. Columnas retiradas
-- ============================================================================
SELECT hasnt_column('public', 'jornadas', 'orden_kanban', 'jornadas ya no tiene orden_kanban');
SELECT hasnt_column('public', 'proyectos', 'orden_columna', 'proyectos ya no tiene orden_columna');

-- ============================================================================
-- Setup (como dueno, exento de RLS)
-- ============================================================================
INSERT INTO comunidades (id, municipio_id, nombre) VALUES
  ('10000000-0000-0000-0000-000000000149', 101, 'Comunidad de prueba 149');

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000014901', 'admin149@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000014902', 'medico149@test.ecopac.local');

ALTER TABLE perfiles DISABLE TRIGGER USER;
UPDATE perfiles SET rol = 'administrador' WHERE id = '00000000-0000-0000-0000-000000014901';
UPDATE perfiles SET rol = 'medico' WHERE id = '00000000-0000-0000-0000-000000014902';
ALTER TABLE perfiles ENABLE TRIGGER USER;

INSERT INTO jornadas (id, nombre, fecha, comunidad_id, responsable_id) VALUES
  ('40000000-0000-0000-0000-000000014901', 'Jornada 149', CURRENT_DATE + 10,
   '10000000-0000-0000-0000-000000000149', '00000000-0000-0000-0000-000000014901');

-- ============================================================================
-- 2. Fuentes de aportes externos
-- ============================================================================
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000014901', TRUE);

SELECT lives_ok(
  $$ INSERT INTO fuentes_de_presupuesto (id, nombre)
     VALUES ('f0000000-0000-0000-0000-000000014901', 'Municipalidad 149') $$,
  'la administracion crea una fuente de aporte externo'
);

SELECT throws_ok(
  $$ INSERT INTO fuentes_de_presupuesto (nombre) VALUES ('  municipalidad 149 ') $$,
  '23505',
  NULL,
  'el mismo nombre con otras mayusculas o espacios no se repite'
);

SELECT lives_ok(
  $$ INSERT INTO jornada_presupuesto_origen (jornada_id, origen, fuente_id, monto)
     VALUES ('40000000-0000-0000-0000-000000014901', 'aporte_externo',
             'f0000000-0000-0000-0000-000000014901', 250) $$,
  'un aporte externo lleva su fuente'
);

SELECT throws_ok(
  $$ INSERT INTO jornada_presupuesto_origen (jornada_id, origen, fuente_id, monto)
     VALUES ('40000000-0000-0000-0000-000000014901', 'fondos_propios',
             'f0000000-0000-0000-0000-000000014901', 100) $$,
  '23514',
  NULL,
  'una fuente no va en un aporte que no es externo'
);

SELECT is(
  (SELECT presupuesto_asignado FROM jornadas WHERE id = '40000000-0000-0000-0000-000000014901'),
  250::numeric,
  'el aporte con fuente suma al presupuesto de la jornada como cualquier otro'
);

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000014902', TRUE);

SELECT throws_ok(
  $$ INSERT INTO fuentes_de_presupuesto (nombre) VALUES ('Empresa 149') $$,
  '42501',
  NULL,
  'el personal de campo no crea fuentes: no registra aportes'
);

SELECT is(
  (SELECT count(*)::int FROM fuentes_de_presupuesto),
  0,
  'el personal de campo no lee el catalogo de fuentes'
);

RESET ROLE;

SELECT * FROM finish();

ROLLBACK;
