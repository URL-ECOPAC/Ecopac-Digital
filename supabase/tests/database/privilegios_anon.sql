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

BEGIN;

SELECT plan(7);

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

SELECT * FROM finish();
ROLLBACK;
