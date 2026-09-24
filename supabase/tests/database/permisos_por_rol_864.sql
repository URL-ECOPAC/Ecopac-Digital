-- Pruebas de la 00141: que ve cada rol tras la issue #864. Corre con:
-- supabase test db
--
-- Mismo patron que el resto de las suites: los fixtures se insertan como postgres (superusuario,
-- bypasea RLS) y despues SET LOCAL ROLE authenticated + SET LOCAL request.jwt.claim.sub impersona
-- a un perfil de cada rol.
--
-- Lo que se afirma aqui es lo que la interfaz da por hecho en navegacion.js y en los permisos.js
-- de cada modulo. Si esta suite y aquellos dejan de coincidir, lo que manda es esta suite: es la
-- unica de las dos que le pregunta a la base.
--
-- OJO con como se comprueba una negativa (docs/PERMISOS.md, "Como se comprueba una negativa"):
-- una lectura denegada no lanza, devuelve cero filas. Por eso casi todo aqui es un conteo y no
-- un throws_ok.

BEGIN;

SELECT plan(24);

-- ============================================================================
-- Setup
-- ============================================================================
INSERT INTO comunidades (id, municipio_id, nombre) VALUES
  ('10000000-0000-0000-0000-000000000864', 101, 'Comunidad de prueba 864');

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000008641', 'admin864@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000008642', 'junta864@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000008643', 'socio864@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000008644', 'medico864@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000008645', 'medico2-864@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000008646', 'voluntario864@test.ecopac.local');

ALTER TABLE perfiles DISABLE TRIGGER USER;
UPDATE perfiles SET rol = 'administrador'   WHERE id = '00000000-0000-0000-0000-000000008641';
UPDATE perfiles SET rol = 'junta directiva' WHERE id = '00000000-0000-0000-0000-000000008642';
UPDATE perfiles SET rol = 'socio fundador'  WHERE id = '00000000-0000-0000-0000-000000008643';
UPDATE perfiles SET rol = 'medico'          WHERE id = '00000000-0000-0000-0000-000000008644';
UPDATE perfiles SET rol = 'medico'          WHERE id = '00000000-0000-0000-0000-000000008645';
-- voluntario864 se queda con el rol por defecto (voluntario general).
ALTER TABLE perfiles ENABLE TRIGGER USER;

-- Dos proyectos: el A cuelga de la jornada del medico 8644; el B no cuelga de ninguna suya.
INSERT INTO proyectos (id, nombre) VALUES
  ('50000000-0000-0000-0000-000000008641', 'Proyecto con jornada 864'),
  ('50000000-0000-0000-0000-000000008642', 'Proyecto ajeno 864');

-- Jornada A: del proyecto A, con el medico 8644 y el voluntario en el cuadro de turnos.
-- Jornada B: del proyecto B, sin nadie asignado, y con el medico 8645 como RESPONSABLE.
INSERT INTO jornadas (id, nombre, fecha, comunidad_id, responsable_id, proyecto_id) VALUES
  ('40000000-0000-0000-0000-000000008641', 'Jornada asignada 864', CURRENT_DATE + 30,
   '10000000-0000-0000-0000-000000000864', '00000000-0000-0000-0000-000000008641',
   '50000000-0000-0000-0000-000000008641'),
  ('40000000-0000-0000-0000-000000008642', 'Jornada del responsable 864', CURRENT_DATE + 31,
   '10000000-0000-0000-0000-000000000864', '00000000-0000-0000-0000-000000008645',
   '50000000-0000-0000-0000-000000008642');

INSERT INTO jornada_personal (jornada_id, perfil_id, rol_en_jornada, hora_inicio, hora_fin) VALUES
  ('40000000-0000-0000-0000-000000008641', '00000000-0000-0000-0000-000000008644', 'medico', '08:00', '13:00'),
  ('40000000-0000-0000-0000-000000008641', '00000000-0000-0000-0000-000000008646', 'voluntario general', '08:00', '13:00');

INSERT INTO donantes (id, nombre, tipo) VALUES
  ('60000000-0000-0000-0000-000000008641', 'Donante de prueba 864', 'persona');

INSERT INTO gastos (id, jornada_id, concepto, monto, categoria, registrado_por) VALUES
  ('70000000-0000-0000-0000-000000008641', '40000000-0000-0000-0000-000000008641',
   'Gasto de prueba 864', 100, 'Logistica', '00000000-0000-0000-0000-000000008641');

-- ============================================================================
-- Junta directiva y socio fundador: solo reportes
-- ============================================================================
-- Los dos roles consultivos se comprueban en paralelo a proposito: docs/PERMISOS.md declara que
-- son el mismo permiso, y hasta la #864 la base los trataba distinto en varias tablas.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000008642';

SELECT is((SELECT count(*) FROM jornadas)::int, 0, 'junta directiva ya no lee jornadas');
SELECT is((SELECT count(*) FROM proyectos)::int, 0, 'junta directiva ya no lee proyectos');
SELECT is((SELECT count(*) FROM gastos)::int, 0, 'junta directiva ya no lee gastos');
SELECT is((SELECT count(*) FROM donantes)::int, 0, 'junta directiva ya no lee donantes');
SELECT is(
  (SELECT count(*) FROM jornada_personal)::int, 0,
  'junta directiva ya no lee el cuadro de turnos de nadie'
);
SELECT is(
  (SELECT count(*) FROM perfiles_directorio)::int, 1,
  'junta directiva solo se lee a si misma en perfiles_directorio'
);

