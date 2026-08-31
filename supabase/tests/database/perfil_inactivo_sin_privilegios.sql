-- Pruebas de que un perfil desactivado no tiene privilegios (issue #529, migracion 00079).
-- Corre con: supabase test db
--
-- POR QUE ES UNA SUITE PROPIA Y NO ASSERTS REPARTIDOS
--
-- "Un perfil desactivado no puede nada" es una regla transversal: la aplican las tres funciones
-- de autorizacion de la 00004 y, a traves de ellas, 77 de las 104 politicas del esquema. Repartir
-- la comprobacion por las veinte suites de tablas dejaria la regla sin un sitio donde leerla
-- entera, y sin nadie que la vigile cuando alguien agregue una tabla nueva.
--
-- Hasta la 00079, `perfiles.activo` era un control de CLIENTE: la aplicacion lo respetaba y la
-- base no lo miraba. Estas pruebas cubren las cuatro vias que se comprobaron abiertas contra el
-- stack local antes del arreglo, incluida la que lo anulaba entero: un desactivado podia
-- reactivarse a si mismo.
--
-- Ningun dato real: correos, nombres y comunidades son inventados.

BEGIN;

SELECT plan(12);

-- ============================================================================
-- Setup
-- ============================================================================
-- Hacen falta DOS administradores: al desactivar a uno, el trigger
-- impedir_dejar_sin_administrador_activo (00072) aborta si no queda ningun otro activo.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000529001', 'admin529@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000529002', 'adminsuplente529@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000529003', 'medico529@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000529004', 'activo529@test.ecopac.local');

-- DISABLE TRIGGER USER apaga tambien los dos de la 00072, que si no abortarian el UPDATE de
-- `activo`. El de rol (00038) tampoco deja cambiarlo sin sesion de administrador.
ALTER TABLE perfiles DISABLE TRIGGER USER;
UPDATE perfiles SET rol = 'administrador', activo = FALSE
  WHERE id = '00000000-0000-0000-0000-000000529001';
UPDATE perfiles SET rol = 'administrador', activo = TRUE
  WHERE id = '00000000-0000-0000-0000-000000529002';
UPDATE perfiles SET rol = 'medico', activo = FALSE
  WHERE id = '00000000-0000-0000-0000-000000529003';
UPDATE perfiles SET rol = 'medico', activo = TRUE
  WHERE id = '00000000-0000-0000-0000-000000529004';
ALTER TABLE perfiles ENABLE TRIGGER USER;

INSERT INTO comunidades (id, municipio_id, nombre) VALUES
  ('10000000-0000-0000-0000-000000529001', 101, 'Comunidad 529');

INSERT INTO pacientes (id, nombres, apellidos, fecha_nacimiento, sexo, comunidad_id, telefono_contacto, idioma) VALUES
  ('20000000-0000-0000-0000-000000529001', 'Uno', 'Inventado', '1990-01-01', 'F',
   '10000000-0000-0000-0000-000000529001', '00000529', 'espanol');

INSERT INTO jornadas (id, nombre, fecha, comunidad_id, responsable_id, estado) VALUES
  ('30000000-0000-0000-0000-000000529001', 'Jornada 529',
   (NOW() AT TIME ZONE 'America/Guatemala')::date,
   '10000000-0000-0000-0000-000000529001', '00000000-0000-0000-0000-000000529002', 'en curso');

-- El medico desactivado SI figura en la jornada: es lo que hace util la prueba de
-- participa_en_jornada().
INSERT INTO jornada_personal (jornada_id, perfil_id, rol_en_jornada, hora_inicio, hora_fin) VALUES
  ('30000000-0000-0000-0000-000000529001', '00000000-0000-0000-0000-000000529003',
   'medico', '08:00', '16:00');

-- Y tiene ademas una concesion individual, que es la rama de tiene_permiso() que no pasaba por
-- rol_actual().
INSERT INTO usuario_permiso (perfil_id, permiso_id, concedido)
SELECT '00000000-0000-0000-0000-000000529003', p.id, TRUE
FROM permisos p WHERE p.clave = 'jornadas.gestionar';

SET LOCAL ROLE authenticated;

-- ============================================================================
-- 1. Las tres funciones de autorizacion
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000529003';

SELECT is(
  rol_actual(), NULL::rol_usuario,
  'rol_actual() no devuelve rol para un perfil desactivado'
);

-- es_administrador() tiene que devolver FALSE, no NULL: su COALESCE (00004:25) es lo que lo
-- garantiza, y las politicas dependen de que sea un booleano y no un nulo.
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000529001';

SELECT is(
  es_administrador(), FALSE,
  'es_administrador() es FALSE -y no NULL- para un administrador desactivado'
);

SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000529003';

SELECT is(
  tiene_permiso('jornadas.gestionar'), FALSE,
  'una concesion individual no sobrevive a la baja del perfil'
);

SELECT is(
  participa_en_jornada('30000000-0000-0000-0000-000000529001'), FALSE,
  'estar asignado a una jornada no vale si el perfil esta desactivado'
);

-- El control: el mismo medico, activo, si resuelve su rol.
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000529004';

SELECT is(
  rol_actual()::text, 'medico',
  'un perfil activo conserva su rol: el arreglo no cambia nada para quien opera'
);

-- ============================================================================
-- 2. No lee ni escribe
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000529003';

SELECT is(
  (SELECT count(*)::int FROM pacientes), 0,
  'un perfil desactivado no lee pacientes'
);

-- Es la fuga que se reprodujo contra la API: leia el catalogo de medicamentos porque su politica
-- era USING (true) y no pasaba por ninguna funcion de autorizacion.
SELECT is(
  (SELECT count(*)::int FROM medicamentos), 0,
  'tampoco lee los catalogos de inventario'
);

SELECT throws_ok(
  $$ INSERT INTO pacientes (nombres, apellidos, fecha_nacimiento, sexo, comunidad_id, telefono_contacto, idioma)
     VALUES ('Dos', 'Inventado', '1990-01-01', 'M', '10000000-0000-0000-0000-000000529001', '00000529', 'espanol') $$,
  '42501',
  NULL,
  'y no escribe: el INSERT choca contra el WITH CHECK'
);

-- ============================================================================
-- 3. La via de escape: reactivarse a si mismo
-- ============================================================================
-- Era lo que anulaba el arreglo entero. La politica de UPDATE de perfiles no pasaba por
-- rol_actual(), e impedir_autodesactivacion() (00072) solo bloquea PONER activo = FALSE.
UPDATE perfiles SET activo = TRUE WHERE id = '00000000-0000-0000-0000-000000529003';

SELECT is(
  (SELECT activo FROM perfiles WHERE id = '00000000-0000-0000-0000-000000529003'), FALSE,
  'un perfil desactivado no puede reactivarse a si mismo'
);

-- ============================================================================
-- 4. Lo que si conserva: su propio perfil
-- ============================================================================
-- La politica de SELECT no se toco a proposito: es como evaluarPerfilDeSesion()
-- (packages/shared/api/sesion.js) averigua que la cuenta esta desactivada para poder decirlo. Sin
-- esto la aplicacion responderia "permiso denegado", que no explica nada a quien lo lee.
SELECT is(
  (SELECT count(*)::int FROM perfiles WHERE id = '00000000-0000-0000-0000-000000529003'), 1,
  'pero si lee su propio perfil, que es lo que necesita la pantalla de login'
);

-- ============================================================================
-- 5. La administradora activa sigue mandando
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000529002';

SELECT is(
  es_administrador(), TRUE,
  'una administradora activa conserva su rol'
);

UPDATE perfiles SET activo = TRUE WHERE id = '00000000-0000-0000-0000-000000529003';

SELECT is(
  (SELECT activo FROM perfiles WHERE id = '00000000-0000-0000-0000-000000529003'), TRUE,
  'y puede reactivar a quien estaba de baja'
);

SELECT * FROM finish();
ROLLBACK;
