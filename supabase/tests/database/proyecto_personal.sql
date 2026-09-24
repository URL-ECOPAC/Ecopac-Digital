-- Pruebas de la 00146: equipo de un proyecto (proyecto_personal). Corre con:
-- supabase test db
--
-- Mismo patron que permisos_por_rol_864.sql: los fixtures se insertan como postgres (bypasea RLS)
-- y despues SET LOCAL ROLE authenticated + SET LOCAL request.jwt.claim.sub impersona a un perfil
-- de cada rol. Una lectura denegada no lanza, devuelve cero filas: por eso las negativas de
-- lectura son conteos y las de escritura son throws_ok o un conteo tras el UPDATE/DELETE.

BEGIN;

SELECT plan(17);

-- ============================================================================
-- Setup
-- ============================================================================
INSERT INTO comunidades (id, municipio_id, nombre) VALUES
  ('10000000-0000-0000-0000-000000001461', 101, 'Comunidad de prueba 1461');

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000014611', 'admin1461@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000014612', 'junta1461@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000014613', 'medico1461@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000014614', 'medico2-1461@test.ecopac.local');

ALTER TABLE perfiles DISABLE TRIGGER USER;
UPDATE perfiles SET rol = 'administrador'   WHERE id = '00000000-0000-0000-0000-000000014611';
UPDATE perfiles SET rol = 'junta directiva' WHERE id = '00000000-0000-0000-0000-000000014612';
UPDATE perfiles SET rol = 'medico'          WHERE id = '00000000-0000-0000-0000-000000014613';
UPDATE perfiles SET rol = 'medico'          WHERE id = '00000000-0000-0000-0000-000000014614';
ALTER TABLE perfiles ENABLE TRIGGER USER;

-- Proyecto A: cuelga de una jornada en la que participa el medico 14613.
-- Proyecto B: cuelga de una jornada sin nadie del equipo de turnos.
INSERT INTO proyectos (id, nombre) VALUES
  ('50000000-0000-0000-0000-000000001461', 'Proyecto A 1461'),
  ('50000000-0000-0000-0000-000000001462', 'Proyecto B 1461');

INSERT INTO jornadas (id, nombre, fecha, comunidad_id, responsable_id, proyecto_id) VALUES
  ('40000000-0000-0000-0000-000000001461', 'Jornada A 1461', CURRENT_DATE + 30,
   '10000000-0000-0000-0000-000000001461', '00000000-0000-0000-0000-000000014611',
   '50000000-0000-0000-0000-000000001461'),
  ('40000000-0000-0000-0000-000000001462', 'Jornada B 1461', CURRENT_DATE + 31,
   '10000000-0000-0000-0000-000000001461', '00000000-0000-0000-0000-000000014611',
   '50000000-0000-0000-0000-000000001462');

INSERT INTO jornada_personal (jornada_id, perfil_id, rol_en_jornada, hora_inicio, hora_fin) VALUES
  ('40000000-0000-0000-0000-000000001461', '00000000-0000-0000-0000-000000014613', 'medico', '08:00', '13:00');

-- Equipo: dos personas en el proyecto A, una en el B (el medico 14614, que NO participa en ninguna
-- jornada de B: su unica via de lectura es su propia asignacion).
INSERT INTO proyecto_personal (id, proyecto_id, perfil_id, rol_en_proyecto) VALUES
  ('80000000-0000-0000-0000-000000001461', '50000000-0000-0000-0000-000000001461',
   '00000000-0000-0000-0000-000000014613', 'Coordinacion'),
  ('80000000-0000-0000-0000-000000001462', '50000000-0000-0000-0000-000000001461',
   '00000000-0000-0000-0000-000000014611', NULL),
  ('80000000-0000-0000-0000-000000001463', '50000000-0000-0000-0000-000000001462',
   '00000000-0000-0000-0000-000000014614', NULL);

-- ============================================================================
-- Privilegios
-- ============================================================================
SELECT is(
  has_table_privilege('anon', 'public.proyecto_personal', 'SELECT'), false,
  'anon no tiene ningun privilegio sobre proyecto_personal'
);

-- ============================================================================
-- Administrador: lee todo y escribe
-- ============================================================================
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000014611';

SELECT is((SELECT count(*) FROM proyecto_personal)::int, 3, 'el administrador lee todos los equipos');

SELECT lives_ok(
  $$ INSERT INTO proyecto_personal (proyecto_id, perfil_id, rol_en_proyecto)
     VALUES ('50000000-0000-0000-0000-000000001462', '00000000-0000-0000-0000-000000014613', 'Enlace') $$,
  'el administrador asigna a alguien al equipo de un proyecto'
);

