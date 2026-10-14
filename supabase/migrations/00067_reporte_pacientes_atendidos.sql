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
  IF NOT (public.es_administrador() OR public.rol_actual() = 'junta directiva') THEN
    RAISE EXCEPTION 'Solo administracion y junta directiva consultan el reporte de pacientes atendidos.';
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
      date_part('year', age(j.fecha, p.fecha_nacimiento))::INT AS edad,
      MIN(j.fecha) OVER (PARTITION BY a.paciente_id) AS primera_fecha_del_periodo
    FROM public.atenciones a
    JOIN public.jornadas j ON j.id = a.jornada_id
    JOIN public.pacientes p ON p.id = a.paciente_id
    JOIN public.comunidades c ON c.id = j.comunidad_id
    WHERE (p_jornada_id IS NULL OR j.id = p_jornada_id)
      AND (p_comunidad_id IS NULL OR c.id = p_comunidad_id)
      AND (p_desde IS NULL OR j.fecha >= p_desde)
      AND (p_hasta IS NULL OR j.fecha <= p_hasta)
  ),
  -- Un paciente es nuevo si la primera jornada en la que aparece en este reporte es tambien la
  -- primera en la que se le atendio en toda su historia. Si ya lo habian atendido en una
  -- jornada anterior, es recurrente. Se compara contra atenciones completo, no contra el
  -- subconjunto filtrado: de otro modo, filtrar por una jornada haria pasar por nuevo a quien
  -- ya venia asistiendo.
  --
  -- La cronologia sale de jornadas.fecha y no de atenciones.created_at a proposito:
  -- created_at es la marca tecnica de cuando se capturo la fila, que en una carga masiva o en
  -- una misma transaccion es identica para todas y no ordena nada. La fecha de la jornada es
  -- la fecha clinica real, que es la que este reporte mide.
  clasificados AS (
    SELECT DISTINCT ON (t.paciente_id, t.jornada_id)
      t.*,
      NOT EXISTS (
        SELECT 1
        FROM public.atenciones previa
        JOIN public.jornadas jp ON jp.id = previa.jornada_id
        WHERE previa.paciente_id = t.paciente_id
          AND jp.fecha < t.primera_fecha_del_periodo
      ) AS es_nuevo
    FROM atendidos t
  ),
  -- Una fila por paciente y grupo: si alguien fue atendido dos veces en la misma jornada,
  -- cuenta como un paciente atendido, no como dos.
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
    COUNT(*) FILTER (WHERE upper(pg.sexo) = 'M')::INT,
    COUNT(*) FILTER (WHERE upper(pg.sexo) = 'F')::INT,
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
  'con guarda de rol explicita, mismo criterio que la vista pacientes_reporte (00041): junta '
  'directiva no tiene politica de SELECT sobre pacientes (00032), y esta funcion necesita sexo '
  'y fecha_nacimiento para los desgloses. Devuelve UNICAMENTE agregados: ninguna fila del '
  'resultado identifica a un paciente, que es la regla que fija la 00054 (issue #407).';

GRANT EXECUTE ON FUNCTION fn_reporte_pacientes_atendidos(TEXT, UUID, UUID, DATE, DATE)
  TO authenticated;
