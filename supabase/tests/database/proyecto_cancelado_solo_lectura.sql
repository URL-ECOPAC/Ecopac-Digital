-- Pruebas de la 00154: un proyecto cancelado ya no se modifica. Corre con:
-- supabase test db
--
-- Mismo patron que proyecto_insumos.sql: fixtures como postgres y despues SET LOCAL ROLE
-- authenticated + SET LOCAL request.jwt.claim.sub para actuar como la administradora, que es quien
-- por RLS SI puede escribir todo esto. Lo que la frena aqui es el estado del proyecto, no el rol.

BEGIN;

SELECT plan(20);

-- ============================================================================
-- Setup
-- ============================================================================
INSERT INTO comunidades (id, municipio_id, nombre) VALUES
  ('10000000-0000-0000-0000-000000001541', 101, 'Comunidad de prueba 1541');

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000015411', 'admin1541@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000015412', 'persona1541@test.ecopac.local');

ALTER TABLE perfiles DISABLE TRIGGER USER;
UPDATE perfiles SET rol = 'administrador' WHERE id = '00000000-0000-0000-0000-000000015411';
UPDATE perfiles SET rol = 'medico'        WHERE id = '00000000-0000-0000-0000-000000015412';
ALTER TABLE perfiles ENABLE TRIGGER USER;

-- 1541: el proyecto que se cancela. 1542: uno abierto, para comprobar que no se bloquea de mas.
-- 1543: otro abierto, de donde sale la jornada 1542 (desde la 00169 toda jornada nueva lleva
-- proyecto, asi que ya no se arranca de una jornada sin proyecto).
INSERT INTO proyectos (id, nombre) VALUES
  ('50000000-0000-0000-0000-000000001541', 'Proyecto cancelado 1541'),
  ('50000000-0000-0000-0000-000000001542', 'Proyecto abierto 1542'),
  ('50000000-0000-0000-0000-000000001543', 'Proyecto abierto 1543');

INSERT INTO jornadas (id, nombre, fecha, comunidad_id, responsable_id, proyecto_id) VALUES
  ('40000000-0000-0000-0000-000000001541', 'Jornada del cancelado 1541', CURRENT_DATE + 30,
   '10000000-0000-0000-0000-000000001541', '00000000-0000-0000-0000-000000015411',
   '50000000-0000-0000-0000-000000001541'),
  ('40000000-0000-0000-0000-000000001542', 'Jornada de otro proyecto 1542', CURRENT_DATE + 30,
   '10000000-0000-0000-0000-000000001541', '00000000-0000-0000-0000-000000015411',
   '50000000-0000-0000-0000-000000001543');

INSERT INTO medicamentos (id, nombre, concentracion, presentacion_id, marca, tipo_articulo) VALUES
  ('90000000-0000-0000-0000-000000001541', 'Guantes 1541', 'talla M',
   (SELECT id FROM presentaciones ORDER BY nombre LIMIT 1), 'Generico', 'insumo');

INSERT INTO proyecto_hitos (id, proyecto_id, nombre, fecha_prevista) VALUES
  ('b0000000-0000-0000-0000-000000001541', '50000000-0000-0000-0000-000000001541',
   'Hito 1541', CURRENT_DATE + 10);

INSERT INTO proyecto_personal (proyecto_id, perfil_id) VALUES
  ('50000000-0000-0000-0000-000000001541', '00000000-0000-0000-0000-000000015412');

INSERT INTO proyecto_insumos (id, proyecto_id, medicamento_id, cantidad, unidad) VALUES
  ('a0000000-0000-0000-0000-000000001541', '50000000-0000-0000-0000-000000001541',
   '90000000-0000-0000-0000-000000001541', 10, 'cajas');

-- ============================================================================
-- Cancelar sigue funcionando
-- ============================================================================
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000015411';

SELECT lives_ok(
  $$ UPDATE proyectos SET estado = 'cancelado' WHERE id = '50000000-0000-0000-0000-000000001541' $$,
  'cancelar un proyecto planificado sigue funcionando'
);

-- ============================================================================
-- El proyecto cancelado no se modifica
-- ============================================================================
SELECT throws_ok(
  $$ UPDATE proyectos SET nombre = 'Otro nombre' WHERE id = '50000000-0000-0000-0000-000000001541' $$,
  '55000', NULL,
  'no se cambia el nombre de un proyecto cancelado'
);

SELECT throws_ok(
  $$ UPDATE proyectos SET porcentaje_avance = 50 WHERE id = '50000000-0000-0000-0000-000000001541' $$,
  '55000', NULL,
  'no se mueve el avance de un proyecto cancelado'
);

SELECT throws_ok(
  $$ INSERT INTO proyecto_seguimiento (proyecto_id, nota)
     VALUES ('50000000-0000-0000-0000-000000001541', 'Nota tardia') $$,
  '55000', NULL,
  'no se anota en la bitacora de un proyecto cancelado'
);