SELECT throws_ok(
  $$ INSERT INTO proyecto_personal (proyecto_id, perfil_id)
     VALUES ('50000000-0000-0000-0000-000000001462', '00000000-0000-0000-0000-000000014613') $$,
  '23505', NULL,
  'la misma persona no figura dos veces en el equipo de un proyecto'
);

SELECT throws_ok(
  $$ INSERT INTO proyecto_personal (proyecto_id, perfil_id, rol_en_proyecto)
     VALUES ('50000000-0000-0000-0000-000000001461', '00000000-0000-0000-0000-000000014614', '   ') $$,
  '23514', NULL,
  'un rol de solo espacios se rechaza: sin rol se guarda NULL'
);

-- ============================================================================
-- Medico: lee el equipo del proyecto que ve, y no escribe
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000014613';

SELECT is(
  (SELECT count(*) FROM proyecto_personal
    WHERE proyecto_id = '50000000-0000-0000-0000-000000001461')::int, 2,
  'el medico ve el equipo completo del proyecto de su jornada, no solo su fila'
);

SELECT is(
  (SELECT count(*) FROM proyecto_personal
    WHERE proyecto_id = '50000000-0000-0000-0000-000000001462'
      AND perfil_id <> '00000000-0000-0000-0000-000000014613')::int, 0,
  'pero no el equipo de un proyecto que no ve (solo su propia asignacion, si la tiene)'
);

SELECT throws_ok(
  $$ INSERT INTO proyecto_personal (proyecto_id, perfil_id)
     VALUES ('50000000-0000-0000-0000-000000001461', '00000000-0000-0000-0000-000000014614') $$,
  '42501', NULL,
  'el medico no asigna a nadie al equipo de un proyecto'
);

UPDATE proyecto_personal SET rol_en_proyecto = 'Cambiado'
 WHERE id = '80000000-0000-0000-0000-000000001461';
DELETE FROM proyecto_personal WHERE id = '80000000-0000-0000-0000-000000001462';

RESET ROLE;
SELECT is(
  (SELECT count(*) FROM proyecto_personal
    WHERE (id = '80000000-0000-0000-0000-000000001461' AND rol_en_proyecto = 'Coordinacion')
       OR id = '80000000-0000-0000-0000-000000001462')::int, 2,
  'el medico no pudo ni editar ni desasignar: las dos filas siguen como estaban'
);

-- equipo_de_proyecto() repite a mano la regla de SELECT de la tabla (es DEFINER). Aqui se compara
-- contra la lectura directa, para que el dia que una cambie sin la otra falle esta prueba.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000014613';

SELECT is(
  (SELECT count(*) FROM equipo_de_proyecto('50000000-0000-0000-0000-000000001461'))::int,
  (SELECT count(*) FROM proyecto_personal
    WHERE proyecto_id = '50000000-0000-0000-0000-000000001461')::int,
  'equipo_de_proyecto coincide con la tabla para el medico que ve el proyecto'
);

SELECT ok(
  (SELECT bool_and(nombres IS NOT NULL)
     FROM equipo_de_proyecto('50000000-0000-0000-0000-000000001461')),
  'y le trae el nombre de TODAS las personas del equipo, aunque no pueda leer perfiles'
);

SELECT is(
  (SELECT count(*) FROM equipo_de_proyecto('50000000-0000-0000-0000-000000001462')
    WHERE perfil_id <> '00000000-0000-0000-0000-000000014613')::int, 0,
  'y no cuela el equipo de un proyecto que no ve'
);

-- ============================================================================
-- Quien solo tiene su propia asignacion, y la junta directiva
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000014614';

SELECT is(
  (SELECT count(*) FROM proyecto_personal)::int, 1,
  'una persona del equipo de un proyecto que no ve lee su propia asignacion y nada mas'
);

SELECT is(
  (SELECT count(*) FROM equipo_de_proyecto('50000000-0000-0000-0000-000000001462'))::int, 1,
  'equipo_de_proyecto le devuelve lo mismo que la tabla: su propia asignacion'
);

SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000014612';

SELECT is(
  (SELECT count(*) FROM proyecto_personal)::int, 0,
  'junta directiva no lee equipos de proyecto (su unica pantalla es Reportes, 00141)'
);

SELECT is(
  (SELECT count(*) FROM equipo_de_proyecto('50000000-0000-0000-0000-000000001461'))::int, 0,
  'ni la funcion le abre lo que la tabla le cierra'
);

-- ============================================================================
-- Borrado de un proyecto
-- ============================================================================
RESET ROLE;
DELETE FROM proyectos WHERE id = '50000000-0000-0000-0000-000000001462';

SELECT is(
  (SELECT count(*) FROM proyecto_personal
    WHERE proyecto_id = '50000000-0000-0000-0000-000000001462')::int, 0,
  'al borrar un proyecto su equipo se va con el (ON DELETE CASCADE)'
);

SELECT * FROM finish();
ROLLBACK;
