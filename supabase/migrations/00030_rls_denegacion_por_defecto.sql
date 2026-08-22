-- Ecopac Digital - Habilitar RLS en todas las tablas con denegacion por defecto
-- Deja cada tabla del esquema publico con RLS activo y sin ninguna politica permisiva
-- todavia, de modo que el estado inicial sea denegar todo. Las politicas por grupo de
-- tablas se agregan en issues siguientes.

-- Habilita RLS en cualquier tabla del esquema publico que todavia no lo tenga. Se
-- recorre pg_tables en vez de listar tablas a mano para cubrir de una vez todas las
-- tablas creadas hasta ahora en las migraciones 00001-00029, sin depender de que cada
-- una se haya acordado de habilitarlo por su cuenta.
DO $$
DECLARE
  tabla_sin_rls RECORD;
BEGIN
  FOR tabla_sin_rls IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND NOT rowsecurity
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tabla_sin_rls.tablename);
  END LOOP;
END;
$$;

-- Consulta de verificacion: debe devolver cero filas. Lista cualquier tabla del
-- esquema publico sin RLS habilitado, para poder confirmarlo en cualquier momento
-- (incluida una migracion futura que agregue una tabla y olvide activarlo) con
-- SELECT * FROM tablas_sin_rls.
CREATE OR REPLACE VIEW tablas_sin_rls AS
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND NOT rowsecurity;

COMMENT ON VIEW tablas_sin_rls IS
  'Verificacion de RLS: debe devolver cero filas. Lista las tablas del schema public sin row level security habilitado.';

-- Es informacion de introspeccion del esquema, no datos de negocio, pero no tiene
-- motivo para exponerse via la API: se restringe a los roles administrativos.
REVOKE ALL ON tablas_sin_rls FROM PUBLIC, anon, authenticated;
