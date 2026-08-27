-- Pruebas de fn_buscar_pacientes (issue #115, migracion 00068). Corre con: supabase test db
--
-- Mismo patron que conteo_atenciones_persona_por_jornada.sql (#175): SET LOCAL ROLE
-- authenticated + SET LOCAL request.jwt.claim.sub para simular cada rol, y una sola
-- transaccion con ROLLBACK final para no dejar rastro.
--
-- La comunidad 115-A tiene tres pacientes: uno con acentos (Maria Jose Perez Xoc), uno de
-- origen maya sin acentos (Marta Xiloj Tzul) y uno dado de baja (Ana Baja De Prueba) que debe
-- quedar excluido de toda busqueda pase lo que pase. La comunidad 115-B tiene un cuarto
-- paciente (Pedro Vasquez Lopez) que sirve para probar que el filtro de comunidad combinado
-- con nombre excluye correctamente a quien coincide por nombre pero no por comunidad.
--
-- Ningun dato real: nombres, comunidades y numeros de ficha son inventados.

BEGIN;

SELECT plan(15);

-- ============================================================================
-- Setup
-- ============================================================================
INSERT INTO comunidades (id, municipio_id, nombre) VALUES
  ('10000000-0000-0000-0000-000000000115', 101, 'Comunidad de prueba 115 A'),
  ('10000000-0000-0000-0000-000000000116', 101, 'Comunidad de prueba 115 B');

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000000115', 'admin115@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000000116', 'medico115@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000000117', 'voluntario115@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000000118', 'junta115@test.ecopac.local');

ALTER TABLE perfiles DISABLE TRIGGER trg_perfiles_impedir_cambio_de_rol_propio;
UPDATE perfiles SET rol = 'administrador' WHERE id = '00000000-0000-0000-0000-000000000115';
UPDATE perfiles SET rol = 'medico' WHERE id = '00000000-0000-0000-0000-000000000116';
UPDATE perfiles SET rol = 'voluntario general' WHERE id = '00000000-0000-0000-0000-000000000117';
UPDATE perfiles SET rol = 'junta directiva' WHERE id = '00000000-0000-0000-0000-000000000118';
ALTER TABLE perfiles ENABLE TRIGGER trg_perfiles_impedir_cambio_de_rol_propio;

INSERT INTO pacientes (id, nombres, apellidos, fecha_nacimiento, sexo, comunidad_id, telefono_contacto, idioma) VALUES
  ('20000000-0000-0000-0000-000000000115', 'María José', 'Pérez Xoc', '1990-01-01', 'Femenino',
   '10000000-0000-0000-0000-000000000115', '5555-0115', 'espanol'),
  ('20000000-0000-0000-0000-000000000116', 'Pedro', 'Vasquez López', '1985-05-05', 'Masculino',
   '10000000-0000-0000-0000-000000000116', '5555-0116', 'espanol'),
  ('20000000-0000-0000-0000-000000000117', 'Marta', 'Xiloj Tzul', '1958-03-12', 'Femenino',
   '10000000-0000-0000-0000-000000000115', '5555-0117', 'quiche');

-- Dado de baja: fn_buscar_pacientes lo excluye siempre (WHERE fecha_baja IS NULL, 00068).
INSERT INTO pacientes (
  id, nombres, apellidos, fecha_nacimiento, sexo, comunidad_id, telefono_contacto, idioma, fecha_baja
) VALUES
  ('20000000-0000-0000-0000-000000000118', 'Ana Baja', 'De Prueba', '1970-01-01', 'Femenino',
   '10000000-0000-0000-0000-000000000115', '5555-0118', 'espanol', CURRENT_DATE);

INSERT INTO expedientes (id, paciente_id, numero_ficha) VALUES
  ('40000000-0000-0000-0000-000000000115', '20000000-0000-0000-0000-000000000115', 'F-0115'),
  ('40000000-0000-0000-0000-000000000116', '20000000-0000-0000-0000-000000000116', 'F-0116'),
  ('40000000-0000-0000-0000-000000000117', '20000000-0000-0000-0000-000000000117', 'F-0117'),
  ('40000000-0000-0000-0000-000000000118', '20000000-0000-0000-0000-000000000118', 'F-0118');

-- ============================================================================
-- administrador: criterios 1, 2, 3, 4 y la exclusion de pacientes dados de baja
-- ============================================================================
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000115';

SELECT is(
  (SELECT apellidos FROM fn_buscar_pacientes('maria jose') WHERE paciente_id = '20000000-0000-0000-0000-000000000115'),
  'Pérez Xoc',
  'administrador: nombre sin acentos encuentra al paciente con acentos (criterio 1)'
);

SELECT is(
  (SELECT apellidos FROM fn_buscar_pacientes('maria jise') WHERE paciente_id = '20000000-0000-0000-0000-000000000115'),
  'Pérez Xoc',
  'administrador: una letra distinta igual encuentra al paciente (criterio 1)'
);

SELECT is(
  (SELECT count(*)::int FROM fn_buscar_pacientes(NULL, '10000000-0000-0000-0000-000000000115')),
  2,
  'administrador: filtro de comunidad sin termino lista solo esa comunidad, sin el dado de baja (criterio 2)'
);

SELECT is(
  (SELECT count(*)::int FROM fn_buscar_pacientes('perez', '10000000-0000-0000-0000-000000000116')),
  0,
  'administrador: nombre y comunidad combinados excluyen a quien coincide por nombre pero no por comunidad (criterio 2)'
);

SELECT is(
  (SELECT p.id FROM expedientes e JOIN pacientes p ON p.id = e.paciente_id WHERE e.numero_ficha = 'F-0115'),
  '20000000-0000-0000-0000-000000000115'::UUID,
  'numero_ficha (UNIQUE, 00009) resuelve al paciente exacto sin pasar por trigramas: el camino que usa buscarPacientePorFicha() en shared (criterio 3)'
);

SELECT is(
  (SELECT count(*)::int FROM expedientes WHERE numero_ficha = 'NO-EXISTE-115'),
  0,
  'una ficha inexistente no devuelve fila (buscarPacientePorFicha() la traduce a paciente: null, no a error)'
);

SELECT is(
  (SELECT count(*)::int FROM fn_buscar_pacientes('ana baja')),
  0,
  'administrador: un paciente dado de baja no aparece aunque el nombre coincida exacto'
);

-- Paginado (criterio 4): porPagina=1 sobre 2 coincidencias no debe repetir ni perder ninguna.
SELECT is(
  (SELECT paciente_id FROM fn_buscar_pacientes(NULL, '10000000-0000-0000-0000-000000000115', 1, 1)),
  '20000000-0000-0000-0000-000000000115'::UUID,
  'administrador: pagina 1 (porPagina=1) trae el primer paciente por orden alfabetico de apellido'
);

SELECT is(
  (SELECT paciente_id FROM fn_buscar_pacientes(NULL, '10000000-0000-0000-0000-000000000115', 2, 1)),
  '20000000-0000-0000-0000-000000000117'::UUID,
  'administrador: pagina 2 (porPagina=1) trae al segundo, no repite al primero'
);

SELECT is(
  (SELECT total FROM fn_buscar_pacientes(NULL, '10000000-0000-0000-0000-000000000115', 1, 1)),
  2::BIGINT,
  'administrador: total son las 2 coincidencias reales, no el porPagina de esta llamada'
);

SELECT is(
  (SELECT pagina FROM fn_buscar_pacientes(NULL, '10000000-0000-0000-0000-000000000115', 99, 1)),
  2,
  'administrador: pedir una pagina mas alla del final devuelve la ultima pagina real, no vacio'
);

-- ============================================================================
-- medico y voluntario general: mismo acceso de lectura que administrador (00032)
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000116';

SELECT is(
  (SELECT count(*)::int FROM fn_buscar_pacientes('maria jose')),
  1,
  'medico: ve resultados de busqueda por nombre igual que administrador'
);

SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000117';

SELECT is(
  (SELECT count(*)::int FROM fn_buscar_pacientes('maria jose')),
  1,
  'voluntario general: ve resultados de busqueda por nombre igual que administrador'
);

-- ============================================================================
-- junta directiva: sin politica de SELECT sobre pacientes (00032) -> cero filas sin error
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000118';

SELECT lives_ok(
  $$ SELECT * FROM fn_buscar_pacientes('maria jose') $$,
  'junta directiva: la llamada no falla (tiene EXECUTE); solo no trae nada'
);

SELECT is(
  (SELECT count(*)::int FROM fn_buscar_pacientes('maria jose')),
  0,
  'junta directiva: cero filas, no un error (00032 no le da SELECT sobre pacientes)'
);

SELECT * FROM finish();

ROLLBACK;
