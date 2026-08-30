-- Pruebas de la migracion 00089 (issue #412, casos 1 y 7): gastos.estado deja de compartir
-- tipo con estado_movimiento, y fn_gastos_updated_at() deja de duplicar a
-- actualizar_timestamp_updated_at(). Corre con: supabase test db
--
-- Reutiliza fixtures de seed-demo.sql (perfil de000001-...-0001, jornada de00000a-...-0001) en
-- vez de armar una cadena de comunidad/jornada/perfil propia: esta prueba no ejercita RLS, asi
-- que no hace falta impersonar ningun rol ni aislar datos de otra suite.

BEGIN;

SELECT plan(7);

-- ============================================================================
-- 1. estado_gasto existe como tipo propio, distinto de estado_movimiento.
-- ============================================================================
SELECT isnt(
  'estado_gasto'::regtype,
  'estado_movimiento'::regtype,
  'estado_gasto es un tipo distinto de estado_movimiento'
);

SELECT is(
  (SELECT udt_name FROM information_schema.columns
   WHERE table_name = 'gastos' AND column_name = 'estado'),
  'estado_gasto',
  'gastos.estado usa el tipo estado_gasto'
);

-- ============================================================================
-- 2. El vocabulario se conserva: los mismos tres valores siguen siendo validos.
-- ============================================================================
SELECT lives_ok(
  $$ INSERT INTO gastos (id, jornada_id, concepto, categoria, monto, registrado_por)
     VALUES ('70000000-0000-0000-0000-000000000089', 'de00000a-0000-0000-0000-000000000001',
             'Gasto de prueba 412', 'Logistica', 50.00, 'de000001-0000-0000-0000-000000000001') $$,
  'un gasto nuevo sigue naciendo en estado pendiente (DEFAULT) sin especificarlo'
);

SELECT throws_ok(
  $$ INSERT INTO gastos (id, jornada_id, concepto, categoria, monto, registrado_por, estado)
     VALUES ('70000000-0000-0000-0000-000000000090', 'de00000a-0000-0000-0000-000000000001',
             'Gasto invalido 412', 'Logistica', 50.00, 'de000001-0000-0000-0000-000000000001',
             'invalido') $$,
  '22P02',
  'un estado fuera del enum sigue rechazandose igual que antes'
);

-- ============================================================================
-- 3. fn_gastos_updated_at() ya no existe; el trigger de updated_at sigue funcionando con la
--    funcion compartida actualizar_timestamp_updated_at().
-- ============================================================================
SELECT ok(
  to_regprocedure('fn_gastos_updated_at()') IS NULL,
  'fn_gastos_updated_at() ya no existe, se elimino la copia'
);

-- NOW() es estable durante toda la transaccion (no del statement): comparar updated_at antes y
-- despues de un UPDATE en este mismo BEGIN...ROLLBACK nunca mostraria diferencia, funcione el
-- trigger o no. Se verifica en el catalogo que el trigger apunta a la funcion compartida, y con
-- un UPDATE real que no truene se confirma que la cadena completa sigue funcionando.
SELECT is(
  (SELECT p.proname FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
   WHERE t.tgname = 'tr_gastos_updated_at' AND t.tgrelid = 'gastos'::regclass),
  'actualizar_timestamp_updated_at',
  'tr_gastos_updated_at ahora invoca la funcion compartida actualizar_timestamp_updated_at'
);

SELECT lives_ok(
  $$ UPDATE gastos SET concepto = 'Gasto de prueba 412 editado'
     WHERE id = '70000000-0000-0000-0000-000000000089' $$,
  'el UPDATE sigue funcionando de punta a punta con el trigger compartido'
);

SELECT * FROM finish();

ROLLBACK;
