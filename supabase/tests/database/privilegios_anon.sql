-- Pruebas de los privilegios del rol anon sobre el esquema publico (issue #408,
-- migracion 00049).
-- Corre con: supabase test db
--
-- A diferencia de las otras suites de este directorio, esta no prueba politicas RLS sino la
-- capa de abajo: los GRANT. Es a proposito. Las politicas ya se prueban en las seis suites
-- vecinas, y todas dependen de que rol_actual() sea NULL para una peticion sin sesion. Esta
-- suite cubre lo que RLS no puede cubrir: TRUNCATE no pasa por politicas de fila, asi que un
-- privilegio de mas ahi no lo frena ninguna policy.
--
-- Las tres primeras pruebas no usan fixtures ni impersonacion: leen el catalogo. La cuarta si
-- crea una tabla, porque es la unica forma de demostrar que el blindaje de ALTER DEFAULT
-- PRIVILEGES funciona sobre lo que todavia no existe.
--
-- Las pruebas 8 y 9 (issue #511) hacen lo mismo que las de tablas, pero para funciones: la
-- 00049 dejo un cabo suelto declarado en su propia cabecera -funciones de public ejecutables
-- por cualquiera porque el EXECUTE a PUBLIC es el default de Postgres- que cerro la 00097.

BEGIN;

SELECT plan(9);

-- ============================================================================
-- 1. anon no tiene ningun privilegio sobre ninguna tabla ni vista de public
-- ============================================================================
SELECT is_empty(
  $$
    SELECT table_name, privilege_type
    FROM information_schema.role_table_grants
    WHERE grantee = 'anon' AND table_schema = 'public'
  $$,
  'anon no tiene ningun privilegio sobre ninguna tabla o vista de public'
);

-- Se comprueba tabla por tabla y no solo en bloque, para que el mensaje de fallo diga cual es
-- la que se escapo en vez de un conteo.
--
-- El nombre va calificado con el esquema (%I.%I) y no suelto: el planificador puede evaluar
-- has_table_privilege() antes que el filtro de schemaname, es decir sobre tablas de auth o de
-- supabase_migrations, y con el nombre a secas esas no resuelven contra el search_path y la
-- consulta muere con "relation ... does not exist" en vez de responder la pregunta.
SELECT is_empty(
  $$
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND (has_table_privilege('anon', format('%I.%I', schemaname, tablename), 'SELECT')
        OR has_table_privilege('anon', format('%I.%I', schemaname, tablename), 'INSERT')
        OR has_table_privilege('anon', format('%I.%I', schemaname, tablename), 'UPDATE')
        OR has_table_privilege('anon', format('%I.%I', schemaname, tablename), 'DELETE')
        OR has_table_privilege('anon', format('%I.%I', schemaname, tablename), 'TRUNCATE')
        OR has_table_privilege('anon', format('%I.%I', schemaname, tablename), 'REFERENCES')
        OR has_table_privilege('anon', format('%I.%I', schemaname, tablename), 'TRIGGER'))
  $$,
  'ninguna tabla de public concede nada a anon, ni siquiera TRUNCATE'
);

-- ============================================================================
-- 2. authenticated no puede vaciar ninguna tabla
-- ============================================================================
-- TRUNCATE es el unico privilegio destructivo que las politicas RLS no pueden contener: no se
-- evalua ninguna policy al ejecutarlo.
SELECT is_empty(
  $$
    SELECT table_name
    FROM information_schema.role_table_grants
    WHERE grantee = 'authenticated'
      AND table_schema = 'public'
      AND privilege_type IN ('TRUNCATE', 'REFERENCES', 'TRIGGER')
  $$,
  'authenticated no tiene TRUNCATE, REFERENCES ni TRIGGER sobre ninguna tabla de public'
);

-- ============================================================================
-- 3. El barrido no se paso de la raya: authenticated conserva lo que si usa
-- ============================================================================
-- Sin estas dos pruebas, un REVOKE de mas dejaria la aplicacion muerta y las de arriba
-- seguirian en verde.
SELECT ok(
  has_table_privilege('authenticated', 'pacientes', 'SELECT')
    AND has_table_privilege('authenticated', 'pacientes', 'INSERT')
    AND has_table_privilege('authenticated', 'pacientes', 'UPDATE'),
  'authenticated conserva SELECT, INSERT y UPDATE sobre pacientes'
);

SELECT ok(
  has_table_privilege('authenticated', 'perfiles', 'SELECT')
    AND has_table_privilege('authenticated', 'jornadas', 'SELECT')
    AND has_table_privilege('authenticated', 'medicamentos', 'SELECT')
    AND has_table_privilege('authenticated', 'proyectos', 'SELECT')
    AND has_table_privilege('authenticated', 'movimientos_inventario', 'SELECT'),
  'authenticated conserva SELECT en una tabla representativa de cada modulo'
);

-- ============================================================================
-- 4. Una tabla nueva no nace concediendole nada a anon
-- ============================================================================
-- Es la unica prueba que demuestra el bloque de ALTER DEFAULT PRIVILEGES de la 00049. Sin
-- ella, la suite pasaria igual con una migracion que solo revoque lo existente, y el agujero
-- volveria a abrirse en la siguiente tabla que alguien cree.
--
-- La tabla se crea dentro de la transaccion de la prueba y desaparece con el ROLLBACK final.
CREATE TABLE public.tabla_de_prueba_privilegios_408 (id INT);

SELECT ok(
  NOT has_table_privilege('anon', 'public.tabla_de_prueba_privilegios_408', 'TRUNCATE'),
  'una tabla recien creada NO le concede TRUNCATE a anon'
);

SELECT is_empty(
  $$
    SELECT privilege_type
    FROM information_schema.role_table_grants
    WHERE grantee = 'anon'
      AND table_schema = 'public'
      AND table_name = 'tabla_de_prueba_privilegios_408'
  $$,
  'una tabla recien creada no le concede ningun privilegio a anon'
);

-- ============================================================================
-- 8. anon no tiene EXECUTE en ninguna funcion invocable de public (issue #511)
-- ============================================================================
-- Se excluyen las RETURNS TRIGGER a proposito: Postgres no permite invocarlas fuera de un
-- trigger sin importar el GRANT ("trigger functions can only be called as triggers"), asi que
-- barrerlas aqui no probaria nada real y solo obligaria a mantener una lista que crece con cada
-- trigger nuevo del esquema.
SELECT is_empty(
  $$
    SELECT p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND pg_get_function_result(p.oid) <> 'trigger'
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  $$,
  'anon no tiene EXECUTE en ninguna funcion invocable (no-trigger) de public'
);

-- ============================================================================
-- 9. El barrido no se paso de la raya: authenticated conserva lo que las politicas RLS usan
-- ============================================================================
SELECT ok(
  has_function_privilege('authenticated', 'es_administrador()', 'EXECUTE')
    AND has_function_privilege('authenticated', 'es_consultivo()', 'EXECUTE')
    AND has_function_privilege('authenticated', 'rol_actual()', 'EXECUTE')
    AND has_function_privilege('authenticated', 'tiene_permiso(text)', 'EXECUTE')
    AND has_function_privilege('authenticated', 'participa_en_jornada(uuid)', 'EXECUTE')
    AND has_function_privilege('authenticated', 'f_unaccent(text)', 'EXECUTE')
    AND has_function_privilege(
      'authenticated', 'fn_aplicar_ajuste_existencias(uuid, uuid, tipo_movimiento, integer)', 'EXECUTE'
    ),
  'authenticated conserva EXECUTE en las funciones que las politicas RLS y sus triggers necesitan'
);

-- No hay una prueba 10 con una funcion nueva, a diferencia de la 4 con la tabla de prueba: se
-- intento (ALTER DEFAULT PRIVILEGES ... ON FUNCTIONS FROM PUBLIC, ver 00097) y no suprime el
-- EXECUTE a PUBLIC que Postgres concede por defecto a una funcion nueva en este entorno. Queda
-- como limitacion conocida, no como prueba que finja demostrar algo que no pasa.

SELECT * FROM finish();
ROLLBACK;
