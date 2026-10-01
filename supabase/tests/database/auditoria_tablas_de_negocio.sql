-- Pruebas de la 00152: la bitacora registra todas las tablas de negocio. Corre con:
-- supabase test db
--
-- Ningun dato real.

BEGIN;

SELECT plan(6);

-- Desde la 00169 toda jornada nueva lleva proyecto. Estas pruebas no tratan de proyectos: sus
-- jornadas reciben uno de prueba como DEFAULT de la columna, que el ROLLBACK del final deshace.
INSERT INTO proyectos (id, nombre) VALUES
  ('5f000000-0000-0000-0000-000000000169', 'Proyecto de prueba 00169');
ALTER TABLE jornadas ALTER COLUMN proyecto_id SET DEFAULT '5f000000-0000-0000-0000-000000000169';

INSERT INTO comunidades (id, municipio_id, nombre) VALUES
  ('10000000-0000-0000-0000-000000001521', 101, 'Comunidad de prueba 1521');

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000015211', 'admin1521@test.ecopac.local');

ALTER TABLE perfiles DISABLE TRIGGER USER;
UPDATE perfiles SET rol = 'administrador' WHERE id = '00000000-0000-0000-0000-000000015211';
ALTER TABLE perfiles ENABLE TRIGGER USER;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000015211';

INSERT INTO jornadas (id, nombre, fecha, comunidad_id, responsable_id) VALUES
  ('40000000-0000-0000-0000-000000001521', 'Jornada 1521', CURRENT_DATE + 30,
   '10000000-0000-0000-0000-000000001521', '00000000-0000-0000-0000-000000015211');

UPDATE jornadas SET nombre = 'Jornada 1521 corregida'
 WHERE id = '40000000-0000-0000-0000-000000001521';

INSERT INTO donantes (id, nombre, tipo) VALUES
  ('d0000000-0000-0000-0000-000000015211', 'Donante 1521', 'organizacion');

INSERT INTO perfil_especialidad (perfil_id, nombre_especialidad) VALUES
  ('00000000-0000-0000-0000-000000015211', 'Especialidad 1521');

RESET ROLE;

SELECT is(
  (SELECT count(*)::int FROM eventos_auditoria
    WHERE tabla_afectada = 'jornadas' AND fila_id = '40000000-0000-0000-0000-000000001521'),
  2,
  'crear y corregir una jornada deja dos eventos en la bitacora'
);

SELECT is(
  (SELECT realizado_por FROM eventos_auditoria
    WHERE tabla_afectada = 'jornadas' AND operacion = 'actualizacion'
      AND fila_id = '40000000-0000-0000-0000-000000001521'),
  '00000000-0000-0000-0000-000000015211'::uuid,
  'con quien lo hizo'
);

SELECT is(
  (SELECT valores_nuevos ->> 'nombre' FROM eventos_auditoria
    WHERE tabla_afectada = 'jornadas' AND operacion = 'actualizacion'
      AND fila_id = '40000000-0000-0000-0000-000000001521'),
  'Jornada 1521 corregida',
  'y el valor nuevo'
);

SELECT is(
  (SELECT count(*)::int FROM eventos_auditoria
    WHERE tabla_afectada = 'donantes' AND fila_id = 'd0000000-0000-0000-0000-000000015211'),
  1,
  'dar de alta un donante tambien queda registrado'
);

SELECT is(
  (SELECT count(*)::int FROM eventos_auditoria
    WHERE tabla_afectada = 'perfil_especialidad'
      AND fila_id = '00000000-0000-0000-0000-000000015211'),
  1,
  'una tabla sin columna id se registra con la columna que la identifica (el perfil)'
);

SELECT is(
  (SELECT count(*)::int FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE t.tgrelid = 'public.existencias'::regclass AND p.proname = 'registrar_evento_auditoria'),
  0,
  'existencias no se audita: es un saldo derivado de movimientos que ya se auditan'
);

SELECT * FROM finish();
ROLLBACK;
