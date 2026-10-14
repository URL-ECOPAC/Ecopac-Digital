-- Toda funcion de public fija su propio search_path (issue #760, migracion 00131).
-- Corre con: supabase test db
--
-- POR QUE UNA PRUEBA Y NO UN SCRIPT ESTATICO SOBRE LOS .sql
--
-- supabase db lint no detecta function_search_path_mutable (revisa sintaxis/plpgsql_check, no
-- las heuristicas del Advisor). Esta prueba lee el catalogo real (pg_proc.proconfig) despues de
-- aplicar todas las migraciones, asi que no le puede pasar por alto una funcion corregida en una
-- migracion posterior a la que la creo -que es justo lo que le habria pasado a un regex sobre
-- los .sql, y que ya conto mal una vez (la issue original decia 14 funciones sin la clausula;
-- para cuando se escribio la 00131 ya eran 12, porque 00106/00107/00112 habian corregido 4)-.
-- Tambien detecta sola cualquier funcion nueva sin la clausula, sin que nadie tenga que ampliar
-- una lista.
--
-- Las cinco extensiones del proyecto (pgcrypto, pg_trgm, unaccent, citext, btree_gist) viven en
-- el schema extensions, no en public (00005), asi que filtrar por public no arrastra sus
-- funciones.

BEGIN;

SELECT plan(1);

SELECT is(
  (
    SELECT COALESCE(
      array_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' ORDER BY p.proname),
      ARRAY[]::text[]
    )
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND NOT EXISTS (
        SELECT 1
        FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg
        WHERE cfg LIKE 'search_path=%'
      )
  ),
  ARRAY[]::text[],
  'ninguna funcion de public deberia estar sin SET search_path fijo'
);

SELECT * FROM finish();
ROLLBACK;
