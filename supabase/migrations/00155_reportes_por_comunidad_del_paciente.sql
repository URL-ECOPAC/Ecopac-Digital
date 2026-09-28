-- ============================================================================
-- 00155: los reportes cuentan por la comunidad de donde viene el paciente
-- ============================================================================
--
-- Hasta aqui "por comunidad" era la comunidad donde se hizo la jornada: una jornada en el caserio
-- El Rosario ponia a todos sus pacientes en El Rosario, aunque vinieran de tres aldeas distintas.
-- La organizacion pidio contar por la comunidad del paciente (`pacientes.comunidad_id`) y, solo si
-- el paciente no tiene una asignada, por la de la jornada.
--
-- 1. vista_reporte_impacto_por_comunidad: los mismos indicadores que vista_reporte_impacto, con
--    grano (jornada, comunidad del paciente). La vista de siempre NO cambia: el detalle y el
--    kanban de jornadas leen de ella una fila por jornada, y partirla les duplicaria filas.
-- 2. fn_reporte_pacientes_atendidos: agrupar y filtrar por comunidad usan la del paciente. Misma
--    firma, asi que CREATE OR REPLACE conserva sus privilegios (00148).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Indicadores de impacto por comunidad del paciente
-- ----------------------------------------------------------------------------
-- Misma forma y misma guarda que vista_reporte_impacto (00148): security_invoker = false y el
-- WHERE de puede_consultar_reportes(), para que los roles consultivos lean agregados sin leer
-- filas clinicas (00054). Ninguna columna identifica a un paciente.
--
-- Una jornada sin atenciones sigue apareciendo, con la comunidad de la jornada y todo en cero:
-- agrupar por jornada o por mes la tiene que seguir mostrando.
CREATE VIEW public.vista_reporte_impacto_por_comunidad
WITH (security_invoker = false) AS
WITH atenciones_con_comunidad AS (
  SELECT
    a.id AS atencion_id,
    a.jornada_id,
    a.paciente_id,
    COALESCE(p.comunidad_id, j.comunidad_id) AS comunidad_id
  FROM public.atenciones a
  JOIN public.jornadas j ON j.id = a.jornada_id
  JOIN public.pacientes p ON p.id = a.paciente_id
), pacientes_por_grupo AS (
  SELECT ac.jornada_id, ac.comunidad_id, count(DISTINCT ac.paciente_id) AS pacientes_atendidos
  FROM atenciones_con_comunidad ac
  GROUP BY ac.jornada_id, ac.comunidad_id
), consultas_por_grupo AS (
  SELECT ac.jornada_id, ac.comunidad_id, count(*) AS consultas_realizadas
  FROM public.consultas c
  JOIN atenciones_con_comunidad ac ON ac.atencion_id = c.atencion_id
  GROUP BY ac.jornada_id, ac.comunidad_id
), entregas_por_grupo AS (
  SELECT
    ac.jornada_id,
    ac.comunidad_id,
    count(DISTINCT r.id) AS tratamientos_entregados,
    COALESCE(sum(rd.cantidad_entregada), 0::bigint) AS medicamentos_utilizados
  FROM public.consultas c
  JOIN atenciones_con_comunidad ac ON ac.atencion_id = c.atencion_id
  JOIN public.recetas r ON r.consulta_id = c.id
  LEFT JOIN public.receta_detalle rd ON rd.receta_id = r.id
  GROUP BY ac.jornada_id, ac.comunidad_id
), grupos AS (
  SELECT pg.jornada_id, pg.comunidad_id FROM pacientes_por_grupo pg
  UNION
  -- La jornada sin atenciones, con su propia comunidad.
  SELECT j.id, j.comunidad_id
  FROM public.jornadas j
  WHERE NOT EXISTS (SELECT 1 FROM public.atenciones a WHERE a.jornada_id = j.id)
)
SELECT
  j.id AS jornada_id,
  j.nombre AS jornada,
  j.fecha,
  j.estado AS estado_jornada,
  com.id AS comunidad_id,
  com.nombre AS comunidad,
  COALESCE(p.pacientes_atendidos, 0::bigint) AS pacientes_atendidos,
  COALESCE(cs.consultas_realizadas, 0::bigint) AS consultas_realizadas,
  COALESCE(e.tratamientos_entregados, 0::bigint) AS tratamientos_entregados,
  COALESCE(e.medicamentos_utilizados, 0::bigint) AS medicamentos_utilizados,
  j.proyecto_id,
  pr.nombre AS proyecto
FROM grupos g
JOIN public.jornadas j ON j.id = g.jornada_id
JOIN public.comunidades com ON com.id = g.comunidad_id
LEFT JOIN public.proyectos pr ON pr.id = j.proyecto_id
LEFT JOIN pacientes_por_grupo p ON p.jornada_id = g.jornada_id AND p.comunidad_id = g.comunidad_id
LEFT JOIN consultas_por_grupo cs ON cs.jornada_id = g.jornada_id AND cs.comunidad_id = g.comunidad_id
LEFT JOIN entregas_por_grupo e ON e.jornada_id = g.jornada_id AND e.comunidad_id = g.comunidad_id
WHERE public.puede_consultar_reportes();

COMMENT ON VIEW public.vista_reporte_impacto_por_comunidad IS
  'Indicadores de impacto por jornada y por comunidad de origen del paciente (la de la jornada si el paciente no tiene). Una jornada puede tener varias filas; sumadas dan lo mismo que vista_reporte_impacto (00155).';

GRANT SELECT ON public.vista_reporte_impacto_por_comunidad TO authenticated;
REVOKE ALL ON public.vista_reporte_impacto_por_comunidad FROM anon;

-- ----------------------------------------------------------------------------
-- 2. Reporte de pacientes atendidos
-- ----------------------------------------------------------------------------
-- Cuerpo de la 00148 con un solo cambio: la comunidad de cada atencion es la del paciente, y la
-- de la jornada solo si el paciente no tiene.
CREATE OR REPLACE FUNCTION public.fn_reporte_pacientes_atendidos(
  p_agrupar_por TEXT DEFAULT 'jornada',
  p_jornada_id UUID DEFAULT NULL,
  p_comunidad_id UUID DEFAULT NULL,
  p_desde DATE DEFAULT NULL,
  p_hasta DATE DEFAULT NULL
)
RETURNS TABLE(
  grupo_id TEXT,
  grupo TEXT,
  pacientes INTEGER,
  nuevos INTEGER,
  recurrentes INTEGER,
  hombres INTEGER,
  mujeres INTEGER,
  menores INTEGER,
  adultos INTEGER,
  adultos_mayores INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.puede_consultar_reportes() THEN
    RAISE EXCEPTION 'Solo administracion, los roles consultivos o quien tiene acceso a Reportes consultan el reporte de pacientes atendidos.';
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
    -- 00155: la comunidad del paciente; la de la jornada solo si el paciente no tiene.
    JOIN public.comunidades c ON c.id = COALESCE(p.comunidad_id, j.comunidad_id)
    WHERE (p_jornada_id IS NULL OR j.id = p_jornada_id)
      AND (p_comunidad_id IS NULL OR c.id = p_comunidad_id)
      AND (p_desde IS NULL OR j.fecha >= p_desde)
      AND (p_hasta IS NULL OR j.fecha <= p_hasta)
  ),
  -- Sin cambios desde la 00132: nuevo es "primera jornada en la que se le atendio".
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
