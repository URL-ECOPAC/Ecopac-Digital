-- Todo objeto del esquema public tiene descripcion (issue #233, 00156). Corre con:
-- supabase test db
--
-- docs/DICCIONARIO-DE-DATOS.md se genera del catalogo y sus descripciones son los COMMENT ON de
-- las migraciones. Una tabla o columna nueva sin COMMENT ON sale en el diccionario como un hueco.
-- Si esta prueba falla, la migracion que agrego el objeto le agrega su COMMENT ON (o se escribe
-- una migracion nueva que lo haga) y se regenera el diccionario con `npm run docs:diccionario`.

BEGIN;

SELECT plan(5);

SELECT is(
  (SELECT string_agg(c.relname, ', ' ORDER BY c.relname)
     FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
      AND obj_description(c.oid, 'pg_class') IS NULL),
  NULL,
  'toda tabla tiene COMMENT ON TABLE'
);

SELECT is(
  (SELECT string_agg(c.relname || '.' || a.attname, ', ' ORDER BY c.relname, a.attnum)
     FROM pg_attribute a
     JOIN pg_class c ON c.oid = a.attrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND a.attnum > 0 AND NOT a.attisdropped
      AND col_description(c.oid, a.attnum) IS NULL),
  NULL,
  'toda columna tiene COMMENT ON COLUMN'
);

SELECT is(
  (SELECT string_agg(c.relname, ', ' ORDER BY c.relname)
     FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'v'
      AND obj_description(c.oid, 'pg_class') IS NULL),
  NULL,
  'toda vista tiene COMMENT ON VIEW'
);

SELECT is(
  (SELECT string_agg(t.typname, ', ' ORDER BY t.typname)
     FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typtype = 'e'
      AND obj_description(t.oid, 'pg_type') IS NULL),
  NULL,
  'todo tipo enumerado tiene COMMENT ON TYPE'
);

SELECT is(
  (SELECT string_agg(p.proname, ', ' ORDER BY p.proname)
     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND obj_description(p.oid, 'pg_proc') IS NULL
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')),
  NULL,
  'toda funcion tiene COMMENT ON FUNCTION'
);

SELECT * FROM finish();
ROLLBACK;
