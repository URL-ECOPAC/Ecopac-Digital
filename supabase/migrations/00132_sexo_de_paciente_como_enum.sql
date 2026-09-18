-- Un solo vocabulario para pacientes.sexo, y una sola regla para el DPI (issue #699).
--
-- POR QUE EXISTE ESTA MIGRACION
--
-- `pacientes.sexo` es VARCHAR(20) NOT NULL desde la 00009, **sin CHECK**: es la unica columna
-- categorica del esquema que no es un enum, con 21 tipos enumerados ya declarados. El vocabulario
-- real vivia en OPCIONES_SEXO, dentro de un hook de packages/shared -- un sitio que la base no puede
-- hacer cumplir.
--
-- No es un problema teorico. La 00095 lo cuenta en su propia cabecera: fn_reporte_pacientes_atendidos
-- comparaba `upper(pg.sexo) = 'M'` contra una columna que guarda la palabra completa, asi que las
-- columnas hombres y mujeres del reporte **salian en cero para cualquier consulta**. La 00095 lo
-- parcheo con `LIKE 'M%'` / `'F%'` y dejo escrito que no era la solucion:
--
--   "No es la solucion definitiva -esa es normalizar la columna, que es un cambio de esquema con su
--    propia issue- pero es la que hace que el reporte diga la verdad sobre los datos que hay hoy."
--
-- Esta es esa issue. Con el enum, el parche sobra: el reporte vuelve a comparar por igualdad.
--
-- QUE SE CONVIERTE, Y QUE PASA SI APARECE OTRA COSA
--
-- El UPDATE de abajo normaliza las variantes conocidas -inicial, minusculas, mayusculas- a las dos
-- palabras del enum. Lo que no encaje **hace fallar el ALTER**, y eso es deliberado: una migracion
-- que revienta en el CI se ve; una que convierte a ciegas -mapeando lo desconocido a un valor
-- cualquiera- deja datos clinicos mal clasificados que nadie vuelve a mirar.
--
-- LAS TRES FUNCIONES SE RECREAN CON LA MISMA FIRMA, Y ESO NO ES CASUALIDAD
--
-- fn_registrar_paciente, fn_buscar_pacientes y fn_reporte_pacientes_atendidos son las unicas que
-- tocan la columna. CREATE OR REPLACE conserva el oid, y con el los GRANT que fijo la 00102 (y la
-- #511) y los COMMENT. Cambiar el tipo de una columna del RETURNS TABLE obligaria a DROP + CREATE y
-- a volver a otorgar los privilegios a mano, que es justo donde se pierden: por eso `sexo` sale
-- casteado a VARCHAR en las dos funciones que lo devuelven, en vez de cambiarles la firma.

-- ============================================================================
-- 1. sexo: de texto libre a enum
-- ============================================================================

CREATE TYPE sexo_paciente AS ENUM ('Femenino', 'Masculino');

COMMENT ON TYPE sexo_paciente IS
  'Sexo del paciente (issue #699). Los dos valores son los que la aplicacion ya escribia desde '
  'OPCIONES_SEXO y los unicos que hay en la base. Espejo de SEXOS en packages/shared/enums.js. '
  'Agregar un valor es ALTER TYPE ... ADD VALUE, y exige actualizar ese archivo en el mismo PR.';

-- Variantes conocidas -> palabra completa. Lo que no caiga aqui revienta en el ALTER de abajo.
UPDATE pacientes
SET sexo = CASE
  WHEN upper(btrim(sexo)) IN ('M', 'MASCULINO', 'HOMBRE') THEN 'Masculino'
  WHEN upper(btrim(sexo)) IN ('F', 'FEMENINO', 'MUJER') THEN 'Femenino'
  ELSE sexo
END
WHERE sexo IS DISTINCT FROM 'Masculino' AND sexo IS DISTINCT FROM 'Femenino';

ALTER TABLE pacientes
  ALTER COLUMN sexo TYPE sexo_paciente USING sexo::sexo_paciente;

COMMENT ON COLUMN pacientes.sexo IS
  'Sexo del paciente, enum sexo_paciente desde la 00132 (issue #699). Hasta entonces era un '
  'VARCHAR(20) sin CHECK y cada pantalla podia escribir lo que quisiera.';

-- ============================================================================
-- 2. DPI: una sola regla, y la hace cumplir la base
-- ============================================================================
--
-- Habia tres longitudes a la vez: la columna VARCHAR(20) sin CHECK, el descriptor de registro con
-- maxLongitud 20, el de edicion con 13 y REGEX_DPI con 13. La correcta es 13: es lo que tiene un DPI
-- guatemalteco. El descriptor baja a 13 en este mismo PR (packages/shared/pacientes/campos.js).
--
-- Entra VALID de una vez, sin NOT VALID: los datos ya cumplen -13 digitos o NULL-, y un CHECK que
-- nace sin validar es un CHECK que nadie valida despues. Sigue siendo opcional: mucha poblacion
-- rural no tiene DPI, y esa decision no cambia aqui.

ALTER TABLE pacientes
  ADD CONSTRAINT chk_pacientes_dpi_13_digitos
  CHECK (dpi IS NULL OR dpi ~ '^[0-9]{13}$');

COMMENT ON CONSTRAINT chk_pacientes_dpi_13_digitos ON pacientes IS
  'El DPI guatemalteco tiene exactamente 13 digitos (issue #699). Espejo de REGEX_DPI en '
  'packages/shared/pacientes/validaciones.js. NULL sigue permitido: el DPI es opcional.';

-- ============================================================================
-- 3. Las tres funciones que tocan la columna
-- ============================================================================
--
-- Las tres se recrean con la MISMA firma que tienen hoy, para conservar oid, GRANT y COMMENT. Los
-- cuerpos son los vigentes -fn_registrar_paciente de la 00110, fn_buscar_pacientes de la 00111 y
-- fn_reporte_pacientes_atendidos de la 00095- con el cambio minimo que exige el enum, marcado con
-- un comentario en cada sitio.

-- 3.1 fn_registrar_paciente.
--
-- OJO AL CUERPO DEL QUE PARTE ESTA VERSION, Y POR QUE NO ES EL DE LA 00110.
--
-- La PR #841 (EAGutierrez04), abierta mientras se escribia esta, recrea esta misma funcion en su
-- 00131 para fijarle `SET search_path = ''` y calificar con public. los INSERT y los DECLARE. Dos
-- migraciones distintas que reemplazan la misma funcion no dan conflicto de git -- son archivos
-- distintos --, asi que la que se aplique al final gana y la otra desaparece sin que nada avise.
--
-- Esta version parte de la suya y le suma lo unico que necesita el enum: el cast. Asi, con la 00131
-- aplicada antes que esta, no se pierde su endurecimiento. En el orden contrario -- si la #841 se
-- mergeara despues -- el cast se perderia y registrar un paciente fallaria, asi que la descripcion
-- de esta PR lo dice y pide que se mergee despues de la #841.
--
-- Con search_path vacio, `sexo_paciente` tambien hay que calificarlo: dentro del cuerpo no hay
-- esquema por defecto que lo resuelva.
CREATE OR REPLACE FUNCTION fn_registrar_paciente(
  p_nombres VARCHAR,
  p_apellidos VARCHAR,
  p_fecha_nacimiento DATE,
  p_sexo VARCHAR,
  p_comunidad_id UUID,
  p_telefono_contacto VARCHAR,
  p_idioma VARCHAR,
  p_dpi VARCHAR DEFAULT NULL,
  p_tipo_sangre tipo_sanguineo DEFAULT NULL,
  p_nombre_responsable VARCHAR DEFAULT NULL,
  p_parentesco_responsable VARCHAR DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  nombres VARCHAR,
  apellidos VARCHAR,
  fecha_nacimiento DATE,
  sexo VARCHAR,
  comunidad_id UUID,
  telefono_contacto VARCHAR,
  idioma VARCHAR,
  dpi VARCHAR,
  tipo_sangre tipo_sanguineo,
  nombre_responsable VARCHAR,
  parentesco_responsable VARCHAR,
  fecha_baja DATE,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  numero_ficha VARCHAR
) AS $$
DECLARE
  v_paciente public.pacientes;
  v_expediente public.expedientes;
BEGIN
  INSERT INTO public.pacientes (
    nombres, apellidos, fecha_nacimiento, sexo, comunidad_id, telefono_contacto, idioma,
    dpi, tipo_sangre, nombre_responsable, parentesco_responsable
  )
  VALUES (
    -- El cast al enum es lo unico que agrega la 00132 al cuerpo de esta funcion. Postgres no asigna
    -- un VARCHAR tipado a una columna enum: sin el, el INSERT falla con "column sexo is of type
    -- sexo_paciente but expression is of type character varying". Un valor fuera del enum falla
    -- aqui con 22P02, que es lo que se busca: antes se guardaba tal cual.
    p_nombres, p_apellidos, p_fecha_nacimiento, p_sexo::public.sexo_paciente, p_comunidad_id,
    p_telefono_contacto, p_idioma, p_dpi, p_tipo_sangre, p_nombre_responsable,
    p_parentesco_responsable
  )
  RETURNING * INTO v_paciente;

  -- numero_ficha no se pasa: el DEFAULT de la columna (nextval de la 00081) lo genera aqui.
  INSERT INTO public.expedientes (paciente_id)
  VALUES (v_paciente.id)
  RETURNING * INTO v_expediente;

  RETURN QUERY SELECT
    v_paciente.id, v_paciente.nombres, v_paciente.apellidos, v_paciente.fecha_nacimiento,
    -- Y de vuelta a VARCHAR, que es lo que declara el RETURNS TABLE. Cambiarlo obligaria a soltar
    -- la funcion y volver a otorgar los GRANT a mano.
    v_paciente.sexo::VARCHAR, v_paciente.comunidad_id, v_paciente.telefono_contacto,
    v_paciente.idioma, v_paciente.dpi, v_paciente.tipo_sangre, v_paciente.nombre_responsable,
    v_paciente.parentesco_responsable, v_paciente.fecha_baja, v_paciente.created_at,
    v_paciente.updated_at, v_expediente.numero_ficha;
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- 3.2 fn_buscar_pacientes (cuerpo vigente: 00111).
--
-- Dos cambios, los dos por el enum: la columna sale casteada a VARCHAR -que es lo que declara el
-- RETURNS TABLE, y cambiarlo obligaria a soltar la funcion y volver a otorgar los GRANT- y el
-- filtro compara sobre el texto. Se conserva el upper() de los dos lados: el enum garantiza el
-- valor guardado, no lo que mande el cliente en p_sexo.
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
      pa.sexo::VARCHAR AS sexo,
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
      AND (p_sexo IS NULL OR upper(pa.sexo::TEXT) = upper(p_sexo))
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

-- 3.3 fn_reporte_pacientes_atendidos (cuerpo vigente: 00095).
--
-- ESTE ES EL MOTIVO DE LA ISSUE. La 00095 tuvo que comparar por inicial -LIKE 'M%' / 'F%'- porque
-- la columna no garantizaba el vocabulario y en la base podian convivir "M", "masculino" y
-- "Masculino". Con el enum eso ya no puede pasar, asi que vuelve la igualdad, que es lo que el DoD
-- pide y ademas usa el indice si algun dia hace falta.
--
-- El otro cambio es el cast a TEXT en la CTE: min() sobre el enum obligaria a razonar sobre el
-- orden de sus valores -que aqui no significa nada- y el resto de la funcion no se toca.
CREATE OR REPLACE FUNCTION fn_reporte_pacientes_atendidos(
  p_agrupar_por TEXT DEFAULT 'jornada',
  p_jornada_id UUID DEFAULT NULL,
  p_comunidad_id UUID DEFAULT NULL,
  p_desde DATE DEFAULT NULL,
  p_hasta DATE DEFAULT NULL
)
RETURNS TABLE(
  grupo_id TEXT,
  grupo TEXT,
  pacientes INT,
  nuevos INT,
  recurrentes INT,
  hombres INT,
  mujeres INT,
  menores INT,
  adultos INT,
  adultos_mayores INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT (public.es_administrador() OR public.es_consultivo() OR public.tiene_permiso('reportes.exportar')) THEN
    RAISE EXCEPTION 'Solo administracion, los roles consultivos o quien tiene reportes.exportar consultan el reporte de pacientes atendidos.';
  END IF;

  IF p_agrupar_por NOT IN ('jornada', 'comunidad', 'periodo') THEN
    RAISE EXCEPTION 'Agrupacion no valida: %. Use jornada, comunidad o periodo.', p_agrupar_por;
  END IF;

  RETURN QUERY
  WITH atendidos AS (
    SELECT
      a.paciente_id,
      j.id AS jornada_id,
      j.nombre AS jornada_nombre,
      j.fecha AS jornada_fecha,
      c.id AS comunidad_id,
      c.nombre AS comunidad_nombre,
      p.sexo::TEXT AS sexo,
      date_part('year', age(j.fecha, p.fecha_nacimiento))::INT AS edad
    FROM public.atenciones a
    JOIN public.jornadas j ON j.id = a.jornada_id
    JOIN public.pacientes p ON p.id = a.paciente_id
    JOIN public.comunidades c ON c.id = j.comunidad_id
    WHERE (p_jornada_id IS NULL OR j.id = p_jornada_id)
      AND (p_comunidad_id IS NULL OR c.id = p_comunidad_id)
      AND (p_desde IS NULL OR j.fecha >= p_desde)
      AND (p_hasta IS NULL OR j.fecha <= p_hasta)
  ),
  -- Un paciente es nuevo en una jornada si esa es la primera en la que se le atendio en toda
  -- su historia. Si ya lo habian atendido en una jornada anterior, en esta es recurrente.
  --
  -- La comparacion es contra t.jornada_fecha, la fecha de la jornada de ESTA fila. Antes era
  -- contra el minimo del paciente en todo el reporte, que hacia que la respuesta fuera la misma
  -- en todos sus grupos (issue #596).
  clasificados AS (
    SELECT DISTINCT ON (t.paciente_id, t.jornada_id)
      t.*,
      NOT EXISTS (
        SELECT 1
        FROM public.atenciones previa
        JOIN public.jornadas jp ON jp.id = previa.jornada_id
        WHERE previa.paciente_id = t.paciente_id
          AND jp.fecha < t.jornada_fecha
      ) AS es_nuevo
    FROM atendidos t
  ),
  -- Una fila por paciente y grupo: si alguien fue atendido dos veces en la misma jornada,
  -- cuenta como un paciente atendido, no como dos.
  --
  -- bool_or sobre es_nuevo resuelve el caso de agrupar por periodo o comunidad cuando un mismo
  -- paciente cae en dos jornadas del mismo grupo: si en alguna de ellas era nuevo, en el grupo
  -- cuenta como nuevo. Solo puede serlo en la primera, asi que el grupo lo cuenta una vez.
  por_grupo AS (
    SELECT
      CASE p_agrupar_por
        WHEN 'jornada' THEN cl.jornada_id::TEXT
        WHEN 'comunidad' THEN cl.comunidad_id::TEXT
        ELSE to_char(cl.jornada_fecha, 'YYYY-MM')
      END AS g_id,
      CASE p_agrupar_por
        WHEN 'jornada' THEN cl.jornada_nombre
        WHEN 'comunidad' THEN cl.comunidad_nombre
        ELSE to_char(cl.jornada_fecha, 'YYYY-MM')
      END AS g_nombre,
      cl.paciente_id,
      bool_or(cl.es_nuevo) AS es_nuevo,
      min(cl.sexo) AS sexo,
      min(cl.edad) AS edad
    FROM clasificados cl
    GROUP BY 1, 2, cl.paciente_id
  )
  SELECT
    pg.g_id,
    pg.g_nombre,
    COUNT(*)::INT,
    COUNT(*) FILTER (WHERE pg.es_nuevo)::INT,
    COUNT(*) FILTER (WHERE NOT pg.es_nuevo)::INT,
    -- Igualdad, no LIKE: el enum sexo_paciente (00132) garantiza la palabra exacta.
    COUNT(*) FILTER (WHERE pg.sexo = 'Masculino')::INT,
    COUNT(*) FILTER (WHERE pg.sexo = 'Femenino')::INT,
    COUNT(*) FILTER (WHERE pg.edad < 18)::INT,
    COUNT(*) FILTER (WHERE pg.edad BETWEEN 18 AND 59)::INT,
    COUNT(*) FILTER (WHERE pg.edad >= 60)::INT
  FROM por_grupo pg
  GROUP BY pg.g_id, pg.g_nombre
  ORDER BY pg.g_nombre;
END;
$$;

-- El COMMENT sobrevive a CREATE OR REPLACE, asi que se reescribe entero: el parrafo de la 00095
-- decia que el sexo se compara por inicial, y desde esta migracion ya no es cierto.
COMMENT ON FUNCTION fn_reporte_pacientes_atendidos(TEXT, UUID, UUID, DATE, DATE) IS
  'Pacientes atendidos agregados por jornada, comunidad o mes, con el desglose por sexo y por rango '
  'de edad y la distincion entre pacientes nuevos y recurrentes (issue #202, RF-31). Cuenta '
  'pacientes distintos, no atenciones: dos atenciones del mismo paciente en la misma jornada son un '
  'solo paciente atendido. La edad se calcula a la fecha de la jornada, no a la de hoy, para que un '
  'reporte de hace tres anios no envejezca con el tiempo. SECURITY DEFINER con guarda de rol '
  'explicita: los roles consultivos no tienen politica de SELECT sobre pacientes (00032) y esta '
  'funcion necesita sexo y fecha_nacimiento para los desgloses. Devuelve UNICAMENTE agregados: '
  'ninguna fila del resultado identifica a un paciente, que es la regla que fija la 00054 (issue '
  '#407). La 00095 corrigio dos errores de calculo (issue #596): el sexo se comparaba contra la '
  'inicial cuando la columna guardaba la palabra completa, asi que hombres y mujeres salian en cero; '
  'y un paciente recurrente contaba como nuevo en todos sus grupos. La 00132 (issue #699) retira el '
  'parche que dejo la 00095: con sexo convertido en el enum sexo_paciente, el desglose vuelve a '
  'compararse por igualdad y no por la inicial con LIKE.';
