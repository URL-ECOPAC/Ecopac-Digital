-- Pruebas de las politicas RLS de donantes, donaciones y donacion_detalle (issue #403).
-- Corre con: supabase test db
--
-- Antes de la 00083 estas tres tablas estaban denegadas a todos los roles, incluido
-- administrador (politicas_rls_catalogos_y_seguimiento.sql documentaba el vacio y las dejaba
-- fuera a proposito para no tumbar el CI de otra issue). Esta suite es la cobertura que faltaba.
--
-- Mismo patron que las suites vecinas: SET LOCAL ROLE authenticated + SET LOCAL
-- request.jwt.claim.sub simula cada rol. El setup corre como el rol dueno, exento de RLS.
--
-- Ningun dato real: donante, donacion y detalle son inventados.

BEGIN;

SELECT plan(29);

-- ============================================================================
-- Setup: cuatro perfiles (administrador, junta directiva, socio fundador, medico) y una
-- donacion base ya registrada, para que haya algo que leer antes de probar el INSERT.
-- ============================================================================
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000000403', 'admin403@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000000404', 'junta403@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000000405', 'socio403@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000000406', 'medico403@test.ecopac.local');

ALTER TABLE perfiles DISABLE TRIGGER USER;

UPDATE perfiles SET rol = 'administrador' WHERE id = '00000000-0000-0000-0000-000000000403';
UPDATE perfiles SET rol = 'junta directiva' WHERE id = '00000000-0000-0000-0000-000000000404';
UPDATE perfiles SET rol = 'socio fundador' WHERE id = '00000000-0000-0000-0000-000000000405';
UPDATE perfiles SET rol = 'medico' WHERE id = '00000000-0000-0000-0000-000000000406';

ALTER TABLE perfiles ENABLE TRIGGER USER;

INSERT INTO donantes (id, nombre, tipo) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'Donante de prueba 403', 'organizacion');

INSERT INTO donaciones (id, donante_id, tipo, registrado_por) VALUES
  ('d0000000-0000-0000-0000-000000000101', 'd0000000-0000-0000-0000-000000000001',
   'medicamentos', '00000000-0000-0000-0000-000000000403');

INSERT INTO donacion_detalle (id, donacion_id, descripcion) VALUES
  ('d0000000-0000-0000-0000-000000000201', 'd0000000-0000-0000-0000-000000000101',
   'Renglon de prueba 403');

SET LOCAL ROLE authenticated;

-- ============================================================================
-- administrador: lee y escribe las tres tablas, incluida la anulacion
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000403';

SELECT ok(
  (SELECT count(*) FROM donantes) > 0,
  'administrador lee donantes'
);

SELECT ok(
  (SELECT count(*) FROM donaciones) > 0,
  'administrador lee donaciones'
);

SELECT ok(
  (SELECT count(*) FROM donacion_detalle) > 0,
  'administrador lee donacion_detalle'
);

SELECT lives_ok(
  $$ INSERT INTO donantes (nombre, tipo) VALUES ('Donante nuevo 403', 'persona') $$,
  'administrador registra un donante'
);

SELECT lives_ok(
  $$ INSERT INTO donaciones (id, donante_id, tipo, registrado_por)
     VALUES ('d0000000-0000-0000-0000-000000000102', 'd0000000-0000-0000-0000-000000000001',
             'insumos', '00000000-0000-0000-0000-000000000403') $$,
  'administrador registra una donacion'
);

SELECT lives_ok(
  $$ INSERT INTO donacion_detalle (donacion_id, descripcion)
     VALUES ('d0000000-0000-0000-0000-000000000102', 'Renglon 2 de prueba 403') $$,
  'administrador registra un renglon de detalle'
);

SELECT lives_ok(
  $$ UPDATE donaciones
     SET estado = 'anulada', motivo_anulacion = 'Prueba de anulacion 403',
         anulada_por = '00000000-0000-0000-0000-000000000403', anulada_en = NOW()
     WHERE id = 'd0000000-0000-0000-0000-000000000101' $$,
  'administrador anula una donacion'
);

-- ============================================================================
-- junta directiva: lee las tres tablas, no escribe en ninguna
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000404';

SELECT ok(
  (SELECT count(*) FROM donantes) > 0,
  'junta directiva lee donantes'
);

SELECT ok(
  (SELECT count(*) FROM donaciones) > 0,
  'junta directiva lee donaciones'
);

SELECT ok(
  (SELECT count(*) FROM donacion_detalle) > 0,
  'junta directiva lee donacion_detalle'
);

SELECT throws_ok(
  $$ INSERT INTO donantes (nombre, tipo) VALUES ('Donante de junta 403', 'persona') $$,
  '42501',
  NULL,
  'junta directiva no puede registrar un donante'
);

SELECT throws_ok(
  $$ INSERT INTO donaciones (donante_id, tipo, registrado_por)
     VALUES ('d0000000-0000-0000-0000-000000000001', 'dinero',
             '00000000-0000-0000-0000-000000000404') $$,
  '42501',
  NULL,
  'junta directiva no puede registrar una donacion'
);

SELECT throws_ok(
  $$ INSERT INTO donacion_detalle (donacion_id, descripcion)
     VALUES ('d0000000-0000-0000-0000-000000000102', 'Intento de junta 403') $$,
  '42501',
  NULL,
  'junta directiva no puede registrar un renglon de detalle'
);