SELECT throws_ok(
  $$ INSERT INTO proyecto_hitos (proyecto_id, nombre, fecha_prevista)
     VALUES ('50000000-0000-0000-0000-000000001541', 'Hito nuevo', CURRENT_DATE) $$,
  '55000', NULL,
  'no se agrega un hito a un proyecto cancelado'
);

SELECT throws_ok(
  $$ UPDATE proyecto_hitos SET fecha_real = CURRENT_DATE WHERE id = 'b0000000-0000-0000-0000-000000001541' $$,
  '55000', NULL,
  'no se marca cumplido un hito de un proyecto cancelado'
);

SELECT throws_ok(
  $$ DELETE FROM proyecto_hitos WHERE id = 'b0000000-0000-0000-0000-000000001541' $$,
  '55000', NULL,
  'no se borra un hito de un proyecto cancelado'
);

SELECT throws_ok(
  $$ INSERT INTO proyecto_personal (proyecto_id, perfil_id)
     VALUES ('50000000-0000-0000-0000-000000001541', '00000000-0000-0000-0000-000000015411') $$,
  '55000', NULL,
  'no se agrega a nadie al equipo de un proyecto cancelado'
);

SELECT throws_ok(
  $$ DELETE FROM proyecto_personal WHERE proyecto_id = '50000000-0000-0000-0000-000000001541' $$,
  '55000', NULL,
  'no se quita a nadie del equipo de un proyecto cancelado'
);

SELECT throws_ok(
  $$ UPDATE proyecto_insumos SET cantidad = 20 WHERE id = 'a0000000-0000-0000-0000-000000001541' $$,
  '55000', NULL,
  'no se corrige un insumo previsto de un proyecto cancelado'
);

SELECT throws_ok(
  $$ SELECT public.fn_pasar_insumo_de_proyecto_a_jornada(
       'a0000000-0000-0000-0000-000000001541', '40000000-0000-0000-0000-000000001541') $$,
  '55000', NULL,
  'no se pasa a una jornada un insumo de un proyecto cancelado'
);

-- ============================================================================
-- Jornadas: no se asocian ni se sacan; lo demas de la jornada sigue abierto
-- ============================================================================
SELECT throws_ok(
  $$ UPDATE jornadas SET proyecto_id = '50000000-0000-0000-0000-000000001541'
      WHERE id = '40000000-0000-0000-0000-000000001542' $$,
  '55000', NULL,
  'no se pasa una jornada a un proyecto cancelado'
);

-- Pasarla a otro proyecto, no a NULL: dejarla sin proyecto ya lo rechaza la 00169 por su cuenta.
SELECT throws_ok(
  $$ UPDATE jornadas SET proyecto_id = '50000000-0000-0000-0000-000000001542'
      WHERE id = '40000000-0000-0000-0000-000000001541' $$,
  '55000', NULL,
  'no se saca una jornada de un proyecto cancelado'
);

SELECT throws_ok(
  $$ INSERT INTO jornadas (nombre, fecha, comunidad_id, responsable_id, proyecto_id)
     VALUES ('Jornada nueva 1541', CURRENT_DATE + 40, '10000000-0000-0000-0000-000000001541',
             '00000000-0000-0000-0000-000000015411', '50000000-0000-0000-0000-000000001541') $$,
  '55000', NULL,
  'no se crea una jornada dentro de un proyecto cancelado'
);

SELECT lives_ok(
  $$ UPDATE jornadas SET nombre = 'Jornada renombrada 1541', proyecto_id = '50000000-0000-0000-0000-000000001541'
      WHERE id = '40000000-0000-0000-0000-000000001541' $$,
  'la jornada de un proyecto cancelado se sigue editando si no cambia de proyecto'
);

-- ============================================================================
-- Un proyecto abierto no se bloquea
-- ============================================================================
SELECT lives_ok(
  $$ UPDATE proyectos SET nombre = 'Proyecto abierto renombrado' WHERE id = '50000000-0000-0000-0000-000000001542' $$,
  'un proyecto que no esta cancelado se sigue editando'
);

SELECT lives_ok(
  $$ INSERT INTO proyecto_hitos (proyecto_id, nombre, fecha_prevista)
     VALUES ('50000000-0000-0000-0000-000000001542', 'Hito abierto', CURRENT_DATE) $$,
  'y se le siguen agregando hitos'
);

SELECT lives_ok(
  $$ UPDATE jornadas SET proyecto_id = '50000000-0000-0000-0000-000000001542'
      WHERE id = '40000000-0000-0000-0000-000000001542' $$,
  'y se le siguen pasando jornadas'
);

-- ============================================================================
-- Privilegios
-- ============================================================================
RESET ROLE;

SELECT is(
  has_function_privilege('authenticated', 'public.fn_proyecto_de_la_fila_no_esta_cancelado()', 'EXECUTE'),
  false,
  'nadie llama directo a la funcion DEFINER del trigger'
);

SELECT is(
  (SELECT count(*) FROM proyecto_hitos WHERE proyecto_id = '50000000-0000-0000-0000-000000001541')::int, 1,
  'el hito del proyecto cancelado sigue ahi, sin tocar'
);

SELECT * FROM finish();
ROLLBACK;
