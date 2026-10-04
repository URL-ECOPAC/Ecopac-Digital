-- Pruebas de la 00185: agendar citas es un permiso fino (issue #927). Corre con: supabase test db
--
-- Una jornada en curso hoy con un medico y un voluntario en el cuadro de turnos, un medico fuera
-- de el y la administradora. Ningun dato real.

BEGIN;

SELECT plan(15);

-- ============================================================================
-- Setup
-- ============================================================================
INSERT INTO proyectos (id, nombre) VALUES ('5f000000-0000-0000-0000-000000185001', 'Proyecto 185');
ALTER TABLE jornadas ALTER COLUMN proyecto_id SET DEFAULT '5f000000-0000-0000-0000-000000185001';
INSERT INTO bodegas (id, nombre, es_movil) VALUES
  ('5b000000-0000-0000-0000-000000185001', 'Botiquin 185', TRUE);
ALTER TABLE jornadas ALTER COLUMN botiquin_bodega_id SET DEFAULT '5b000000-0000-0000-0000-000000185001';
ALTER TABLE jornadas DISABLE TRIGGER trg_jornadas_requiere_bodega_movil_libre;

INSERT INTO comunidades (id, municipio_id, nombre) VALUES
  ('10000000-0000-0000-0000-000000185001', 101, 'Comunidad 185');

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000185001', 'admin185@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000185002', 'medico185@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000185003', 'medicofuera185@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000185004', 'voluntario185@test.ecopac.local');

ALTER TABLE perfiles DISABLE TRIGGER USER;
UPDATE perfiles SET rol = 'administrador' WHERE id = '00000000-0000-0000-0000-000000185001';
UPDATE perfiles SET rol = 'medico' WHERE id IN (
  '00000000-0000-0000-0000-000000185002', '00000000-0000-0000-0000-000000185003');
UPDATE perfiles SET rol = 'voluntario general' WHERE id = '00000000-0000-0000-0000-000000185004';
ALTER TABLE perfiles ENABLE TRIGGER USER;

INSERT INTO jornadas (id, nombre, fecha, comunidad_id, responsable_id) VALUES
  ('40000000-0000-0000-0000-000000185001', 'Jornada 185', (now() AT TIME ZONE 'America/Guatemala')::date,
   '10000000-0000-0000-0000-000000185001', '00000000-0000-0000-0000-000000185001');
UPDATE jornadas SET estado = 'en curso' WHERE id = '40000000-0000-0000-0000-000000185001';

INSERT INTO jornada_personal (jornada_id, perfil_id, rol_en_jornada, hora_inicio, hora_fin) VALUES
  ('40000000-0000-0000-0000-000000185001', '00000000-0000-0000-0000-000000185002', 'medico', '08:00', '16:00'),
  ('40000000-0000-0000-0000-000000185001', '00000000-0000-0000-0000-000000185004', 'voluntario general', '08:00', '16:00');

INSERT INTO pacientes (id, nombres, apellidos, fecha_nacimiento, sexo, comunidad_id, idioma)
SELECT ('20000000-0000-0000-0000-000000185' || lpad(n::text, 3, '0'))::uuid,
       'Paciente ' || n, 'Prueba185', DATE '1990-01-01', 'Femenino',
       '10000000-0000-0000-0000-000000185001', 'espanol'
FROM generate_series(1, 4) AS n;

INSERT INTO clinicas (id, nombre, salas_disponibles) VALUES
  ('c0000000-0000-0000-0000-000000185001', 'Clinica 185', 5);

CREATE TEMP VIEW h AS SELECT
  (((now() AT TIME ZONE 'America/Guatemala')::date + TIME '09:00') AT TIME ZONE 'America/Guatemala') AS hoy9,
  (SELECT id FROM areas_atencion WHERE nombre = 'Odontología') AS odonto;
GRANT SELECT ON h TO authenticated;

-- ============================================================================
-- 1. El permiso y quien lo tiene por defecto
-- ============================================================================
SELECT is(
  (SELECT modulo FROM permisos WHERE clave = 'citas.agendar'),
  'pacientes',
  'citas.agendar existe, en el modulo de pacientes'
);

SELECT is(
  (SELECT array_agg(rp.rol::text ORDER BY rp.rol::text)
   FROM rol_permiso rp JOIN permisos p ON p.id = rp.permiso_id
   WHERE p.clave = 'citas.agendar'),
  ARRAY['administrador', 'medico', 'voluntario general'],
  'por defecto lo tienen la administradora, el medico y el voluntario general'
);

-- ============================================================================
-- 2. Con el permiso por defecto, el voluntario de la jornada agenda
-- ============================================================================
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000185004', TRUE);
SET LOCAL ROLE authenticated;

SELECT lives_ok(
  $$ INSERT INTO citas (id, paciente_id, jornada_id, clinica_id, area_id, inicia_en)
     SELECT 'c1000000-0000-0000-0000-000000185001', '20000000-0000-0000-0000-000000185001',
            '40000000-0000-0000-0000-000000185001', 'c0000000-0000-0000-0000-000000185001',
            odonto, hoy9 FROM h $$,
  'el voluntario de la jornada agenda con el permiso por defecto'
);

RESET ROLE;

-- ============================================================================
-- 3. Revocado por persona: no agenda, pero sigue abriendo la cita
-- ============================================================================
INSERT INTO usuario_permiso (perfil_id, permiso_id, concedido, otorgado_por, motivo)
SELECT '00000000-0000-0000-0000-000000185004', id, FALSE,
       '00000000-0000-0000-0000-000000185001', 'Prueba 185'
FROM permisos WHERE clave = 'citas.agendar';

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000185004', TRUE);
SET LOCAL ROLE authenticated;

SELECT throws_ok(
  $$ INSERT INTO citas (paciente_id, jornada_id, clinica_id, area_id, inicia_en)
     SELECT '20000000-0000-0000-0000-000000185002', '40000000-0000-0000-0000-000000185001',
            'c0000000-0000-0000-0000-000000185001', odonto, hoy9 FROM h $$,
  '42501',
  NULL,
  'con el permiso revocado el voluntario ya no agenda'
);

SELECT lives_ok(
  $$ UPDATE citas SET estado = 'en_atencion' WHERE id = 'c1000000-0000-0000-0000-000000185001' $$,
  'sin el permiso abre la cita (Atender)'
);

SELECT lives_ok(
  $$ UPDATE citas SET estado = 'creada' WHERE id = 'c1000000-0000-0000-0000-000000185001' $$,
  'sin el permiso la regresa a creada'
);

SELECT throws_ok(
  $$ UPDATE citas SET estado = 'cancelada' WHERE id = 'c1000000-0000-0000-0000-000000185001' $$,
  '42501',
  'Sin el permiso de agendar citas solo se abre la cita (Atender) o se regresa a creada.',
  'sin el permiso no cancela'
);

SELECT throws_ok(
  $$ UPDATE citas SET inicia_en = inicia_en + interval '1 hour', termina_en = termina_en + interval '1 hour'
     WHERE id = 'c1000000-0000-0000-0000-000000185001' $$,
  '42501',
  NULL,
  'sin el permiso no reagenda'
);

SELECT throws_ok(
  $$ UPDATE citas SET notas = 'Cambio' WHERE id = 'c1000000-0000-0000-0000-000000185001' $$,
  '42501',
  NULL,
  'sin el permiso no cambia las notas'
);

SELECT is(
  (SELECT count(*)::int FROM citas WHERE jornada_id = '40000000-0000-0000-0000-000000185001'),
  1,
  'sin el permiso sigue viendo las citas de su jornada'
);

RESET ROLE;

-- ============================================================================
-- 4. El permiso no abre jornadas ajenas
-- ============================================================================
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000185003', TRUE);
SET LOCAL ROLE authenticated;

SELECT throws_ok(
  $$ INSERT INTO citas (paciente_id, jornada_id, clinica_id, area_id, inicia_en)
     SELECT '20000000-0000-0000-0000-000000185003', '40000000-0000-0000-0000-000000185001',
            'c0000000-0000-0000-0000-000000185001', odonto, hoy9 FROM h $$,
  '42501',
  NULL,
  'con el permiso, un medico que no pertenece a la jornada no agenda en ella'
);

RESET ROLE;

-- ============================================================================
-- 5. El medico con el permiso cancela; la administradora siempre
-- ============================================================================
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000185002', TRUE);
SET LOCAL ROLE authenticated;

SELECT lives_ok(
  $$ UPDATE citas SET notas = 'Paciente avisado' WHERE id = 'c1000000-0000-0000-0000-000000185001' $$,
  'el medico de la jornada con el permiso cambia las notas'
);

SELECT lives_ok(
  $$ UPDATE citas SET estado = 'cancelada', motivo_cancelacion = 'Prueba'
     WHERE id = 'c1000000-0000-0000-0000-000000185001' $$,
  'el medico de la jornada con el permiso cancela'
);

RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000185001', TRUE);
SET LOCAL ROLE authenticated;

SELECT lives_ok(
  $$ INSERT INTO citas (paciente_id, jornada_id, clinica_id, area_id, inicia_en)
     SELECT '20000000-0000-0000-0000-000000185004', '40000000-0000-0000-0000-000000185001',
            'c0000000-0000-0000-0000-000000185001', odonto, hoy9 FROM h $$,
  'la administradora agenda siempre'
);

RESET ROLE;

-- ============================================================================
-- 6. Sin sesion (el seed, el service_role) la regla no aplica
-- ============================================================================
SELECT set_config('request.jwt.claim.sub', '', TRUE);

SELECT lives_ok(
  $$ UPDATE citas SET notas = 'Desde el seed'
     WHERE jornada_id = '40000000-0000-0000-0000-000000185001' AND estado = 'creada' $$,
  'sin sesion se puede cambiar una cita (seed de demostracion)'
);

SELECT * FROM finish();
ROLLBACK;