-- Lo que SI conserva, y es la razon de que la 00141 no les quite el inventario: los dos reportes
-- que les corresponden leen `existencias` y `lotes` directo de la tabla, no por una vista.
SELECT ok(
  (SELECT count(*) FROM existencias) >= 0 AND
  (SELECT has_table_privilege('existencias', 'SELECT')),
  'junta directiva conserva la lectura de existencias, que alimenta el reporte de inventario'
);

SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000008643';

SELECT is((SELECT count(*) FROM jornadas)::int, 0, 'socio fundador ya no lee jornadas');
SELECT is((SELECT count(*) FROM proyectos)::int, 0, 'socio fundador ya no lee proyectos');
SELECT is(
  (SELECT count(*) FROM gastos)::int, 0,
  'socio fundador ya no lee gastos (era la unica politica que lo nombraba por su nombre)'
);

-- La guarda de esta funcion dice es_consultivo() desde la 00086; lo que estaba desactualizado era
-- el cliente, que seguia citando la 00067. Se afirma aqui para que no vuelva a divergir.
SELECT lives_ok(
  $$ SELECT * FROM fn_reporte_pacientes_atendidos('jornada') $$,
  'socio fundador si puede llamar al reporte de pacientes atendidos'
);

-- ============================================================================
-- Medico: sus jornadas, sus proyectos, su equipo
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000008644';

SELECT is(
  (SELECT count(*) FROM jornadas)::int, 1,
  'el medico lee la jornada en la que esta asignado, y solo esa'
);

SELECT is(
  (SELECT count(*) FROM proyectos WHERE id = '50000000-0000-0000-0000-000000008641')::int, 1,
  'el medico lee el proyecto de la jornada en la que participa'
);

SELECT is(
  (SELECT count(*) FROM proyectos WHERE id = '50000000-0000-0000-0000-000000008642')::int, 0,
  'pero NO el proyecto de una jornada ajena'
);

SELECT is(
  (SELECT count(*) FROM jornada_personal)::int, 2,
  'el medico ve el equipo completo de su jornada, no solo su propia fila'
);

SELECT is(
  (SELECT count(*) FROM proyecto_hitos)::int, 0,
  'el medico no lee los hitos de un proyecto'
);

-- El alta de medicamento con RETURNING, que es como la llama supabase-js: si la fila no pasara
-- ademas una politica de SELECT, el INSERT fallaria entero (docs/PERMISOS.md, regla del
-- RETURNING). La politica de SELECT de medicamentos es rol_actual() IS NOT NULL, asi que pasa.
SELECT lives_ok(
  $$ INSERT INTO medicamentos (id, nombre, concentracion, presentacion_id, marca)
     VALUES ('80000000-0000-0000-0000-000000008641', 'Medicamento 864', '500 mg',
       (SELECT id FROM presentaciones WHERE nombre = 'Tableta'), 'Generico')
     RETURNING id $$,
  'el medico da de alta un medicamento del catalogo'
);

-- Un UPDATE denegado no lanza: corre y afecta cero filas. Se comprueba contando.
UPDATE medicamentos SET nombre = 'Renombrado por el medico'
  WHERE id = '80000000-0000-0000-0000-000000008641';

SELECT is(
  (SELECT nombre FROM medicamentos WHERE id = '80000000-0000-0000-0000-000000008641'),
  'Medicamento 864',
  'pero no puede editarlo despues: el UPDATE sigue siendo de la administradora'
);

-- ============================================================================
-- El responsable de una jornada ve su jornada (el defecto que la #838 dejo en el cliente)
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000008645';

SELECT is(
  (SELECT count(*) FROM jornada_personal WHERE perfil_id = '00000000-0000-0000-0000-000000008645')::int,
  0,
  'el medico 8645 no esta en el cuadro de turnos de ninguna jornada'
);

SELECT is(
  (SELECT count(*) FROM jornadas)::int, 1,
  'y aun asi lee la jornada de la que es responsable_id'
);

SELECT is(
  (SELECT nombre FROM jornadas),
  'Jornada del responsable 864',
  'y es exactamente la suya, no la de al lado'
);

-- El otro lado del mismo defecto, y el que se vio en pantalla: el responsable leia su jornada
-- pero no a su equipo, y el detalle decia "todavia no hay personal asignado" con personal
-- asignado. Aqui la jornada B no tiene a nadie en el cuadro de turnos, asi que lo que se afirma
-- es que lee el proyecto de su jornada por la misma via.
SELECT is(
  (SELECT count(*) FROM proyectos WHERE id = '50000000-0000-0000-0000-000000008642')::int, 1,
  'y lee el proyecto de esa jornada, aunque no este en su cuadro de turnos'
);

-- ============================================================================
-- Voluntario general: sin cambios, salvo que ahora ve el equipo de su jornada
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000008646';

SELECT is(
  (SELECT count(*) FROM jornada_personal)::int, 2,
  'el voluntario tambien ve el equipo completo de su jornada'
);

SELECT is(
  (SELECT count(*) FROM proyectos)::int, 1,
  'y lee el proyecto de su jornada, por la misma politica que el medico'
);

SELECT * FROM finish();
ROLLBACK;
