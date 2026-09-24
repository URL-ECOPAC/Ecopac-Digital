-- Pruebas de la 00147: insumos previstos de un proyecto (proyecto_insumos). Corre con:
-- supabase test db
--
-- Mismo patron que proyecto_personal.sql: fixtures como postgres y despues SET LOCAL ROLE
-- authenticated + SET LOCAL request.jwt.claim.sub para impersonar a cada rol. Una lectura denegada
-- devuelve cero filas, no lanza: las negativas de lectura son conteos.

BEGIN;

SELECT plan(14);

-- ============================================================================
-- Setup
-- ============================================================================
INSERT INTO comunidades (id, municipio_id, nombre) VALUES
  ('10000000-0000-0000-0000-000000001471', 101, 'Comunidad de prueba 1471');

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000014711', 'admin1471@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000014712', 'junta1471@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000014713', 'medico1471@test.ecopac.local');

ALTER TABLE perfiles DISABLE TRIGGER USER;
UPDATE perfiles SET rol = 'administrador'   WHERE id = '00000000-0000-0000-0000-000000014711';
UPDATE perfiles SET rol = 'junta directiva' WHERE id = '00000000-0000-0000-0000-000000014712';
UPDATE perfiles SET rol = 'medico'          WHERE id = '00000000-0000-0000-0000-000000014713';
ALTER TABLE perfiles ENABLE TRIGGER USER;

INSERT INTO proyectos (id, nombre) VALUES
  ('50000000-0000-0000-0000-000000001471', 'Proyecto de prueba 1471');

-- El medico participa en una jornada del proyecto: VE el proyecto, y aun asi no debe ver insumos.
INSERT INTO jornadas (id, nombre, fecha, comunidad_id, responsable_id, proyecto_id) VALUES
  ('40000000-0000-0000-0000-000000001471', 'Jornada 1471', CURRENT_DATE + 30,
   '10000000-0000-0000-0000-000000001471', '00000000-0000-0000-0000-000000014711',
   '50000000-0000-0000-0000-000000001471');

INSERT INTO jornada_personal (jornada_id, perfil_id, rol_en_jornada, hora_inicio, hora_fin) VALUES
  ('40000000-0000-0000-0000-000000001471', '00000000-0000-0000-0000-000000014713', 'medico', '08:00', '13:00');

-- Un insumo y un medicamento del catalogo.
INSERT INTO medicamentos (id, nombre, concentracion, presentacion_id, marca, tipo_articulo) VALUES
  ('90000000-0000-0000-0000-000000001471', 'Guantes 1471', 'talla M',
   (SELECT id FROM presentaciones ORDER BY nombre LIMIT 1), 'Generico', 'insumo'),
  ('90000000-0000-0000-0000-000000001472', 'Medicamento 1471', '500 mg',
   (SELECT id FROM presentaciones ORDER BY nombre LIMIT 1), 'Generico', 'medicamento');

INSERT INTO proyecto_insumos (id, proyecto_id, medicamento_id, cantidad, unidad, costo_unitario_estimado) VALUES
  ('a0000000-0000-0000-0000-000000001471', '50000000-0000-0000-0000-000000001471',
   '90000000-0000-0000-0000-000000001471', 100, 'cajas', 12.50);

-- ============================================================================
-- Privilegios
-- ============================================================================
SELECT is(
  has_table_privilege('anon', 'public.proyecto_insumos', 'SELECT'), false,
  'anon no tiene ningun privilegio sobre proyecto_insumos'
);

-- ============================================================================
-- Administrador: lee y escribe
-- ============================================================================
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000014711';

SELECT is((SELECT count(*) FROM proyecto_insumos)::int, 1, 'el administrador lee los insumos');

-- Lo previsto sale del mismo catalogo que "Producto / Insumo" en "Registrar ingreso": tanto un
-- insumo como un medicamento del catalogo se pueden prever.
SELECT lives_ok(
  $$ INSERT INTO proyecto_insumos (proyecto_id, medicamento_id, cantidad, unidad)
     VALUES ('50000000-0000-0000-0000-000000001471', '90000000-0000-0000-0000-000000001472', 5, 'cajas') $$,
  'un articulo del catalogo que es medicamento tambien se puede prever, no solo los de tipo insumo'
);

SELECT throws_ok(
  $$ INSERT INTO proyecto_insumos (proyecto_id, medicamento_id, cantidad, unidad)
     VALUES ('50000000-0000-0000-0000-000000001471', gen_random_uuid(), 5, 'cajas') $$,
  '23503', NULL,
  'un articulo que no existe en el catalogo se rechaza (FK)'
);

SELECT throws_ok(
  $$ INSERT INTO proyecto_insumos (proyecto_id, medicamento_id, cantidad, unidad)
     VALUES ('50000000-0000-0000-0000-000000001471', '90000000-0000-0000-0000-000000001471', 5, 'cajas') $$,
  '23505', NULL,
  'un articulo figura una sola vez por proyecto'
);

SELECT throws_ok(
  $$ UPDATE proyecto_insumos SET cantidad = 0 WHERE id = 'a0000000-0000-0000-0000-000000001471' $$,
  '23514', NULL,
  'la cantidad tiene que ser mayor que cero'
);

SELECT throws_ok(
  $$ UPDATE proyecto_insumos SET unidad = '   ' WHERE id = 'a0000000-0000-0000-0000-000000001471' $$,
  '23514', NULL,
  'la unidad no puede ser solo espacios'
);

SELECT throws_ok(
  $$ UPDATE proyecto_insumos SET costo_unitario_estimado = -1 WHERE id = 'a0000000-0000-0000-0000-000000001471' $$,
  '23514', NULL,
  'el costo estimado no puede ser negativo'
);

SELECT lives_ok(
  $$ UPDATE proyecto_insumos SET costo_unitario_estimado = NULL, nota = 'Sin costo aun'
      WHERE id = 'a0000000-0000-0000-0000-000000001471' $$,
  'un costo NULL (no estimado) es valido'
);

-- ============================================================================
-- Medico: ve el proyecto y NO sus insumos (#864)
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000014713';

SELECT is(
  (SELECT count(*) FROM proyectos WHERE id = '50000000-0000-0000-0000-000000001471')::int, 1,
  'el medico SI ve el proyecto de su jornada'
);

SELECT is(
  (SELECT count(*) FROM proyecto_insumos)::int, 0,
  'pero no sus insumos: son planificacion con dinero, como los gastos'
);

SELECT throws_ok(
  $$ INSERT INTO proyecto_insumos (proyecto_id, medicamento_id, cantidad, unidad)
     VALUES ('50000000-0000-0000-0000-000000001471', '90000000-0000-0000-0000-000000001471', 1, 'cajas') $$,
  '42501', NULL,
  'el medico no agrega insumos'
);

-- ============================================================================
-- Junta directiva: sin lectura
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000014712';

SELECT is(
  (SELECT count(*) FROM proyecto_insumos)::int, 0,
  'junta directiva no lee insumos de proyecto (su unica pantalla es Reportes, 00141)'
);

-- ============================================================================
-- Un articulo previsto no se borra del catalogo en silencio; el proyecto si arrastra su lista
-- ============================================================================
RESET ROLE;

SELECT throws_ok(
  $$ DELETE FROM medicamentos WHERE id = '90000000-0000-0000-0000-000000001471' $$,
  '23503', NULL,
  'no se puede borrar del catalogo un articulo que un proyecto tiene previsto (RESTRICT)'
);

SELECT * FROM finish();
ROLLBACK;