-- Un UPDATE bloqueado por RLS no lanza excepcion: la clausula USING excluye la fila y el
-- UPDATE corre sin afectar nada (mismo patron que politicas_rls_jornadas_proyectos.sql).
SELECT is_empty(
  $$ UPDATE donaciones
     SET estado = 'anulada', motivo_anulacion = 'Intento de junta 403',
         anulada_por = '00000000-0000-0000-0000-000000000404', anulada_en = NOW()
     WHERE id = 'd0000000-0000-0000-0000-000000000102'
     RETURNING id $$,
  'junta directiva no puede anular una donacion'
);

-- ============================================================================
-- socio fundador: identico a junta directiva (es_consultivo() trata a los dos igual)
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000405';

SELECT ok(
  (SELECT count(*) FROM donantes) > 0,
  'socio fundador lee donantes'
);

SELECT ok(
  (SELECT count(*) FROM donaciones) > 0,
  'socio fundador lee donaciones'
);

SELECT ok(
  (SELECT count(*) FROM donacion_detalle) > 0,
  'socio fundador lee donacion_detalle'
);

SELECT throws_ok(
  $$ INSERT INTO donantes (nombre, tipo) VALUES ('Donante de socio 403', 'persona') $$,
  '42501',
  NULL,
  'socio fundador no puede registrar un donante'
);

SELECT throws_ok(
  $$ INSERT INTO donaciones (donante_id, tipo, registrado_por)
     VALUES ('d0000000-0000-0000-0000-000000000001', 'servicios',
             '00000000-0000-0000-0000-000000000405') $$,
  '42501',
  NULL,
  'socio fundador no puede registrar una donacion'
);

SELECT throws_ok(
  $$ INSERT INTO donacion_detalle (donacion_id, descripcion)
     VALUES ('d0000000-0000-0000-0000-000000000102', 'Intento de socio 403') $$,
  '42501',
  NULL,
  'socio fundador no puede registrar un renglon de detalle'
);

SELECT is_empty(
  $$ UPDATE donaciones
     SET estado = 'anulada', motivo_anulacion = 'Intento de socio 403',
         anulada_por = '00000000-0000-0000-0000-000000000405', anulada_en = NOW()
     WHERE id = 'd0000000-0000-0000-0000-000000000102'
     RETURNING id $$,
  'socio fundador no puede anular una donacion'
);

-- ============================================================================
-- medico: ni lectura, no es rol de gobernanza ni de administracion
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000406';

SELECT is(
  (SELECT count(*)::int FROM donantes), 0,
  'medico no lee donantes'
);

SELECT is(
  (SELECT count(*)::int FROM donaciones), 0,
  'medico no lee donaciones'
);

SELECT is(
  (SELECT count(*)::int FROM donacion_detalle), 0,
  'medico no lee donacion_detalle'
);

-- ============================================================================
-- donaciones.registrar concedido puntualmente a medico (issue #409): el INSERT, antes
-- exclusivo de administrador, ahora se permite. Con RETURNING a proposito: Postgres exige que
-- la fila recien insertada tambien pase una politica de SELECT para devolverla, que es el
-- patron real de supabase-js (`.insert(...).select()`, usado por registrarDonante() en
-- packages/shared/donaciones/donantes.api.js). Sin RETURNING, un INSERT a secas no habria
-- detectado que las politicas de SELECT de las tres tablas (00083) se quedaban cortas hasta
-- que la 00086 les agrego tambien tiene_permiso('donaciones.registrar').
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000403';

SELECT lives_ok(
  $$ INSERT INTO usuario_permiso (perfil_id, permiso_id, concedido, otorgado_por)
     SELECT '00000000-0000-0000-0000-000000000406', id, true, '00000000-0000-0000-0000-000000000403'
     FROM permisos WHERE clave = 'donaciones.registrar' $$,
  'administrador concede donaciones.registrar a medico406 (issue #409)'
);

SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000406';

SELECT lives_ok(
  $$ INSERT INTO donantes (nombre, tipo) VALUES ('Donante de medico con permiso 403', 'persona') RETURNING id $$,
  'medico con donaciones.registrar concedido puntualmente si puede registrar un donante (issue #409)'
);

SELECT lives_ok(
  $$ INSERT INTO donaciones (donante_id, tipo, registrado_por)
     VALUES ('d0000000-0000-0000-0000-000000000001', 'servicios', '00000000-0000-0000-0000-000000000406') RETURNING id $$,
  'medico con donaciones.registrar concedido puntualmente si puede registrar una donacion (issue #409)'
);

SELECT lives_ok(
  $$ INSERT INTO donacion_detalle (donacion_id, descripcion)
     VALUES ('d0000000-0000-0000-0000-000000000102', 'Renglon de medico con permiso 403') RETURNING id $$,
  'medico con donaciones.registrar concedido puntualmente si puede registrar un renglon de detalle (issue #409)'
);

-- El permiso tambien amplia el SELECT de las tres tablas (mismo OR que el INSERT): no es un
-- efecto colateral, es necesario para que el INSERT con RETURNING de arriba funcione.
SELECT ok(
  (SELECT count(*) FROM donantes) > 0,
  'medico con donaciones.registrar concedido puntualmente tambien puede leer donantes (issue #409)'
);

SELECT * FROM finish();

ROLLBACK;
