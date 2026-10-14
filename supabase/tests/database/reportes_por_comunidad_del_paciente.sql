-- Pruebas de la 00155: los reportes cuentan por la comunidad de donde viene el paciente, y por la
-- de la jornada solo si el paciente no tiene una asignada. Corre con: supabase test db
--
-- Una jornada en la comunidad A atiende a tres pacientes: uno de la comunidad B, uno de A y uno
-- sin comunidad (cuenta en A, la de la jornada). Datos inventados.

BEGIN;

SELECT plan(10);

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
-- Setup
-- ============================================================================
INSERT INTO comunidades (id, municipio_id, nombre) VALUES
  ('10000000-0000-0000-0000-000000155001', 101, 'Comunidad A 155'),
  ('10000000-0000-0000-0000-000000155002', 101, 'Comunidad B 155');

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000155001', 'admin155@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000155002', 'medico155@test.ecopac.local');

ALTER TABLE perfiles DISABLE TRIGGER USER;
UPDATE perfiles SET rol = 'administrador' WHERE id = '00000000-0000-0000-0000-000000155001';
UPDATE perfiles SET rol = 'medico'        WHERE id = '00000000-0000-0000-0000-000000155002';
ALTER TABLE perfiles ENABLE TRIGGER USER;

INSERT INTO jornadas (id, nombre, fecha, comunidad_id, responsable_id) VALUES
  ('40000000-0000-0000-0000-000000155001', 'Jornada 155', CURRENT_DATE + 1,
   '10000000-0000-0000-0000-000000155001', '00000000-0000-0000-0000-000000155001'),
  ('40000000-0000-0000-0000-000000155002', 'Jornada vacia 155', CURRENT_DATE + 1,
   '10000000-0000-0000-0000-000000155001', '00000000-0000-0000-0000-000000155001');

INSERT INTO pacientes (id, nombres, apellidos, fecha_nacimiento, sexo, comunidad_id, idioma) VALUES
  ('20000000-0000-0000-0000-000000155001', 'Uno', 'Inventado', '1990-01-01', 'Femenino',
   '10000000-0000-0000-0000-000000155002', 'espanol'),
  ('20000000-0000-0000-0000-000000155002', 'Dos', 'Inventado', '1985-01-01', 'Masculino',
   '10000000-0000-0000-0000-000000155001', 'espanol'),
  ('20000000-0000-0000-0000-000000155003', 'Tres', 'Inventado', '2000-01-01', 'Femenino',
   NULL, 'espanol');

-- Una atencion solo se registra en una jornada en curso.
UPDATE jornadas SET estado = 'en curso' WHERE id = '40000000-0000-0000-0000-000000155001';

INSERT INTO atenciones (jornada_id, paciente_id) VALUES
  ('40000000-0000-0000-0000-000000155001', '20000000-0000-0000-0000-000000155001'),
  ('40000000-0000-0000-0000-000000155001', '20000000-0000-0000-0000-000000155002'),
  ('40000000-0000-0000-0000-000000155001', '20000000-0000-0000-0000-000000155003');

-- ============================================================================
-- Privilegios
-- ============================================================================
SELECT is(
  has_table_privilege('anon', 'public.vista_reporte_impacto_por_comunidad', 'SELECT'), false,
  'anon no lee la vista por comunidad'
);

-- ============================================================================
-- Administrador
-- ============================================================================
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000155001';

SELECT is(
  (SELECT pacientes_atendidos FROM vista_reporte_impacto_por_comunidad
    WHERE jornada_id = '40000000-0000-0000-0000-000000155001'
      AND comunidad_id = '10000000-0000-0000-0000-000000155002')::int,
  1,
  'el paciente de la comunidad B cuenta en B, aunque la jornada fue en A'
);

SELECT is(
  (SELECT pacientes_atendidos FROM vista_reporte_impacto_por_comunidad
    WHERE jornada_id = '40000000-0000-0000-0000-000000155001'
      AND comunidad_id = '10000000-0000-0000-0000-000000155001')::int,
  2,
  'el de A y el que no tiene comunidad cuentan en A, la de la jornada'
);

SELECT is(
  (SELECT sum(pacientes_atendidos) FROM vista_reporte_impacto_por_comunidad
    WHERE jornada_id = '40000000-0000-0000-0000-000000155001')::int,
  (SELECT pacientes_atendidos FROM vista_reporte_impacto
    WHERE jornada_id = '40000000-0000-0000-0000-000000155001')::int,
  'sumadas, las filas de una jornada dan lo mismo que vista_reporte_impacto'
);

SELECT is(
  (SELECT count(*) FROM vista_reporte_impacto_por_comunidad
    WHERE jornada_id = '40000000-0000-0000-0000-000000155002')::int,
  1,
  'una jornada sin atenciones sigue apareciendo, una sola vez'
);

SELECT is(
  (SELECT comunidad_id FROM vista_reporte_impacto_por_comunidad
    WHERE jornada_id = '40000000-0000-0000-0000-000000155002'),
  '10000000-0000-0000-0000-000000155001'::uuid,
  'y con la comunidad de la jornada'
);

SELECT is(
  (SELECT pacientes FROM fn_reporte_pacientes_atendidos('comunidad', '40000000-0000-0000-0000-000000155001')
    WHERE grupo_id = '10000000-0000-0000-0000-000000155002'),
  1,
  'el reporte de pacientes agrupa por la comunidad del paciente'
);

SELECT is(
  (SELECT sum(pacientes) FROM fn_reporte_pacientes_atendidos(
     'jornada', NULL, '10000000-0000-0000-0000-000000155002'))::int,
  1,
  'y filtrar por la comunidad B trae solo al paciente de B'
);

SELECT is(
  (SELECT sum(pacientes) FROM fn_reporte_pacientes_atendidos(
     'jornada', NULL, '10000000-0000-0000-0000-000000155001'))::int,
  2,
  'filtrar por A trae al de A y al que no tiene comunidad'
);

-- ============================================================================
-- Medico: no lee los agregados (misma guarda que vista_reporte_impacto)
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000155002';

SELECT is(
  (SELECT count(*) FROM vista_reporte_impacto_por_comunidad)::int,
  0,
  'el medico no ve la vista por comunidad'
);

SELECT * FROM finish();
ROLLBACK;
