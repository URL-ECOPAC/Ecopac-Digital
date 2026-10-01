-- Prueba de la 00165: un gasto registrado sin fecha (DEFAULT CURRENT_DATE, el dia del servidor en
-- UTC) en una jornada que ya paso no se rechaza como futuro, aunque en Guatemala todavia sea el dia
-- anterior. El CI la corre a cualquier hora: entre las 18:00 y la medianoche de Guatemala es justo
-- el caso que la 00159 rechazaba. Corre con: supabase test db

BEGIN;

SELECT plan(2);

INSERT INTO comunidades (id, municipio_id, nombre) VALUES
  ('10000000-0000-0000-0000-000000016501', 101, 'Comunidad de prueba 165');

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000016501', 'admin165@test.ecopac.local');
ALTER TABLE perfiles DISABLE TRIGGER USER;
UPDATE perfiles SET rol = 'administrador' WHERE id = '00000000-0000-0000-0000-000000016501';
ALTER TABLE perfiles ENABLE TRIGGER USER;

-- Una jornada en curso de ayer (en Guatemala), creada antes para que su fecha pase el CHECK.
INSERT INTO jornadas (id, nombre, fecha, comunidad_id, responsable_id, estado, presupuesto_asignado, created_at) VALUES
  ('40000000-0000-0000-0000-000000016501', 'Jornada 165',
   (now() AT TIME ZONE 'America/Guatemala')::DATE - 1,
   '10000000-0000-0000-0000-000000016501', '00000000-0000-0000-0000-000000016501', 'en curso', 1000,
   now() - INTERVAL '3 days');

SELECT lives_ok(
  $$ INSERT INTO gastos (jornada_id, concepto, categoria, monto, registrado_por)
     VALUES ('40000000-0000-0000-0000-000000016501', 'Gasto del dia 165', 'Logistica', 10,
             '00000000-0000-0000-0000-000000016501') $$,
  'un gasto sin fecha (el dia del servidor) se acepta a cualquier hora'
);

SELECT throws_ok(
  $$ INSERT INTO gastos (jornada_id, concepto, categoria, monto, fecha, registrado_por)
     VALUES ('40000000-0000-0000-0000-000000016501', 'Gasto futuro 165', 'Logistica', 10,
             CURRENT_DATE + 2, '00000000-0000-0000-0000-000000016501') $$,
  '23514', NULL,
  'una fecha de verdad futura se sigue rechazando'
);

SELECT * FROM finish();
ROLLBACK;
