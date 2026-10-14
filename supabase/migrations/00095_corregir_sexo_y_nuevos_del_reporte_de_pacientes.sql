-- Corrige los dos errores de calculo de fn_reporte_pacientes_atendidos (issue #596).
--
-- La funcion nacio en la 00067 y se recreo tal cual en la 00080 y en la 00086, arrastrando los
-- dos errores. Ninguna de esas tres se edita: se corrige hacia adelante, que es la regla del
-- repositorio.
--
-- Se conserva intacto todo lo demas de la version de la 00086: la guarda de rol con
-- tiene_permiso('reportes.exportar'), SECURITY DEFINER, la firma y las diez columnas del
-- RETURNS TABLE.
--
--
-- ERROR 1: el desglose por sexo devolvia cero siempre.
--
-- Contaba con `upper(pg.sexo) = 'M'` y `= 'F'`, comparando contra la inicial. Pero
-- pacientes.sexo es un VARCHAR(20) sin CHECK (00009) que guarda la palabra completa: el
-- catalogo que escribe la aplicacion, OPCIONES_SEXO en pacientes/usePacientesListado.js, manda
-- "Femenino" y "Masculino". upper('Masculino') es 'MASCULINO', que nunca es 'M', asi que las
-- columnas hombres y mujeres salian en cero para cualquier consulta.
--
-- Es el mismo error que la 00076 y la 00077 ya habian evitado en fn_buscar_pacientes,
-- comparando `upper(pa.sexo) = upper(p_sexo)` -palabra completa contra palabra completa-.
--
-- Aqui se compara por la inicial con LIKE en vez de por igualdad con la palabra, a proposito:
-- la columna no tiene CHECK ni enum que garantice el vocabulario, y en la base ya conviven
-- filas escritas por pantallas distintas. 'M%' y 'F%' aciertan con "Masculino", "masculino",
-- "M" y "Femenino", "femenino", "F" por igual. No es la solucion definitiva -esa es normalizar
-- la columna, que es un cambio de esquema con su propia issue- pero es la que hace que el
-- reporte diga la verdad sobre los datos que hay hoy.
--
--
-- ERROR 2: un paciente recurrente contaba como nuevo en cada grupo.
--
-- es_nuevo se resolvia contra primera_fecha_del_periodo, que es
-- MIN(jornada.fecha) OVER (PARTITION BY paciente_id): el mismo valor para TODAS las filas de un
-- paciente. El resultado es que es_nuevo era constante por paciente en todo el reporte.
--
-- Agrupando por periodo, alguien atendido en enero y en marzo salia como nuevo en los dos
-- meses. Lo correcto es nuevo en enero y recurrente en marzo. Con agrupacion por comunidad
-- pasaba lo mismo entre comunidades.
--
-- No saltaba a la vista porque nuevos + recurrentes seguia cuadrando con pacientes dentro de
-- cada grupo; lo que se inflaba era el total de nuevos al sumar los grupos.
--
-- La correccion es comparar contra la fecha de la jornada de cada fila, t.jornada_fecha. Con
-- eso primera_fecha_del_periodo deja de tener uso y se elimina de la CTE.
--
-- Se mantiene deliberadamente que la comparacion mire a public.atenciones COMPLETO y no al
-- subconjunto filtrado: si solo mirara lo filtrado, consultar una sola jornada haria pasar por
-- nuevo a quien ya venia asistiendo. Tambien se mantiene que la cronologia salga de
-- jornadas.fecha y no de atenciones.created_at, que es la marca tecnica de captura y en una
-- carga masiva es identica para todas las filas.

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
      p.sexo,
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
    COUNT(*) FILTER (WHERE upper(pg.sexo) LIKE 'M%')::INT,
    COUNT(*) FILTER (WHERE upper(pg.sexo) LIKE 'F%')::INT,
    COUNT(*) FILTER (WHERE pg.edad < 18)::INT,
    COUNT(*) FILTER (WHERE pg.edad BETWEEN 18 AND 59)::INT,
    COUNT(*) FILTER (WHERE pg.edad >= 60)::INT
  FROM por_grupo pg
  GROUP BY pg.g_id, pg.g_nombre
  ORDER BY pg.g_nombre;
END;
$$;

COMMENT ON FUNCTION fn_reporte_pacientes_atendidos(TEXT, UUID, UUID, DATE, DATE) IS
  'Pacientes atendidos agregados por jornada, comunidad o mes, con el desglose por sexo y por '
  'rango de edad y la distincion entre pacientes nuevos y recurrentes (issue #202, RF-31). '
  'Cuenta pacientes distintos, no atenciones: dos atenciones del mismo paciente en la misma '
  'jornada son un solo paciente atendido. La edad se calcula a la fecha de la jornada, no a la '
  'de hoy, para que un reporte de hace tres anios no envejezca con el tiempo. SECURITY DEFINER '
  'con guarda de rol explicita: los roles consultivos no tienen politica de SELECT sobre '
  'pacientes (00032) y esta funcion necesita sexo y fecha_nacimiento para los desgloses. '
  'Devuelve UNICAMENTE agregados: ninguna fila del resultado identifica a un paciente, que es la '
  'regla que fija la 00054 (issue #407). '
  'La 00095 corrigio dos errores de calculo (issue #596): el sexo se comparaba contra la inicial '
  'cuando la columna guarda la palabra completa, asi que hombres y mujeres salian en cero; y un '
  'paciente recurrente contaba como nuevo en todos sus grupos porque es_nuevo se resolvia contra '
  'su primera jornada del reporte y no contra la jornada de cada fila.';
