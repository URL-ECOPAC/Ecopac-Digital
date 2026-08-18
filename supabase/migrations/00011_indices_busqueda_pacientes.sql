-- Ecopac Digital - Indices de busqueda de pacientes por nombre sin acentos
--
-- La busqueda principal de pacientes es por nombre completo (muchos no tienen DPI) y debe
-- tolerar acentos y errores de escritura. Para eso se agrega un indice GIN de trigramas
-- sobre el nombre completo normalizado, usando las extensiones pg_trgm y unaccent
-- instaladas en la migracion 00001.
--
-- Los indices sobre comunidad_id (idx_pacientes_comunidad_id) y numero de ficha
-- (numero_ficha UNIQUE) ya existen desde la migracion 00009; no se vuelven a crear.

-- ============================================================================
-- Funcion auxiliar
-- ============================================================================
-- extensions.unaccent() es STABLE, y una expresion de indice debe ser IMMUTABLE.
-- Este wrapper la declara IMMUTABLE para poder indexarla: es correcto porque el
-- diccionario 'unaccent' es fijo, asi que para el mismo texto siempre devuelve el
-- mismo resultado.
CREATE OR REPLACE FUNCTION public.f_unaccent(texto TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
AS $$
  SELECT extensions.unaccent('unaccent', texto);
$$;

COMMENT ON FUNCTION public.f_unaccent(TEXT) IS
  'Wrapper IMMUTABLE de extensions.unaccent, necesario para usar unaccent dentro de un indice.';

-- ============================================================================
-- Indice de trigramas
-- ============================================================================
-- El nombre completo se normaliza a minusculas y sin acentos antes de indexar. La
-- consulta de busqueda (issue #115) debe usar EXACTAMENTE esta misma expresion para
-- que el planificador reconozca el indice:
--
--   lower(public.f_unaccent(nombres || ' ' || apellidos))
CREATE INDEX idx_pacientes_nombre_completo_trgm ON pacientes
USING GIN (lower(public.f_unaccent(nombres || ' ' || apellidos)) extensions.gin_trgm_ops);
