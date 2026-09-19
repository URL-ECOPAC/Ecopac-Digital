-- Pruebas de limitacion de peticiones (issue #761, migracion 00134). Corre con: supabase test db
--
-- Tres capas, de la mas aislada a la mas real:
--   1. fn_verificar_y_contar_limite(): el nucleo, probado directo (superusuario bypasa el
--      REVOKE ALL FROM PUBLIC, igual que ya lo bypasa para RLS).
--   2. fn_verificar_limite_invitaciones(): que delega con el recurso/umbral de invitar-usuario
--      ya fijos.
--   3. fn_buscar_pacientes() de punta a punta, como authenticated con un JWT real: es la prueba
--      que demuestra que el CROSS JOIN _limite de la 00134 de verdad fuerza la evaluacion del
--      limite. Si alguien lo quita o lo cambia por una CTE sin referenciar, esta prueba tiene
--      que fallar.
--
-- Para no alargar el suite ni depender de pg_sleep, los casos de "ya se acerca al limite" y "la
-- ventana ya expiro" siembran la fila de limites_de_uso directamente con INSERT/UPDATE en vez de
-- repetir la llamada real decenas de veces.
--
-- Ningun dato real: correos y nombres son inventados.

BEGIN;

SELECT plan(19);

-- ============================================================================
-- Setup
-- ============================================================================
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000761001', 'admin761@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000761002', 'voluntario761a@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000761003', 'voluntario761b@test.ecopac.local');

ALTER TABLE perfiles DISABLE TRIGGER trg_perfiles_impedir_cambio_de_rol_propio;
UPDATE perfiles SET rol = 'administrador' WHERE id = '00000000-0000-0000-0000-000000761001';
ALTER TABLE perfiles ENABLE TRIGGER trg_perfiles_impedir_cambio_de_rol_propio;

-- ============================================================================
-- 1. fn_verificar_y_contar_limite(), aislada (recurso de prueba, umbral bajo: 3 cada minuto)
-- ============================================================================
SELECT lives_ok(
  $$ SELECT fn_verificar_y_contar_limite('recurso_prueba_761', '00000000-0000-0000-0000-000000761001'::uuid, 3, interval '1 minute') $$,
  'llamada 1 de 3, bajo el umbral, pasa'
);

SELECT lives_ok(
  $$ SELECT fn_verificar_y_contar_limite('recurso_prueba_761', '00000000-0000-0000-0000-000000761001'::uuid, 3, interval '1 minute') $$,
  'llamada 2 de 3, bajo el umbral, pasa'
);

SELECT lives_ok(
  $$ SELECT fn_verificar_y_contar_limite('recurso_prueba_761', '00000000-0000-0000-0000-000000761001'::uuid, 3, interval '1 minute') $$,
  'llamada 3 de 3, justo en el umbral, todavia pasa'
);

SELECT is(
  (SELECT contador FROM limites_de_uso
   WHERE recurso = 'recurso_prueba_761' AND actor_id = '00000000-0000-0000-0000-000000761001'),
  3,
  'el contador quedo en 3 tras las 3 llamadas'
);

SELECT throws_ok(
  $$ SELECT fn_verificar_y_contar_limite('recurso_prueba_761', '00000000-0000-0000-0000-000000761001'::uuid, 3, interval '1 minute') $$,
  '53400',
  NULL,
  'la llamada 4, sobre el umbral, falla con configuration_limit_exceeded'
);

-- Reinicio de ventana: se retrasa ventana_inicio a mano en vez de esperar con pg_sleep.
UPDATE limites_de_uso SET ventana_inicio = now() - interval '2 minutes'
WHERE recurso = 'recurso_prueba_761' AND actor_id = '00000000-0000-0000-0000-000000761001';

SELECT lives_ok(
  $$ SELECT fn_verificar_y_contar_limite('recurso_prueba_761', '00000000-0000-0000-0000-000000761001'::uuid, 3, interval '1 minute') $$,
  'tras expirar la ventana, la siguiente llamada vuelve a pasar'
);

SELECT is(
  (SELECT contador FROM limites_de_uso
   WHERE recurso = 'recurso_prueba_761' AND actor_id = '00000000-0000-0000-0000-000000761001'),
  1,
  'el contador se reinicio a 1, no seguio acumulando desde 3'
);

SELECT lives_ok(
  $$ SELECT fn_verificar_y_contar_limite('otro_recurso_761', '00000000-0000-0000-0000-000000761001'::uuid, 1, interval '1 minute') $$,
  'un recurso distinto para el mismo actor tiene su propia cuota, no comparte con recurso_prueba_761'
);

SELECT throws_ok(
  $$ SELECT fn_verificar_y_contar_limite('recurso_prueba_761', NULL, 3, interval '1 minute') $$,
  '22004',
  NULL,
  'un actor_id nulo se rechaza antes de tocar la tabla (null_value_not_allowed)'
);

-- ============================================================================
-- 2. fn_verificar_limite_invitaciones(): delega con el recurso/umbral de invitar-usuario fijos
--    (20 cada hora). Se siembra en 19 para no repetir la llamada real 20 veces.
-- ============================================================================
INSERT INTO limites_de_uso (recurso, actor_id, contador, ventana_inicio)
VALUES ('invitar_usuario', '00000000-0000-0000-0000-000000761001', 19, now());

SELECT lives_ok(
  $$ SELECT fn_verificar_limite_invitaciones('00000000-0000-0000-0000-000000761001'::uuid) $$,
  'la invitacion 20 (en el umbral) todavia pasa'
);

SELECT throws_ok(
  $$ SELECT fn_verificar_limite_invitaciones('00000000-0000-0000-0000-000000761001'::uuid) $$,
  '53400',
  NULL,
  'la invitacion 21 supera el umbral de 20 por hora'
);

-- Como service_role de verdad, no como el postgres superusuario que corre el resto de esta
-- suite. Es la unica forma de que pgTAP hubiera cazado el bug real que esto reproduce: la Edge
-- Function invitar-usuario llama con la llave de servicio, y service_role no es superusuario ni
-- el dueno de la funcion -bypasa RLS, no GRANT/REVOKE-, asi que sin el GRANT EXECUTE explicito
-- de la 00134 esta llamada moria con 42501 (permission denied for function). Se encontro
-- probando la Edge Function real con curl, no aqui, porque el resto de esta suite corre como
-- postgres y un superusuario bypasa todo chequeo de privilegios sin importar los GRANT/REVOKE.
UPDATE limites_de_uso SET contador = 0
WHERE recurso = 'invitar_usuario' AND actor_id = '00000000-0000-0000-0000-000000761001';

SET LOCAL ROLE service_role;

SELECT lives_ok(
  $$ SELECT fn_verificar_limite_invitaciones('00000000-0000-0000-0000-000000761001'::uuid) $$,
  'service_role (el rol real que usa la Edge Function) puede llamar a fn_verificar_limite_invitaciones'
);

RESET ROLE;

-- El nucleo, en cambio, sigue sin concederse a nadie mas que a las funciones companeras que lo
-- envuelven (SECURITY DEFINER, dueno postgres): ni siquiera service_role puede llamarlo directo.
SET LOCAL ROLE service_role;

SELECT throws_ok(
  $$ SELECT fn_verificar_y_contar_limite('recurso_prueba_761', '00000000-0000-0000-0000-000000761001'::uuid, 3, interval '1 minute') $$,
  '42501',
  NULL,
  'ni siquiera service_role puede llamar al nucleo directo, solo a traves de las companeras'
);

RESET ROLE;

-- ============================================================================
-- 3. fn_buscar_pacientes() de punta a punta, como authenticated (60 cada minuto). Se siembra
--    en 59 para no repetir la busqueda real 60 veces.
-- ============================================================================
INSERT INTO limites_de_uso (recurso, actor_id, contador, ventana_inicio)
VALUES ('buscar_pacientes', '00000000-0000-0000-0000-000000761002', 59, now());

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000761002';

SELECT lives_ok(
  $$ SELECT count(*) FROM fn_buscar_pacientes() $$,
  'la busqueda 60 (en el umbral) todavia pasa'
);

SELECT throws_ok(
  $$ SELECT count(*) FROM fn_buscar_pacientes() $$,
  '53400',
  NULL,
  'la busqueda 61 supera el umbral: esto es lo que demuestra que el CROSS JOIN _limite de la '
  '00134 de verdad fuerza la evaluacion del limite dentro de fn_buscar_pacientes, no solo del '
  'nucleo aislado'
);

RESET ROLE;

-- Reinicio de ventana para el mismo usuario.
UPDATE limites_de_uso SET ventana_inicio = now() - interval '2 minutes'
WHERE recurso = 'buscar_pacientes' AND actor_id = '00000000-0000-0000-0000-000000761002';

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000761002';

SELECT lives_ok(
  $$ SELECT count(*) FROM fn_buscar_pacientes() $$,
  'tras expirar la ventana, fn_buscar_pacientes vuelve a funcionar para el mismo usuario'
);

RESET ROLE;

SELECT is(
  (SELECT contador FROM limites_de_uso
   WHERE recurso = 'buscar_pacientes' AND actor_id = '00000000-0000-0000-0000-000000761002'),
  1,
  'el contador del usuario 761002 se reinicio a 1 tras expirar la ventana'
);

-- Un segundo usuario, sin ninguna fila previa en limites_de_uso, tiene su propia cuota: el
-- historial (agotado y despues reiniciado) de 761002 no afecta a 761003.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000761003';

SELECT lives_ok(
  $$ SELECT count(*) FROM fn_buscar_pacientes() $$,
  'un usuario distinto (sin historial) busca sin problema: la cuota es por actor, no global'
);

RESET ROLE;

SELECT is(
  (SELECT contador FROM limites_de_uso
   WHERE recurso = 'buscar_pacientes' AND actor_id = '00000000-0000-0000-0000-000000761003'),
  1,
  'el usuario 761003 arranca su propio contador en 1, independiente del de 761002'
);

SELECT * FROM finish();
ROLLBACK;
