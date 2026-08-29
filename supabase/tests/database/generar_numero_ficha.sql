-- Pruebas de la generacion server-side de numero_ficha (issue #114, migracion 00078). Corre con:
-- supabase test db
--
-- Mismo patron de fixtures que politicas_rls_pacientes_expedientes.sql (#88): SET LOCAL ROLE
-- authenticated + SET LOCAL request.jwt.claim.sub simula el rol. A diferencia de ese archivo,
-- aqui se llama fn_registrar_paciente() en vez de insertar directo, porque lo que se prueba es
-- el DEFAULT de la columna (nextval de expedientes_numero_ficha_seq), que solo se dispara
-- cuando numero_ficha no viaja en el INSERT.

BEGIN;

SELECT plan(5);

-- ============================================================================
-- Setup: un perfil administrador y una comunidad para poder registrar pacientes.
-- ============================================================================
INSERT INTO comunidades (id, municipio_id, nombre) VALUES
  ('30000000-0000-0000-0000-000000000001', 101, 'Comunidad de prueba - numero de ficha');

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000000201', 'admin114@test.ecopac.local');

ALTER TABLE perfiles DISABLE TRIGGER USER;
UPDATE perfiles SET rol = 'administrador' WHERE id = '00000000-0000-0000-0000-000000000201';
ALTER TABLE perfiles ENABLE TRIGGER USER;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000000201';

-- ============================================================================
-- Tres registros seguidos: cada numero_ficha generado debe ser distinto, tener el formato de
-- 6 digitos y ser mayor que el anterior (no se compara contra un valor absoluto como '000000'
-- porque otra suite pudo haber avanzado antes la secuencia: nextval() no se revierte con
-- ROLLBACK aunque la transaccion que lo llamo si lo haga).
-- ============================================================================
CREATE TEMP TABLE fichas_generadas AS
SELECT numero_ficha, row_number() OVER () AS orden
FROM (
  SELECT numero_ficha FROM fn_registrar_paciente(
    'Paciente', 'Uno', '1990-01-01', 'F', '30000000-0000-0000-0000-000000000001', '5555-2001', 'espanol'
  )
  UNION ALL
  SELECT numero_ficha FROM fn_registrar_paciente(
    'Paciente', 'Dos', '1991-02-02', 'M', '30000000-0000-0000-0000-000000000001', '5555-2002', 'espanol'
  )
  UNION ALL
  SELECT numero_ficha FROM fn_registrar_paciente(
    'Paciente', 'Tres', '1992-03-03', 'F', '30000000-0000-0000-0000-000000000001', '5555-2003', 'espanol'
  )
) AS generadas;

SELECT is(
  (SELECT count(*)::int FROM fichas_generadas), 3,
  'fn_registrar_paciente genero un numero_ficha en cada una de las tres llamadas'
);

SELECT is(
  (SELECT count(DISTINCT numero_ficha)::int FROM fichas_generadas), 3,
  'los tres numero_ficha generados son distintos entre si'
);

SELECT ok(
  (SELECT bool_and(numero_ficha ~ '^\d{6}$') FROM fichas_generadas),
  'cada numero_ficha generado tiene el formato de 6 digitos con ceros a la izquierda'
);

SELECT ok(
  (
    SELECT f2.numero_ficha::bigint > f1.numero_ficha::bigint
    FROM fichas_generadas f1
    JOIN fichas_generadas f2 ON f2.orden = f1.orden + 1
    WHERE f1.orden = 1
  ),
  'el segundo numero_ficha es mayor que el primero (la secuencia crece, no se repite)'
);

SELECT ok(
  (
    SELECT f2.numero_ficha::bigint > f1.numero_ficha::bigint
    FROM fichas_generadas f1
    JOIN fichas_generadas f2 ON f2.orden = f1.orden + 1
    WHERE f1.orden = 2
  ),
  'el tercer numero_ficha es mayor que el segundo'
);

SELECT * FROM finish();

ROLLBACK;
