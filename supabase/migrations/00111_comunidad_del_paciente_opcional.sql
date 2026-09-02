-- Ecopac Digital - La comunidad del paciente deja de ser obligatoria (issue #657)
--
-- pacientes.comunidad_id era NOT NULL desde la 00009, asi que no se podia dar de alta a alguien
-- cuya comunidad no se supiera todavia o no estuviera en el catalogo. La organizacion confirma
-- que en la practica es un dato opcional.
--
-- POR QUE EL LEFT JOIN VA EN LA MISMA MIGRACION Y NO DESPUES
--
-- fn_buscar_pacientes une comunidades con INNER JOIN sobre pa.comunidad_id. En cuanto la columna
-- admite NULL, un paciente sin comunidad deja de existir para el listado y para la busqueda: no
-- da error, simplemente no aparece. Quitar el NOT NULL sin cambiar el JOIN dejaria registrar
-- pacientes invisibles, que es peor que no dejar registrarlos.
--
-- LO QUE NO HACE FALTA TOCAR, Y POR QUE
--
-- fn_reporte_pacientes_atendidos (00095) y vista_reporte_impacto (00086) tambien unen
-- comunidades, pero contra jornadas.comunidad_id: agrupan por la comunidad donde se hizo la
-- jornada, que sigue siendo obligatoria. No les afecta.
--
-- fn_registrar_paciente tampoco cambia. Su p_comunidad_id ya acepta NULL; lo que faltaba era que
-- el cliente lo enviara, y eso va del lado de JavaScript. Asi se evita otro DROP FUNCTION y
-- volver a otorgar el GRANT y el REVOKE de la #511.
--
-- Ninguna politica RLS filtra por comunidad_id: comprobado contra pg_policies.

ALTER TABLE pacientes
  ALTER COLUMN comunidad_id DROP NOT NULL;

-- Carga pg_trgm en la sesion para que su parametro word_similarity_threshold quede registrado
-- antes del SET de la funcion, igual que en la 00068, la 00076 y la 00077.
SELECT extensions.word_similarity('', '');

-- CREATE OR REPLACE basta: solo cambia el JOIN, no la firma ni el tipo de retorno, asi que el
-- GRANT y el REVOKE que la funcion ya tiene se conservan.
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
  condiciones TEXT[],
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
      (
        SELECT coalesce(array_agg(cc.nombre::TEXT ORDER BY cc.nombre), ARRAY[]::TEXT[])
        FROM public.padecimientos_cronicos pc
        JOIN public.condiciones_cronicas cc ON cc.id = pc.condicion_id
        WHERE pc.paciente_id = pa.id
          AND pc.estado <> 'resuelta'
      ) AS condiciones,
      CASE
        WHEN nullif(btrim(p_termino), '') IS NULL THEN 0::REAL
        ELSE extensions.word_similarity(
               lower(public.f_unaccent(btrim(p_termino))),
               lower(public.f_unaccent(pa.nombres || ' ' || pa.apellidos))
             )
      END AS relevancia
    FROM public.pacientes pa
    LEFT JOIN public.comunidades co ON co.id = pa.comunidad_id
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
               AND pc.estado <> 'resuelta'
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
    c.condiciones,
    c.relevancia,
    (SELECT pagina FROM paginacion_clampeada),
    (SELECT por_pagina FROM paginacion_clampeada),
    (SELECT total FROM paginacion_clampeada)
  FROM coincidencias c
  ORDER BY c.relevancia DESC, c.apellidos ASC, c.nombres ASC, c.paciente_id ASC
  OFFSET ((SELECT pagina FROM paginacion_clampeada) - 1) * (SELECT por_pagina FROM paginacion_clampeada)
  LIMIT (SELECT por_pagina FROM paginacion_clampeada);
$$;

COMMENT ON COLUMN pacientes.comunidad_id IS
  'Comunidad del paciente. Opcional desde la issue #657: en jornada no siempre se sabe, y '
  'obligarla llevaba a inventar una comunidad o a no registrar a la persona. fn_buscar_pacientes '
  'la une con LEFT JOIN para que un paciente sin comunidad siga apareciendo en el listado.';
