-- Pruebas de diagnosticos.activo (issue #639, migracion 00113). Corre con: supabase test db
--
-- Cubre solo lo que agrega la 00113: que la columna nace en TRUE, que alternarla sigue la misma
-- politica de UPDATE que el resto del catalogo (administrador si, medico no) y que retirar un
-- diagnostico no le quita visibilidad a quien ya lo podia leer (00033). Las reglas que la 00113
-- no toca -unicidad de codigo, quien inserta, ON DELETE RESTRICT- ya las cubre
-- reglas_de_dominio_625.sql.
--
-- Mismo patron que el resto de las suites: SET LOCAL ROLE authenticated + SET LOCAL
-- request.jwt.claim.sub simula cada rol. El UPDATE del medico no lanza excepcion (la politica de
-- la 00105 lo filtra por USING, no por WITH CHECK con throw): se comprueba leyendo el valor
-- despues, no con throws_ok.

BEGIN;

SELECT plan(8);

-- ============================================================================
-- Setup
-- ============================================================================
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000639001', 'admin639@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000639002', 'medico639@test.ecopac.local'),
  ('00000000-0000-0000-0000-000000639003', 'voluntario639@test.ecopac.local');

ALTER TABLE perfiles DISABLE TRIGGER USER;
UPDATE perfiles SET rol = 'administrador' WHERE id = '00000000-0000-0000-0000-000000639001';
UPDATE perfiles SET rol = 'medico'        WHERE id = '00000000-0000-0000-0000-000000639002';
-- El voluntario se queda con el rol por defecto (voluntario general).
ALTER TABLE perfiles ENABLE TRIGGER USER;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000639001';

INSERT INTO diagnosticos (id, codigo, nombre)
VALUES ('7d000000-0000-0000-0000-000000639001', 'Z639', 'Diagnostico de prueba 639');

SELECT is(
  (SELECT activo FROM diagnosticos WHERE id = '7d000000-0000-0000-0000-000000639001'),
  TRUE,
  'un diagnostico nuevo nace vigente (DEFAULT TRUE de la 00113)'
);

-- ============================================================================
-- Retirarlo: solo la administradora
-- ============================================================================
SELECT lives_ok(
  $$ UPDATE diagnosticos SET activo = FALSE
     WHERE id = '7d000000-0000-0000-0000-000000639001' $$,
  'POSITIVA UPDATE: la administradora retira un diagnostico del selector'
);

SELECT is(
  (SELECT activo FROM diagnosticos WHERE id = '7d000000-0000-0000-0000-000000639001'),
  FALSE,
  'y queda marcado como no vigente'
);

SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000639002';

UPDATE diagnosticos SET activo = TRUE
  WHERE id = '7d000000-0000-0000-0000-000000639001';

SELECT is(
  (SELECT activo FROM diagnosticos WHERE id = '7d000000-0000-0000-0000-000000639001'),
  FALSE,
  'NEGATIVA UPDATE: el medico lee el catalogo pero no lo mantiene, tambien para activo (USING lo filtra: cero filas)'
);

-- ============================================================================
-- Un diagnostico retirado sigue siendo legible por quien ya podia leerlo (00033): la 00113 no
-- toca la politica de SELECT, asi que la visibilidad no depende de `activo`.
-- ============================================================================
SELECT isnt_empty(
  $$ SELECT 1 FROM diagnosticos WHERE id = '7d000000-0000-0000-0000-000000639001' $$,
  'POSITIVA SELECT: el medico sigue viendo el diagnostico retirado (su consulta lo puede haber citado)'
);

SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000639003';

SELECT is_empty(
  $$ SELECT 1 FROM diagnosticos WHERE id = '7d000000-0000-0000-0000-000000639001' $$,
  'NEGATIVA SELECT: el voluntario sigue sin ver diagnosticos, retirado o no'
);

-- ============================================================================
-- Reactivarlo: de vuelta a la administradora
-- ============================================================================
SET LOCAL request.jwt.claim.sub TO '00000000-0000-0000-0000-000000639001';

SELECT lives_ok(
  $$ UPDATE diagnosticos SET activo = TRUE
     WHERE id = '7d000000-0000-0000-0000-000000639001' $$,
  'POSITIVA UPDATE: la administradora reactiva un diagnostico retirado'
);

SELECT is(
  (SELECT activo FROM diagnosticos WHERE id = '7d000000-0000-0000-0000-000000639001'),
  TRUE,
  'y vuelve a ofrecerse en el selector'
);

SELECT * FROM finish();

ROLLBACK;
