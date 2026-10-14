-- Pruebas de la migracion 00137 (issue #847).
-- Corre con: supabase test db
--
-- El CHECK del DPI quedo NOT VALID en la 00132: obligaba a lo nuevo y no habia revisado lo
-- anterior. La 00137 revisa las filas viejas y lo valida. Aqui se comprueba lo que queda despues:
-- que el CHECK este validado de verdad, y que la regla de formato sea la que la migracion
-- aplico.
--
-- La limpieza de datos de la 00137 es una operacion de una sola vez sobre las filas que ya
-- estaban, no un trigger, asi que no se puede provocar desde aqui: cuando esta prueba corre, ya
-- ocurrio. Lo que si se comprueba es la expresion con la que se decidio cada fila, que es donde
-- vive la decision.
--
-- Ningun dato real: comunidad y pacientes son inventados, y los DPI tampoco corresponden a
-- ninguna persona.

BEGIN;

SELECT plan(8);

-- ============================================================================
-- 1. El CHECK quedo validado
-- ============================================================================

SELECT ok(
  (SELECT convalidated FROM pg_constraint WHERE conname = 'chk_pacientes_dpi_13_digitos'),
  'chk_pacientes_dpi_13_digitos ya no es NOT VALID: vale tambien para las filas anteriores'
);

SELECT is_empty(
  $$ SELECT id FROM pacientes WHERE dpi IS NOT NULL AND dpi !~ '^[0-9]{13}$' $$,
  'no queda ningun paciente con un DPI que incumpla los 13 digitos'
);

-- ============================================================================
-- 2. La regla de formato que aplico la migracion
-- ============================================================================
--
-- Es la misma expresion de la 00137: quitar lo que no sea digito y aceptar el resultado solo si
-- son exactamente 13.

SELECT is(
  regexp_replace('1234-56789-0101', '[^0-9]', '', 'g'),
  '1234567890101',
  'un DPI con guiones se limpia a sus 13 digitos'
);

SELECT is(
  regexp_replace('1234 56789 0101', '[^0-9]', '', 'g'),
  '1234567890101',
  'un DPI con espacios se limpia a sus 13 digitos'
);

SELECT ok(
  regexp_replace('12345', '[^0-9]', '', 'g') !~ '^[0-9]{13}$',
  'un DPI incompleto no se completa: no pasa la regla, y la migracion lo deja en NULL'
);

-- ============================================================================
-- 3. El CHECK sigue haciendo lo suyo con las filas nuevas
-- ============================================================================

INSERT INTO comunidades (id, municipio_id, nombre) VALUES
  ('10000000-0000-0000-0000-000000000137', 101, 'Comunidad de prueba 137');

SELECT lives_ok(
  $$ INSERT INTO pacientes (id, nombres, apellidos, fecha_nacimiento, sexo, comunidad_id, idioma, dpi)
     VALUES ('20000000-0000-0000-0000-000000001371', 'Uno', 'Inventado', '1990-01-01', 'Femenino',
             '10000000-0000-0000-0000-000000000137', 'espanol', '1234567890101') $$,
  'un DPI de 13 digitos se acepta'
);

SELECT throws_ok(
  $$ INSERT INTO pacientes (id, nombres, apellidos, fecha_nacimiento, sexo, comunidad_id, idioma, dpi)
     VALUES ('20000000-0000-0000-0000-000000001372', 'Dos', 'Inventado', '1990-01-01', 'Masculino',
             '10000000-0000-0000-0000-000000000137', 'espanol', '1234-56789-0102') $$,
  '23514',
  NULL,
  'un DPI con separadores se rechaza: la limpieza fue de una vez, la regla es la del CHECK'
);

SELECT lives_ok(
  $$ INSERT INTO pacientes (id, nombres, apellidos, fecha_nacimiento, sexo, comunidad_id, idioma, dpi)
     VALUES ('20000000-0000-0000-0000-000000001373', 'Tres', 'Inventado', '1990-01-01', 'Femenino',
             '10000000-0000-0000-0000-000000000137', 'espanol', NULL) $$,
  'sin DPI se sigue pudiendo registrar: mucha poblacion rural no lo tiene'
);

SELECT * FROM finish();
ROLLBACK;
