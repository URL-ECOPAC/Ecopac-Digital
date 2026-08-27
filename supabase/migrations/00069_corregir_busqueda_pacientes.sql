-- Corrección para migración 00068_buscar_pacientes.sql
-- 
-- La migración 00068 falló al desplegarse porque la cláusula SET 
-- pg_trgm.word_similarity_threshold = 0.4 requiere que la librería pg_trgm
-- esté cargada en la sesión actual, lo cual no ocurre en el rol postgres
-- de Supabase managed (no es superusuario).
--
-- Esta migración vuelve a crear la función fn_buscar_pacientes, esta vez
-- forzando la carga de pg_trgm antes del CREATE FUNCTION con un SELECT
-- que no tiene efectos secundarios.
--
-- Ver incidente #485 para más detalles.

-- Forzar la carga de la librería pg_trgm en esta sesión
SELECT extensions.word_similarity('', '');

-- Recrear la función con la misma definición, pero ahora la carga de pg_trgm
-- ya ocurrió en esta sesión, así que la cláusula SET no requerirá superusuario
CREATE OR REPLACE FUNCTION fn_buscar_pacientes(
  p_termino TEXT DEFAULT NULL,
  p_comunidad_id UUID DEFAULT NULL,
  p_pagina INT DEFAULT 1,
  p_por_pagina INT DEFAULT 20
)
RETURNS TABLE (
  paciente_id UUID,
  nombres VARCHAR,
  apellidos VARCHAR,
  fecha_nacimiento DATE,
  sexo VARCHAR,
  comunidad_id UUID,
  comunidad_nombre VARCHAR,
  numero_ficha VARCHAR,
  relevancia REAL,
  pagina INT,
  por_pagina INT,
  total BIGINT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
SET pg_trgm.word_similarity_threshold = 0.4
AS $$
  WITH coincidencias AS (
    SELECT
      pa.id AS paciente_id,
      pa.nombres,
      pa.apellidos,
      pa.fecha_nacimiento,
      pa.sexo,
      pa.comunidad_id,
      co.nombre AS comunidad_nombre,
      ex.numero_ficha,
      CASE
        WHEN nullif(btrim(p_termino), '') IS NULL THEN 0::REAL
        ELSE extensions.word_similarity(
               lower(public.f_unaccent(btrim(p_termino))),
               lower(public.f_unaccent(pa.nombres || ' ' || pa.apellidos))
             )
      END AS relevancia
    FROM public.pacientes pa
    JOIN public.comunidades co ON co.id = pa.comunidad_id
    LEFT JOIN public.expedientes ex ON ex.paciente_id = pa.id
    WHERE pa.fecha_baja IS NULL
      AND (p_comunidad_id IS NULL OR pa.comunidad_id = p_comunidad_id)
      AND (
        nullif(btrim(p_termino), '') IS NULL
        OR lower(public.f_unaccent(btrim(p_termino)))
           OPERATOR(extensions.<%)
           lower(public.f_unaccent(pa.nombres || ' ' || pa.apellidos))
      )
  ),
  paginacion AS (
    SELECT
      least(greatest(coalesce(p_por_pagina, 20), 1), 100) AS por_pagina,
      count(*) AS total
    FROM coincidencias
  ),
  paginacion_clampeada AS (
    SELECT
      por_pagina,
      total,
      greatest(
        least(coalesce(p_pagina, 1), greatest(ceil(total::NUMERIC / por_pagina)::INT, 1)),
        1
      ) AS pagina
    FROM paginacion
  )
  SELECT
    c.paciente_id,
    c.nombres,
    c.apellidos,
    c.fecha_nacimiento,
    c.sexo,
    c.comunidad_id,
    c.comunidad_nombre,
    c.numero_ficha,
    c.relevancia,
    (SELECT pagina FROM paginacion_clampeada),
    (SELECT por_pagina FROM paginacion_clampeada),
    (SELECT total FROM paginacion_clampeada)
  FROM coincidencias c
  ORDER BY c.relevancia DESC, c.apellidos ASC, c.nombres ASC, c.paciente_id ASC
  OFFSET ((SELECT pagina FROM paginacion_clampeada) - 1) * (SELECT por_pagina FROM paginacion_clampeada)
  LIMIT (SELECT por_pagina FROM paginacion_clampeada);
$$;

GRANT EXECUTE ON FUNCTION fn_buscar_pacientes(TEXT, UUID, INT, INT) TO authenticated;

COMMENT ON FUNCTION fn_buscar_pacientes(TEXT, UUID, INT, INT) IS
  'Busca pacientes por nombre (tolerando acentos y errores de tipeo, via el indice de trigramas '
  'de 00011 y el operador <% de word_similarity), filtrando opcionalmente por comunidad, con '
  'resultados paginados y ordenados por relevancia. Si la pagina pedida cae despues del final, '
  'devuelve la ultima pagina real (columna pagina) en vez de una lista vacia con el total '
  'perdido. Excluye pacientes con fecha_baja. La usa buscarPacientes() de '
  'packages/shared/pacientes/api.js (issue #115). Existe como funcion porque PostgREST no puede '
  'reproducir la expresion indexada ni ordenar por similarity(). SECURITY INVOKER: respeta las '
  'politicas de SELECT de 00032/00008.';