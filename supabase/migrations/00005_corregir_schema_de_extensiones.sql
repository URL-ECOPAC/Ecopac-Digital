-- Ecopac Digital - Corregir el schema de las extensiones
--
-- POR QUE EXISTE ESTA MIGRACION
--
-- La 00001 se edito despues de haberse aplicado en ecopac-dev, para calificar las
-- extensiones con WITH SCHEMA extensions. Supabase ya la tenia registrada en
-- supabase_migrations.schema_migrations, asi que esa edicion nunca corrio en el remoto:
-- alli pg_trgm, unaccent, citext y btree_gist siguen en public, y la 00002 falla al
-- referenciar extensions.citext.
--
-- Una migracion aplicada no se puede corregir editandola: hay que corregirla hacia
-- adelante, con una migracion nueva. Eso es lo que hace este archivo.
--
-- QUE HACE
--
-- Mueve al schema extensions las cuatro extensiones que pudieron quedar en public, y
-- solo si de verdad estan en otro schema. En una base fresca (el stack local del CI y
-- ecopac-prod cuando se despliegue) la 00001 vigente ya las crea en extensions, asi que
-- ahi esta migracion no hace nada. El mismo archivo sirve para los tres destinos.
--
-- pgcrypto no aparece en la lista a proposito: Supabase Cloud ya la trae instalada en
-- extensions, de modo que el CREATE EXTENSION IF NOT EXISTS de la 00001 fue un no-op y
-- extensions.gen_random_uuid() siempre resolvio bien.

DO $$
DECLARE
  extension_a_mover TEXT;
  schema_actual TEXT;
BEGIN
  FOREACH extension_a_mover IN ARRAY ARRAY['pg_trgm', 'unaccent', 'citext', 'btree_gist']
  LOOP
    SELECT n.nspname
      INTO schema_actual
      FROM pg_extension e
      JOIN pg_namespace n ON n.oid = e.extnamespace
     WHERE e.extname = extension_a_mover;

    IF schema_actual IS NULL THEN
      RAISE NOTICE 'La extension % no esta instalada; no hay nada que mover.', extension_a_mover;
    ELSIF schema_actual = 'extensions' THEN
      RAISE NOTICE 'La extension % ya esta en extensions; se omite.', extension_a_mover;
    ELSE
      RAISE NOTICE 'Moviendo la extension % de % a extensions.', extension_a_mover, schema_actual;
      EXECUTE format('ALTER EXTENSION %I SET SCHEMA extensions', extension_a_mover);
    END IF;
  END LOOP;
END;
$$;

-- Verificacion: si alguna quedo fuera de extensions, la migracion falla en vez de dejar
-- el problema para que lo descubra la siguiente migracion.
DO $$
DECLARE
  fuera_de_lugar TEXT;
BEGIN
  SELECT string_agg(e.extname || ' (en ' || n.nspname || ')', ', ')
    INTO fuera_de_lugar
    FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
   WHERE e.extname IN ('pg_trgm', 'unaccent', 'citext', 'btree_gist', 'pgcrypto')
     AND n.nspname <> 'extensions';

  IF fuera_de_lugar IS NOT NULL THEN
    RAISE EXCEPTION 'Estas extensiones quedaron fuera del schema extensions: %', fuera_de_lugar;
  END IF;
END;
$$;
