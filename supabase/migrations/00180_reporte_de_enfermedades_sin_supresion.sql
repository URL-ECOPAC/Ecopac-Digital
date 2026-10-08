-- ============================================================================
-- 00180: el reporte de enfermedades muestra el numero real de casos (issue #926)
-- ============================================================================
--
-- La 00177 (issue #916) devolvia NULL en toda cifra de 1 a 4 (`suprimido = true`) y, si una celda
-- del desglose por sexo o por edad quedaba por debajo de 5, anulaba el desglose entero. La pantalla
-- lo mostraba como "< 5" y la grafica no dibujaba esas cifras. La organizacion pidio que el reporte
-- muestre siempre el numero real de casos, en la tabla y en las graficas.
--
-- La 00177 ya esta aplicada y no se edita: esta migracion reemplaza fn_reporte_enfermedades.
--
-- 1. `casos`, `hombres`, `mujeres`, `menores`, `adultos` y `adultos_mayores` salen siempre con su
--    numero.
-- 2. Dentro de cada grupo las enfermedades se ordenan por cantidad de casos, sin mandar ninguna
--    fila al final.
-- 3. LA COLUMNA `suprimido` SE QUITA. Dejarla habria sido una columna que siempre dice false, y un
--    cliente que la leyera seguiria creyendo que hay cifras ocultas. Quitarla cambia el tipo de
--    retorno, y CREATE OR REPLACE no lo permite: se suelta la funcion y se vuelve a crear, con sus
--    REVOKE y GRANT, que el DROP se lleva. Ninguna vista ni funcion de la base depende de ella.
--
-- Lo demas queda igual que en la 00177: SECURITY DEFINER con la guarda puede_consultar_reportes()
-- en el cuerpo, solo conteos agregados (nunca una fila por paciente), los mismos filtros y el mismo
-- puesto de cada enfermedad (`orden_diagnostico`). fn_opciones_reporte_enfermedades no cambia.
-- ============================================================================

DROP FUNCTION public.fn_reporte_enfermedades(TEXT, DATE, DATE, UUID[], UUID[], INTEGER, INTEGER, UUID, UUID, BOOLEAN, TEXT);

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
    -- El puesto de cada enfermedad en todo el recorte: las vistas comparativas eligen con el las
    -- mas frecuentes para el eje de la grafica.
    SELECT
      cb.d_id,
      row_number() OVER (ORDER BY count(*) DESC, cb.d_nombre, cb.d_id)::INT AS puesto
    FROM casos_base cb
    GROUP BY cb.d_id, cb.d_nombre
  )
  SELECT
    a.g_id,
    a.g_nombre,
    a.g_fecha,
    a.d_id,
    a.d_codigo,
    a.d_nombre,
    r.puesto,
    a.n,
    a.n_hombres,
    a.n_mujeres,
    a.n_menores,
    a.n_adultos,
    a.n_mayores
  FROM agrupados a
  JOIN ranking r ON r.d_id = a.d_id
  -- Dentro de un grupo, de la enfermedad con mas casos a la de menos; el nombre desempata.
  ORDER BY a.g_fecha NULLS LAST, a.g_nombre, a.n DESC, a.d_nombre;
END;
$$;

COMMENT ON FUNCTION public.fn_reporte_enfermedades(TEXT, DATE, DATE, UUID[], UUID[], INTEGER, INTEGER, UUID, UUID, BOOLEAN, TEXT) IS
  'Casos por diagnostico del catalogo, agrupados por nada, jornada, comunidad (de la jornada o del paciente) o mes, con desglose por sexo y edad. Solo conteos agregados, siempre con su numero real; ninguna fila por paciente (issue #916, 00177; sin supresion desde la issue #926, 00180).';

REVOKE EXECUTE ON FUNCTION public.fn_reporte_enfermedades(TEXT, DATE, DATE, UUID[], UUID[], INTEGER, INTEGER, UUID, UUID, BOOLEAN, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_reporte_enfermedades(TEXT, DATE, DATE, UUID[], UUID[], INTEGER, INTEGER, UUID, UUID, BOOLEAN, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_reporte_enfermedades(TEXT, DATE, DATE, UUID[], UUID[], INTEGER, INTEGER, UUID, UUID, BOOLEAN, TEXT) TO authenticated;
