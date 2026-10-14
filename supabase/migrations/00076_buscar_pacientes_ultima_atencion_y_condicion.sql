-- Carga pg_trgm en la sesion para que su parametro word_similarity_threshold quede
-- registrado antes del SET de la funcion. Sin esta linea Postgres no reconoce el
-- parametro y rechaza el SET con "permission denied to set parameter". Es el mismo
-- motivo por el que la 00068 la lleva.
SELECT extensions.word_similarity('', '');

DROP FUNCTION IF EXISTS fn_buscar_pacientes(TEXT, UUID, INT, INT);

CREATE OR REPLACE FUNCTION fn_buscar_pacientes(
  p_termino TEXT DEFAULT NULL,
  p_comunidad_id UUID DEFAULT NULL,
  p_pagina INT DEFAULT 1,
  p_por_pagina INT DEFAULT 20,
  p_condicion_cronica_id UUID DEFAULT NULL,
  p_sexo TEXT DEFAULT NULL,
  p_edad_min INT DEFAULT NULL,
  p_edad_max INT DEFAULT NULL
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
  ultima_atencion DATE,
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
      (
        SELECT max(jo.fecha)
        FROM public.atenciones at
        JOIN public.jornadas jo ON jo.id = at.jornada_id
        WHERE at.paciente_id = pa.id
      ) AS ultima_atencion,
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
        p_condicion_cronica_id IS NULL
        OR EXISTS (
             SELECT 1
             FROM public.padecimientos_cronicos pc
             WHERE pc.paciente_id = pa.id
               AND pc.condicion_id = p_condicion_cronica_id
               AND pc.estado = 'activa'
           )
      )
      AND (p_sexo IS NULL OR upper(pa.sexo) = upper(p_sexo))
      AND (
        p_edad_min IS NULL
        OR date_part('year', age(pa.fecha_nacimiento))::INT >= p_edad_min
      )
      AND (
        p_edad_max IS NULL
        OR date_part('year', age(pa.fecha_nacimiento))::INT <= p_edad_max
      )
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
    c.ultima_atencion,
    c.relevancia,
    (SELECT pagina FROM paginacion_clampeada),
    (SELECT por_pagina FROM paginacion_clampeada),
    (SELECT total FROM paginacion_clampeada)
  FROM coincidencias c
  ORDER BY c.relevancia DESC, c.apellidos ASC, c.nombres ASC, c.paciente_id ASC
  OFFSET ((SELECT pagina FROM paginacion_clampeada) - 1) * (SELECT por_pagina FROM paginacion_clampeada)
  LIMIT (SELECT por_pagina FROM paginacion_clampeada);
$$;

GRANT EXECUTE ON FUNCTION fn_buscar_pacientes(TEXT, UUID, INT, INT, UUID, TEXT, INT, INT) TO authenticated;

COMMENT ON FUNCTION fn_buscar_pacientes(TEXT, UUID, INT, INT, UUID, TEXT, INT, INT) IS
  'Busca pacientes por nombre (tolerando acentos y errores de tipeo, via el indice de trigramas '
  'de 00011 y el operador <% de word_similarity), filtrando opcionalmente por comunidad y por '
  'condicion cronica activa, con resultados paginados y ordenados por relevancia. Si la pagina '
  'pedida cae despues del final, devuelve la ultima pagina real (columna pagina) en vez de una '
  'lista vacia con el total perdido. Excluye pacientes con fecha_baja. La usa buscarPacientes() '
  'de packages/shared/pacientes/api.js. Existe como funcion porque PostgREST no puede reproducir '
  'la expresion indexada ni ordenar por similarity(). SECURITY INVOKER: respeta las politicas de '
  'SELECT de 00032/00008. '
  'Issue #124: se agregaron ultima_atencion, que la tabla del listado muestra como ultima '
  'columna, y el filtro por condicion cronica. ultima_atencion sale de la fecha de la jornada y '
  'no de atenciones.created_at, por el mismo motivo que el reporte de la 00067: created_at es la '
  'marca de captura, no la fecha clinica. Solo cuenta las condiciones en estado activa: filtrar '
  'por una condicion resuelta devolveria pacientes que ya no la padecen. '
  'Tambien se agregaron los filtros de sexo y rango de edad, que el wireframe (p. 62) si '
  'dibuja: van en el servidor y no en el cliente porque filtrar despues de paginar solo '
  'recortaria la pagina actual y dejaria el total mintiendo.';
