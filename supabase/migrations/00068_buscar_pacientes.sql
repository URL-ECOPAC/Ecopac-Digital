-- Ecopac Digital - Busqueda de pacientes por nombre, comunidad y numero de ficha (issue #115)
--
-- EXCEPCION DE ALCANCE AUTORIZADA (issue #115, platform:shared): #70 (00011) indexo una
-- EXPRESION, no una columna:
--
--   USING GIN ((lower(public.f_unaccent(nombres || ' ' || apellidos))) extensions.gin_trgm_ops)
--
-- PostgREST solo genera "columna operador valor"; ninguna llamada de supabase-js reproduce esa
-- expresion, asi que el criterio 5 (usar el indice) es inalcanzable desde el cliente. Una
-- columna generada lo arreglaria, pero no el criterio 4: ordenar por relevancia es
-- ORDER BY similarity(expresion, termino), que depende del termino y por eso no puede ser una
-- columna, y .order() de PostgREST solo acepta nombres de columna. Por eso esta busqueda es una
-- funcion, igual que personal_registro_atenciones (00044) y fn_contar_atenciones_incompletas
-- (00051): una regla que la API de PostgREST no puede expresar por si sola.
--
-- SOBRE EL OPERADOR Y EL UMBRAL
--
-- <% (word_similarity) compara el termino contra la MEJOR coincidencia dentro del nombre
-- completo, no contra el nombre entero: similarity() daria un valor bajo comparando "perez" con
-- "maria jose perez xoc" y perderia el resultado. <% SI es indexable por GIN (gin_trgm_ops
-- soporta %, <% y %>; solo <-> es exclusivo de GiST).
--
-- El umbral de <% (pg_trgm.word_similarity_threshold, default 0.6) es una GUC de sesion; las
-- conexiones de PostgREST vienen de un pool y no controlan ese estado. Se fija en 0.4 con la
-- clausula SET de CREATE FUNCTION, que aplica solo durante la llamada y se revierte al salir sin
-- filtrarse a la sesion. Verificado con Postgres real (sin Docker: instancia aislada con
-- initdb, ver Notas de deploy del PR): current_setting() dentro de la funcion refleja el valor
-- fijado, y un termino marginal cambia de resultado entre un umbral de 0.9 y uno de 0.1, asi que
-- no es un placeholder ignorado. similarity(...) > 0.4 explicito seria igual de determinista
-- pero NO indexable (es una funcion, no un operador), y forzaria el recorrido secuencial que el
-- criterio 5 prohibe.
--
-- El termino se normaliza con la MISMA funcion que calculo el indice (public.f_unaccent, 00011):
-- una sola regla de normalizacion en todo el sistema, para que shared y la base nunca diverjan.
--
-- SET search_path = '' obliga a calificar todo, incluidos los operadores de pg_trgm, que se
-- califican con OPERATOR(extensions.<%) y no con punto. Las extensiones viven en el schema
-- extensions desde 00001/00005.
--
-- SECURITY INVOKER (no DEFINER): las politicas de SELECT de pacientes, expedientes y comunidades
-- (00032, 00008) siguen decidiendo quien ve que. Junta directiva y socio fundador reciben cero
-- filas sin error (00032 lo decidio a proposito: no hay subconjunto de pacientes "no
-- identificable" que mostrarles).
--
-- La busqueda excluye pacientes dados de baja (fecha_baja IS NULL). No se agrega un parametro
-- p_incluir_bajas: nadie lo pidio todavia y agrega una superficie que habria que probar sin uso
-- real. Documentado tambien en Notas de deploy del PR.
--
-- POR QUE LA CONSULTA TIENE ESTA FORMA (CTEs + subconsultas escalares, no CROSS JOIN)
--
-- LIMIT/OFFSET no admiten una referencia a una columna de una relacion del FROM de la propia
-- consulta ("argument of LIMIT must not contain variables"): ni una columna de tabla ni una
-- columna de un CTE unido con JOIN/CROSS JOIN. Los parametros de la funcion (p_pagina,
-- p_por_pagina) SI se pueden usar directo -no son una variable correlacionada con el FROM- pero
-- el total de coincidencias no se conoce hasta filtrar, asi que paginar mas alla del final
-- perderia el total (ver mas abajo). La salida es una subconsulta escalar: `(SELECT columna FROM
-- cte)` SI esta permitida en LIMIT/OFFSET porque no es una variable de la consulta, es un
-- subplan independiente que se evalua una vez.
--
-- Por el mismo motivo, el termino de busqueda normalizado no viaja en un CTE aparte unido con
-- CROSS JOIN: un CTE asi se referencia dos veces (WHERE y SELECT) y no se inlinea, lo que
-- convierte el lado izquierdo del <% en una columna de una relacion unida en vez de un escalar
-- evaluable aparte del scan de pacientes -exactamente lo que le esconde el Index Cond al
-- planificador-. Aqui el termino va inline, calculado directo desde el parametro, dentro del
-- WHERE del CTE "coincidencias": ese CTE se planifica de forma independiente sin importar
-- cuantas veces se reuse su resultado despues (confirmado con EXPLAIN: el filtro aparece una
-- sola vez, como la definicion del CTE, y tanto el conteo como la pagina final lo reutilizan sin
-- volver a evaluarlo).
--
-- POR QUE LA PAGINA SE CLAMPEA EN SQL Y NO EN JS (criterio 4: paginado)
--
-- count(*) OVER() u otra tecnica que adjunte el total a cada fila de salida no sirve si la
-- pagina pedida cae despues del final: el OFFSET/LIMIT devuelve cero filas, y sin filas no hay
-- donde adjuntar el total -la pantalla veria "0 resultados" habiendo cientos-. La alternativa
-- (que packages/shared recuerde el ultimo total conocido) exige estado entre llamadas que una
-- funcion sin memoria no tiene. La solucion queda enteramente en esta funcion, en una sola
-- llamada: "paginacion_clampeada" calcula la ultima pagina real (greatest(ceil(total/por_pagina)
-- , 1)) y usa el minimo entre la pagina pedida y esa; garantiza que, si total > 0, el OFFSET
-- resultante siempre cae dentro del rango y la funcion devuelve al menos una fila -con la pagina
-- REAL servida, no la pedida, en la columna `pagina` de salida-. Verificado: pedir la pagina 99
-- de un total de 3 filas con 2 por pagina devuelve la pagina 2 (la ultima real) con total=3, no
-- una lista vacia. Cuando total = 0, la funcion no devuelve ninguna fila -es el unico caso en el
-- que eso ocurre, porque para cualquier total > 0 el clamping garantiza al menos una-, y
-- buscarPacientes() en packages/shared/pacientes/api.js interpreta "cero filas" como
-- { pacientes: [], total: 0 } sin necesidad de que la fila lo diga.
--
-- Los nombres de columna de salida no se llaman "id": pacientes, comunidades y expedientes
-- tienen las tres una columna "id", y aunque el cuerpo las califica todas (pa./co./ex.), una
-- columna de salida homonima de tres columnas de entrada es el tipo de colision que conviene
-- evitar por diseno.

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
      -- La pagina servida nunca pasa de la ultima con datos: greatest(...,1) contra un total 0
      -- da pagina 1 igual (sin filas que devolver de todos modos, ver comentario de cabecera).
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
