-- Pruebas de las politicas RLS de jornadas, jornada_personal, historiales de estado
-- y proyectos (issue #90, migracion 00039). Corre con:
-- supabase test db
--
-- Mismo patron que las suites de #87/#88: SET LOCAL ROLE authenticated +
-- SET LOCAL request.jwt.claim.sub simula un usuario de cada rol. Los fixtures se
-- insertan como postgres (superusuario, bypasea RLS) antes de impersonar.

BEGIN;

SELECT plan(28);

-- ============================================================================
-- Setup: una comunidad, un usuario de cada rol, dos jornadas (una con personal
-- asignado y otra libre) y un proyecto.
-- ============================================================================
INSERT INTO comunidades (id, municipio_id, nombre) VALUES
  ('10000000-0000-0000-0000-000000000090', 101, 'Comunidad de prueba 90');

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000000901', 'admin90@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000000902', 'junta90@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000000903', 'socio90@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000000904', 'medico90@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000000905', 'voluntario90@test.ecopac.local');

-- DISABLE TRIGGER USER (no un nombre puntual): si la 00031 (issue #87, trigger que
-- bloquea el auto-cambio de rol) todavia no esta mergeada cuando esto corre, un
-- nombre puntual fallaria con "does not exist". Mismo criterio defensivo que #88.
ALTER TABLE perfiles DISABLE TRIGGER USER;

UPDATE perfiles SET rol = 'administrador' WHERE id = '00000000-0000-0000-0000-000000000901';
UPDATE perfiles SET rol = 'junta directiva' WHERE id = '00000000-0000-0000-0000-000000000902';
UPDATE perfiles SET rol = 'socio fundador' WHERE id = '00000000-0000-0000-0000-000000000903';
UPDATE perfiles SET rol = 'medico' WHERE id = '00000000-0000-0000-0000-000000000904';
-- voluntario90 se queda con el rol por defecto (voluntario general).

ALTER TABLE perfiles ENABLE TRIGGER USER;

-- Jornada A: con medico y voluntario asignados. Jornada B: sin asignar a nadie.
-- responsable_id es NOT NULL (00012); fecha futura por el check de 00012.
INSERT INTO jornadas (id, nombre, fecha, comunidad_id, responsable_id) VALUES
  ('40000000-0000-0000-0000-000000000a01', 'Jornada asignada 90', CURRENT_DATE + 30,
   '10000000-0000-0000-0000-000000000090', '00000000-0000-0000-0000-000000000901'),
  ('40000000-0000-0000-0000-000000000a02', 'Jornada libre 90', CURRENT_DATE + 31,
   '10000000-0000-0000-0000-000000000090', '00000000-0000-0000-0000-000000000901');

INSERT INTO jornada_personal (jornada_id, perfil_id, rol_en_jornada, hora_inicio, hora_fin) VALUES
  ('40000000-0000-0000-0000-000000000a01', '00000000-0000-0000-0000-000000000904', 'medico', '08:00', '13:00'),
  ('40000000-0000-0000-0000-000000000a01', '00000000-0000-0000-0000-000000000905', 'voluntario general', '08:00', '13:00');

INSERT INTO proyectos (id, nombre) VALUES
  ('50000000-0000-0000-0000-000000000901', 'Proyecto de prueba 90');

-- ============================================================================
-- administrador
-- ============================================================================
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000901';

SELECT lives_ok(
  $$ INSERT INTO jornadas (id, nombre, fecha, comunidad_id, responsable_id)
     VALUES ('40000000-0000-0000-0000-000000000a03', 'Jornada de admin 90', CURRENT_DATE + 32,
             '10000000-0000-0000-0000-000000000090', '00000000-0000-0000-0000-000000000901') $$,
  'administrador puede crear jornadas'
);

SELECT lives_ok(
  $$ UPDATE jornadas SET estado = 'en curso' WHERE id = '40000000-0000-0000-0000-000000000a01' $$,
  'administrador puede cambiar el estado de una jornada'
);

-- 2 filas: el alta del fixture (estado_anterior NULL) + el cambio a en_curso.
SELECT ok(
  (SELECT count(*) FROM jornada_estado_historial WHERE jornada_id = '40000000-0000-0000-0000-000000000a01') = 2,
  'el trigger audito el alta y el cambio de estado'
);

SELECT lives_ok(
  $$ INSERT INTO proyectos (id, nombre) VALUES ('50000000-0000-0000-0000-000000000902', 'Proyecto de admin 90') $$,
  'administrador puede crear proyectos'
);

SELECT lives_ok(
  $$ UPDATE proyectos SET nombre = 'Proyecto editado 90' WHERE id = '50000000-0000-0000-0000-000000000901' $$,
  'administrador puede editar proyectos'
);

-- rol_en_jornada es del tipo rol_usuario (00012), asi que solo admite los cinco valores del
-- enum de la 00001. Decia 'coordinador', que no existe y nunca existio: por eso esta suite fallaba
-- entera antes de correr una sola asercion. El perfil ...902 es junta directiva, que es lo que el
-- comentario del conteo de mas abajo ya daba por hecho.
SELECT lives_ok(
  $$ INSERT INTO jornada_personal (jornada_id, perfil_id, rol_en_jornada, hora_inicio, hora_fin)
     VALUES ('40000000-0000-0000-0000-000000000a02', '00000000-0000-0000-0000-000000000902', 'junta directiva', '08:00', '13:00') $$,
  'administrador puede asignar personal a una jornada'
);

-- 42501 (sin privilegio INSERT sobre la tabla) y no una violacion de politica RLS:
-- no se otorga GRANT de escritura a nadie, el intento muere a nivel de privilegios.
SELECT throws_ok(
  $$ INSERT INTO jornada_estado_historial (jornada_id, estado_nuevo)
     VALUES ('40000000-0000-0000-0000-000000000a01', 'finalizada') $$,
  '42501',
  NULL,
  'ni administrador puede escribir el historial a mano: solo lo escribe el trigger'
);

-- ============================================================================
-- junta directiva: lectura de jornadas y proyectos, nada mas
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000902';

SELECT ok(
  (SELECT count(*) FROM jornadas) >= 2,
  'junta directiva puede leer jornadas'
);

SELECT ok(
  (SELECT count(*) FROM proyectos) >= 1,
  'junta directiva puede leer proyectos'
);

SELECT throws_ok(
  $$ INSERT INTO jornadas (nombre, fecha, comunidad_id, responsable_id)
     VALUES ('Jornada de junta 90', CURRENT_DATE + 33,
             '10000000-0000-0000-0000-000000000090', '00000000-0000-0000-0000-000000000902') $$,
  '42501',
  NULL,
  'junta directiva no puede crear jornadas'
);

-- Un UPDATE bloqueado por RLS no tira error: afecta 0 filas. Se prueba con RETURNING.
SELECT is_empty(
  $$ UPDATE proyectos SET nombre = 'Intento de junta' WHERE id = '50000000-0000-0000-0000-000000000901' RETURNING id $$,
  'junta directiva no puede editar proyectos'
);

SELECT ok(
  (SELECT count(*) FROM jornada_estado_historial) = 0,
  'junta directiva no lee el historial de estados (solo administrador)'
);

-- ============================================================================
-- socio fundador: mismos permisos que junta directiva (issue #404, es_consultivo()).
-- La 00039 original decia "fuera de las cinco tablas, lectura literal del DoD" -- ese
-- comentario quedo corregido en la 00078, que es la que este bloque verifica.
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000903';

SELECT ok(
  (SELECT count(*) FROM jornadas) >= 2,
  'socio fundador lee jornadas, igual que junta directiva'
);

SELECT ok(
  (SELECT count(*) FROM proyectos) >= 1,
  'socio fundador lee proyectos, igual que junta directiva'
);

SELECT throws_ok(
  $$ INSERT INTO jornadas (nombre, fecha, comunidad_id, responsable_id)
     VALUES ('Jornada de socio 90', CURRENT_DATE + 33,
             '10000000-0000-0000-0000-000000000090', '00000000-0000-0000-0000-000000000902') $$,
  '42501',
  NULL,
  'socio fundador no puede crear jornadas'
);

SELECT is_empty(
  $$ UPDATE proyectos SET nombre = 'Intento de socio' WHERE id = '50000000-0000-0000-0000-000000000901' RETURNING id $$,
  'socio fundador no puede editar proyectos'
);

SELECT ok(
  (SELECT count(*) FROM jornada_estado_historial) = 0,
  'socio fundador no lee el historial de estados (solo administrador)'
);

SELECT throws_ok(
  $$ INSERT INTO proyectos (nombre) VALUES ('Proyecto de socio 90') $$,
  '42501',
  NULL,
  'socio fundador no puede crear proyectos'
);

-- ============================================================================
-- medico: solo lee la jornada donde esta asignado; no crea ni cambia estados
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000904';

SELECT ok(
  (SELECT count(*) FROM jornadas WHERE id = '40000000-0000-0000-0000-000000000a01') = 1,
  'medico lee la jornada donde esta asignado'
);

SELECT ok(
  (SELECT count(*) FROM jornadas WHERE id <> '40000000-0000-0000-0000-000000000a01') = 0,
  'medico no lee jornadas donde no esta asignado'
);

SELECT throws_ok(
  $$ INSERT INTO jornadas (nombre, fecha, comunidad_id, responsable_id)
     VALUES ('Jornada de medico 90', CURRENT_DATE + 34,
             '10000000-0000-0000-0000-000000000090', '00000000-0000-0000-0000-000000000904') $$,
  '42501',
  NULL,
  'medico no puede crear jornadas'
);

SELECT is_empty(
  $$ UPDATE jornadas SET estado = 'finalizada' WHERE id = '40000000-0000-0000-0000-000000000a01' RETURNING id $$,
  'medico no puede cambiar el estado de una jornada'
);

-- Solo su propia asignacion: en los fixtures hay 3 filas (medico y voluntario en A,
-- junta en B agregada por admin), pero el medico solo ve la suya.
SELECT ok(
  (SELECT count(*) FROM jornada_personal) = 1,
  'medico solo ve su propia asignacion de personal'
);

SELECT ok(
  (SELECT count(*) FROM proyectos) = 0,
  'medico no lee proyectos'
);

-- ============================================================================
-- voluntario general: mismas restricciones de lectura que medico, sin escritura
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000905';

SELECT ok(
  (SELECT count(*) FROM jornadas WHERE id = '40000000-0000-0000-0000-000000000a01') = 1,
  'voluntario lee la jornada donde esta asignado'
);

SELECT ok(
  (SELECT count(*) FROM jornadas WHERE id <> '40000000-0000-0000-0000-000000000a01') = 0,
  'voluntario no lee jornadas donde no esta asignado'
);

SELECT throws_ok(
  $$ INSERT INTO jornada_personal (jornada_id, perfil_id, rol_en_jornada, hora_inicio, hora_fin)
     VALUES ('40000000-0000-0000-0000-000000000a02', '00000000-0000-0000-0000-000000000905', 'voluntario general', '08:00', '13:00') $$,
  '42501',
  NULL,
  'voluntario no puede asignar personal'
);

SELECT ok(
  (SELECT count(*) FROM jornada_estado_historial) = 0,
  'voluntario no lee el historial de estados'
);

SELECT * FROM finish();
ROLLBACK;
