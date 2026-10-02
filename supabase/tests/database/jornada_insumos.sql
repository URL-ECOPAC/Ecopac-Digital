-- Pruebas de la 00151: insumos previstos por jornada y el paso de un insumo del proyecto a una
-- jornada. Corre con: supabase test db
--
-- Mismo patron que proyecto_insumos.sql. Ningun dato real.

BEGIN;

SELECT plan(11);

-- Desde la 00178 toda jornada nueva lleva una bodega movil. Estas pruebas no tratan de bodegas:
-- sus jornadas reciben una de prueba como DEFAULT de la columna, que el ROLLBACK del final deshace.
INSERT INTO bodegas (id, nombre, es_movil) VALUES
  ('5b000000-0000-0000-0000-000000000178', 'Bodega movil de prueba 00178', TRUE);
ALTER TABLE jornadas ALTER COLUMN botiquin_bodega_id SET DEFAULT '5b000000-0000-0000-0000-000000000178';

-- ============================================================================
-- Setup (como dueno, exento de RLS)
-- ============================================================================
INSERT INTO comunidades (id, municipio_id, nombre) VALUES
  ('10000000-0000-0000-0000-000000001511', 101, 'Comunidad de prueba 1511');

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000015111', 'admin1511@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000015112', 'medico1511@test.ecopac.local');

ALTER TABLE perfiles DISABLE TRIGGER USER;
UPDATE perfiles SET rol = 'administrador' WHERE id = '00000000-0000-0000-0000-000000015111';
UPDATE perfiles SET rol = 'medico'        WHERE id = '00000000-0000-0000-0000-000000015112';
ALTER TABLE perfiles ENABLE TRIGGER USER;

INSERT INTO proyectos (id, nombre) VALUES
  ('50000000-0000-0000-0000-000000001511', 'Proyecto 1511'),
  ('50000000-0000-0000-0000-000000001512', 'Otro proyecto 1511');

INSERT INTO jornadas (id, nombre, fecha, comunidad_id, responsable_id, proyecto_id) VALUES
  ('40000000-0000-0000-0000-000000001511', 'Jornada 1511', CURRENT_DATE + 30,
   '10000000-0000-0000-0000-000000001511', '00000000-0000-0000-0000-000000015111',
   '50000000-0000-0000-0000-000000001511'),
  ('40000000-0000-0000-0000-000000001512', 'Jornada de otro proyecto 1511', CURRENT_DATE + 31,
   '10000000-0000-0000-0000-000000001511', '00000000-0000-0000-0000-000000015111',
   '50000000-0000-0000-0000-000000001512');

-- El medico trabaja en la jornada: ve la jornada, y aun asi no debe ver sus insumos (dinero).
INSERT INTO jornada_personal (jornada_id, perfil_id, rol_en_jornada, hora_inicio, hora_fin) VALUES
  ('40000000-0000-0000-0000-000000001511', '00000000-0000-0000-0000-000000015112', 'medico', '08:00', '13:00');

INSERT INTO medicamentos (id, nombre, concentracion, presentacion_id, marca, tipo_articulo) VALUES
  ('90000000-0000-0000-0000-000000001511', 'Guantes 1511', 'talla M',
   (SELECT id FROM presentaciones ORDER BY nombre LIMIT 1), 'Generico', 'insumo');

-- Un insumo que se habia planeado a nivel proyecto, antes de la 00151.
INSERT INTO proyecto_insumos (id, proyecto_id, medicamento_id, cantidad, unidad, costo_unitario_estimado) VALUES
  ('a0000000-0000-0000-0000-000000001511', '50000000-0000-0000-0000-000000001511',
   '90000000-0000-0000-0000-000000001511', 40, 'cajas', 10.00);

SELECT is(
  has_table_privilege('anon', 'public.jornada_insumos', 'SELECT'), false,
  'anon no tiene ningun privilegio sobre jornada_insumos'
);

-- ============================================================================
-- Administradora: escribe y lee
-- ============================================================================
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000015111';

SELECT throws_ok(
  $$ SELECT fn_pasar_insumo_de_proyecto_a_jornada('a0000000-0000-0000-0000-000000001511',
                                                  '40000000-0000-0000-0000-000000001512') $$,
  '23514', NULL,
  'un insumo no pasa a una jornada de otro proyecto'
);

SELECT lives_ok(
  $$ SELECT fn_pasar_insumo_de_proyecto_a_jornada('a0000000-0000-0000-0000-000000001511',
                                                  '40000000-0000-0000-0000-000000001511') $$,
  'la administradora pasa un insumo del proyecto a una de sus jornadas'
);

SELECT is(
  (SELECT row(cantidad, unidad, costo_unitario_estimado)::text FROM jornada_insumos
    WHERE jornada_id = '40000000-0000-0000-0000-000000001511'),
  row(40, 'cajas'::varchar, 10.00::numeric)::text,
  'el insumo llega a la jornada con su cantidad, unidad y costo'
);

SELECT is(
  (SELECT count(*)::int FROM proyecto_insumos WHERE id = 'a0000000-0000-0000-0000-000000001511'),
  0,
  'y sale del proyecto: no queda planeado dos veces'
);

SELECT throws_ok(
  $$ INSERT INTO jornada_insumos (jornada_id, medicamento_id, cantidad, unidad)
     VALUES ('40000000-0000-0000-0000-000000001511', '90000000-0000-0000-0000-000000001511', 5, 'cajas') $$,
  '23505', NULL,
  'el mismo articulo no figura dos veces en una jornada'
);

SELECT throws_ok(
  $$ INSERT INTO jornada_insumos (jornada_id, medicamento_id, cantidad, unidad)
     VALUES ('40000000-0000-0000-0000-000000001512', '90000000-0000-0000-0000-000000001511', 0, 'cajas') $$,
  '23514', NULL,
  'la cantidad tiene que ser mayor que cero'
);

SELECT lives_ok(
  $$ UPDATE jornada_insumos SET cantidad = 60
      WHERE jornada_id = '40000000-0000-0000-0000-000000001511' $$,
  'la administradora corrige la cantidad prevista'
);

-- ============================================================================
-- Medico: ve la jornada, no sus insumos, y no escribe
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000015112';

SELECT is(
  (SELECT count(*)::int FROM jornada_insumos), 0,
  'el medico no lee los insumos previstos de su jornada (llevan costo)'
);

SELECT throws_ok(
  $$ INSERT INTO jornada_insumos (jornada_id, medicamento_id, cantidad, unidad)
     VALUES ('40000000-0000-0000-0000-000000001512', '90000000-0000-0000-0000-000000001511', 5, 'cajas') $$,
  '42501', NULL,
  'el medico no agrega insumos a una jornada'
);

-- ============================================================================
-- Borrar la jornada se lleva sus insumos
-- ============================================================================
RESET ROLE;
DELETE FROM jornadas WHERE id = '40000000-0000-0000-0000-000000001511';

SELECT is(
  (SELECT count(*)::int FROM jornada_insumos WHERE jornada_id = '40000000-0000-0000-0000-000000001511'),
  0,
  'al borrar una jornada sus insumos previstos se van con ella (ON DELETE CASCADE)'
);

SELECT * FROM finish();
ROLLBACK;
