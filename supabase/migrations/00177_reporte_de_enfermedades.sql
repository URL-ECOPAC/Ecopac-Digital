-- ============================================================================
-- 00177: reporte de enfermedades por jornada y comunidad (issue #916)
-- ============================================================================
--
-- Hasta aqui la unica cuenta de enfermedades era el ranking de diagnosticos de UNA jornada
-- (fn_reporte_jornada, 00148). La organizacion necesita comparar jornadas y comunidades entre si
-- y ver la evolucion de una enfermedad en el tiempo ("hay mucho sarampion en esta comunidad").
--
-- 1. fn_reporte_enfermedades: cuenta diagnosticos del catalogo (consulta_diagnostico), agregados
--    en la base. "Enfermedad" es el diagnostico del catalogo, nunca el texto libre de
--    consultas.sintomas.
-- 2. fn_opciones_reporte_enfermedades: las jornadas, proyectos y diagnosticos que el reporte
--    ofrece para elegir. Hace falta porque los roles consultivos no leen `jornadas`, `proyectos`
--    ni `diagnosticos` por RLS, y sin esto sus selectores saldrian vacios.
--
-- PRIVACIDAD. Es un reporte agregado: nunca devuelve una fila por paciente. Aun asi, un conteo muy
-- bajo en una comunidad pequena identifica a una persona ("1 caso de VIH en la comunidad X"). La
-- organizacion decidio que toda cifra de 1 a 4 sale como "menos de 5", para todos los roles. La
-- supresion se hace aqui y no en el cliente: si la hiciera la pantalla, la cifra exacta viajaria
-- igual en la respuesta de la API. Si una celda del desglose por sexo o por edad se suprime, se
-- suprime el desglose entero, para que no se pueda deducir restando del total.
--
-- Mismo patron que 00148/00155: SECURITY DEFINER con la guarda puede_consultar_reportes() en el
-- cuerpo, porque la funcion lee tablas clinicas que los roles consultivos no pueden leer.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Conteo de enfermedades
-- ----------------------------------------------------------------------------
CREATE FUNCTION public.fn_reporte_enfermedades(
  p_agrupar_por TEXT DEFAULT 'ninguno',
  p_desde DATE DEFAULT NULL,
  p_hasta DATE DEFAULT NULL,
  p_jornada_ids UUID[] DEFAULT NULL,
  p_comunidad_ids UUID[] DEFAULT NULL,
  p_municipio_id INTEGER DEFAULT NULL,
  p_departamento_id INTEGER DEFAULT NULL,
  p_proyecto_id UUID DEFAULT NULL,
  p_diagnostico_id UUID DEFAULT NULL,
  p_solo_principales BOOLEAN DEFAULT TRUE,
  p_comunidad_de TEXT DEFAULT 'jornada'
)
RETURNS TABLE(
  grupo_id TEXT,
  grupo TEXT,
  grupo_fecha DATE,
  diagnostico_id UUID,
  codigo TEXT,
  diagnostico TEXT,
  orden_diagnostico INTEGER,
  casos INTEGER,
  suprimido BOOLEAN,
  hombres INTEGER,
  mujeres INTEGER,
  menores INTEGER,
  adultos INTEGER,
  adultos_mayores INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  -- Toda cifra entre 1 y v_umbral - 1 sale NULL. Espejo de UMBRAL_DE_CONTEO en
  -- packages/shared/reportes/enfermedades.api.js.
  v_umbral CONSTANT INTEGER := 5;
BEGIN
  IF NOT public.puede_consultar_reportes() THEN
    RAISE EXCEPTION 'Solo administracion, los roles consultivos o quien tiene acceso a Reportes consultan el reporte de enfermedades.'
      USING ERRCODE = '42501';
  END IF;

  IF p_agrupar_por IS NULL OR p_agrupar_por NOT IN ('ninguno', 'jornada', 'comunidad', 'mes') THEN
    RAISE EXCEPTION 'Agrupacion no valida: %. Use ninguno, jornada, comunidad o mes.', p_agrupar_por
      USING ERRCODE = '22023';
  END IF;

  IF p_comunidad_de IS NULL OR p_comunidad_de NOT IN ('jornada', 'paciente') THEN
    RAISE EXCEPTION 'Comunidad no valida: %. Use jornada o paciente.', p_comunidad_de
      USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH casos_base AS (
    -- Una fila por diagnostico registrado en una consulta. La UNIQUE (consulta_id,
    -- diagnostico_id) garantiza que una consulta no cuenta dos veces la misma enfermedad.
    SELECT
      d.id AS d_id,
      d.codigo::TEXT AS d_codigo,
      d.nombre::TEXT AS d_nombre,
      j.id AS j_id,
      j.nombre::TEXT AS j_nombre,
      j.fecha AS j_fecha,
      com.id AS c_id,
      com.nombre::TEXT AS c_nombre,
      p.sexo::TEXT AS sexo,
      -- La edad a la fecha de la jornada, como en fn_reporte_pacientes_atendidos.
      date_part('year', age(j.fecha, p.fecha_nacimiento))::INT AS edad
    FROM public.consulta_diagnostico cd
    JOIN public.consultas co ON co.id = cd.consulta_id
    JOIN public.expedientes e ON e.id = co.expediente_id
    JOIN public.pacientes p ON p.id = e.paciente_id
    JOIN public.jornadas j ON j.id = co.jornada_id
    JOIN public.diagnosticos d ON d.id = cd.diagnostico_id
    -- La comunidad que se eligio: donde se atendio, o de donde viene el paciente (la de la
    -- jornada si el paciente no tiene, igual que vista_reporte_impacto_por_comunidad).
    JOIN public.comunidades com ON com.id = CASE
      WHEN p_comunidad_de = 'paciente' THEN COALESCE(p.comunidad_id, j.comunidad_id)
      ELSE j.comunidad_id
    END
    JOIN public.municipios m ON m.id = com.municipio_id
    WHERE (NOT p_solo_principales OR cd.es_principal)
      AND (p_desde IS NULL OR j.fecha >= p_desde)
      AND (p_hasta IS NULL OR j.fecha <= p_hasta)
      AND (p_jornada_ids IS NULL OR cardinality(p_jornada_ids) = 0 OR j.id = ANY (p_jornada_ids))
      AND (p_comunidad_ids IS NULL OR cardinality(p_comunidad_ids) = 0 OR com.id = ANY (p_comunidad_ids))
      AND (p_municipio_id IS NULL OR m.id = p_municipio_id)
      AND (p_departamento_id IS NULL OR m.departamento_id = p_departamento_id)
      AND (p_proyecto_id IS NULL OR j.proyecto_id = p_proyecto_id)
      AND (p_diagnostico_id IS NULL OR d.id = p_diagnostico_id)
  ),
  agrupados AS (
    SELECT
      CASE p_agrupar_por
        WHEN 'jornada' THEN cb.j_id::TEXT
        WHEN 'comunidad' THEN cb.c_id::TEXT
        WHEN 'mes' THEN to_char(cb.j_fecha, 'YYYY-MM')
        ELSE 'todo'
      END AS g_id,
      CASE p_agrupar_por
        WHEN 'jornada' THEN cb.j_nombre
        WHEN 'comunidad' THEN cb.c_nombre
        WHEN 'mes' THEN to_char(cb.j_fecha, 'YYYY-MM')
        ELSE 'Todo el período'
      END AS g_nombre,
      CASE p_agrupar_por
        WHEN 'jornada' THEN cb.j_fecha
        WHEN 'mes' THEN date_trunc('month', cb.j_fecha)::DATE
        ELSE NULL
      END AS g_fecha,
      cb.d_id,
      cb.d_codigo,
      cb.d_nombre,
      count(*)::INT AS n,
      count(*) FILTER (WHERE cb.sexo = 'Masculino')::INT AS n_hombres,
      count(*) FILTER (WHERE cb.sexo = 'Femenino')::INT AS n_mujeres,
      count(*) FILTER (WHERE cb.edad < 18)::INT AS n_menores,
      count(*) FILTER (WHERE cb.edad BETWEEN 18 AND 59)::INT AS n_adultos,
      count(*) FILTER (WHERE cb.edad >= 60)::INT AS n_mayores
    FROM casos_base cb
    GROUP BY 1, 2, 3, cb.d_id, cb.d_codigo, cb.d_nombre
  ),
  ranking AS (
    -- El puesto de cada enfermedad en todo el recorte, para que las vistas comparativas elijan
    -- las mas frecuentes sin que el cliente tenga que conocer la cifra exacta.
    SELECT
      cb.d_id,
      row_number() OVER (ORDER BY count(*) DESC, cb.d_nombre, cb.d_id)::INT AS puesto
    FROM casos_base cb
    GROUP BY cb.d_id, cb.d_nombre
  ),
  protegidos AS (
    -- Un desglose suma los casos: hombres + mujeres = casos, y lo mismo los tres grupos de edad.
    -- Suprimir una sola celda no basta, porque se deduce restando ("8 casos, 5 mujeres" dice que
    -- hay 3 hombres). Por eso, si alguna celda de un desglose queda por debajo del umbral, se
    -- suprime el desglose entero.
    SELECT
      a.*,
      (a.n_hombres BETWEEN 1 AND v_umbral - 1 OR a.n_mujeres BETWEEN 1 AND v_umbral - 1)
        AS sexo_protegido,
      (a.n_menores BETWEEN 1 AND v_umbral - 1
        OR a.n_adultos BETWEEN 1 AND v_umbral - 1
        OR a.n_mayores BETWEEN 1 AND v_umbral - 1) AS edad_protegida
    FROM agrupados a
  )
  SELECT
    a.g_id,
    a.g_nombre,
    a.g_fecha,
    a.d_id,
    a.d_codigo,
    a.d_nombre,
    r.puesto,
    CASE WHEN a.n < v_umbral THEN NULL ELSE a.n END,
    a.n < v_umbral,
    CASE WHEN a.sexo_protegido THEN NULL ELSE a.n_hombres END,
    CASE WHEN a.sexo_protegido THEN NULL ELSE a.n_mujeres END,
    CASE WHEN a.edad_protegida THEN NULL ELSE a.n_menores END,
    CASE WHEN a.edad_protegida THEN NULL ELSE a.n_adultos END,
    CASE WHEN a.edad_protegida THEN NULL ELSE a.n_mayores END
  FROM protegidos a
  JOIN ranking r ON r.d_id = a.d_id
  -- Dentro de un grupo, las cifras protegidas van al final y entre ellas por nombre: ordenarlas por
  -- su valor real revelaria cual de dos "menos de 5" es mayor.
  ORDER BY a.g_fecha NULLS LAST, a.g_nombre, (a.n < v_umbral),
    CASE WHEN a.n < v_umbral THEN 0 ELSE a.n END DESC, a.d_nombre;
END;
$$;

COMMENT ON FUNCTION public.fn_reporte_enfermedades(TEXT, DATE, DATE, UUID[], UUID[], INTEGER, INTEGER, UUID, UUID, BOOLEAN, TEXT) IS
  'Casos por diagnostico del catalogo, agrupados por nada, jornada, comunidad (de la jornada o del paciente) o mes, con desglose por sexo y edad. Cifras de 1 a 4 salen NULL (suprimido), y con ellas el desglose entero: nada identifica a un paciente (issue #916, 00177).';

REVOKE EXECUTE ON FUNCTION public.fn_reporte_enfermedades(TEXT, DATE, DATE, UUID[], UUID[], INTEGER, INTEGER, UUID, UUID, BOOLEAN, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_reporte_enfermedades(TEXT, DATE, DATE, UUID[], UUID[], INTEGER, INTEGER, UUID, UUID, BOOLEAN, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_reporte_enfermedades(TEXT, DATE, DATE, UUID[], UUID[], INTEGER, INTEGER, UUID, UUID, BOOLEAN, TEXT) TO authenticated;

-- ----------------------------------------------------------------------------
-- 2. Opciones para los selectores del reporte
-- ----------------------------------------------------------------------------
-- Solo nombres de catalogo: ninguna cifra y ningun paciente. Las jornadas y los diagnosticos son
-- los que tienen al menos un diagnostico registrado; elegir uno sin casos solo daria un reporte
-- vacio. Los proyectos son los que tienen alguna jornada.
CREATE FUNCTION public.fn_opciones_reporte_enfermedades()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.puede_consultar_reportes() THEN
    RAISE EXCEPTION 'Solo administracion, los roles consultivos o quien tiene acceso a Reportes consultan el reporte de enfermedades.'
      USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'jornadas', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object('id', x.id, 'nombre', x.nombre, 'fecha', x.fecha, 'comunidad', x.comunidad)
        ORDER BY x.fecha DESC, x.nombre
      )
      FROM (
        SELECT j.id, j.nombre, j.fecha, c.nombre AS comunidad
        FROM public.jornadas j
        JOIN public.comunidades c ON c.id = j.comunidad_id
        WHERE EXISTS (
          SELECT 1
          FROM public.consultas co
          JOIN public.consulta_diagnostico cd ON cd.consulta_id = co.id
          WHERE co.jornada_id = j.id
        )
      ) x
    ), '[]'::jsonb),
    'proyectos', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', pr.id, 'nombre', pr.nombre) ORDER BY pr.nombre)
      FROM public.proyectos pr
      WHERE EXISTS (SELECT 1 FROM public.jornadas j WHERE j.proyecto_id = pr.id)
    ), '[]'::jsonb),
    'diagnosticos', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object('id', d.id, 'codigo', d.codigo, 'nombre', d.nombre)
        ORDER BY d.nombre
      )
      FROM public.diagnosticos d
      WHERE EXISTS (SELECT 1 FROM public.consulta_diagnostico cd WHERE cd.diagnostico_id = d.id)
    ), '[]'::jsonb)
  );
END;
$$;

COMMENT ON FUNCTION public.fn_opciones_reporte_enfermedades() IS
  'Jornadas y diagnosticos con casos, y proyectos con jornadas, para los selectores del reporte de enfermedades. Existe porque los roles consultivos no leen esas tablas por RLS (issue #916, 00177).';

REVOKE EXECUTE ON FUNCTION public.fn_opciones_reporte_enfermedades() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_opciones_reporte_enfermedades() FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_opciones_reporte_enfermedades() TO authenticated;
