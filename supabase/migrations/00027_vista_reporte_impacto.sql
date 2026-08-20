CREATE INDEX idx_jornadas_fecha ON jornadas (fecha);

CREATE VIEW vista_reporte_impacto
WITH (security_invoker = TRUE)
AS
WITH pacientes_por_jornada AS (
  SELECT
    a.jornada_id,
    COUNT(DISTINCT a.paciente_id) AS pacientes_atendidos
  FROM atenciones a
  GROUP BY a.jornada_id
),
consultas_por_jornada AS (
  SELECT
    c.jornada_id,
    COUNT(*) AS consultas_realizadas
  FROM consultas c
  GROUP BY c.jornada_id
),
entregas_por_jornada AS (
  SELECT
    c.jornada_id,
    COUNT(DISTINCT r.id) AS tratamientos_entregados,
    COALESCE(SUM(rd.cantidad_entregada), 0) AS medicamentos_utilizados
  FROM consultas c
  JOIN recetas r ON r.consulta_id = c.id
  LEFT JOIN receta_detalle rd ON rd.receta_id = r.id
  GROUP BY c.jornada_id
)
SELECT
  j.id AS jornada_id,
  j.nombre AS jornada,
  j.fecha,
  j.estado AS estado_jornada,
  com.id AS comunidad_id,
  com.nombre AS comunidad,
  COALESCE(p.pacientes_atendidos, 0) AS pacientes_atendidos,
  COALESCE(cs.consultas_realizadas, 0) AS consultas_realizadas,
  COALESCE(e.tratamientos_entregados, 0) AS tratamientos_entregados,
  COALESCE(e.medicamentos_utilizados, 0) AS medicamentos_utilizados
FROM jornadas j
JOIN comunidades com ON com.id = j.comunidad_id
LEFT JOIN pacientes_por_jornada p ON p.jornada_id = j.id
LEFT JOIN consultas_por_jornada cs ON cs.jornada_id = j.id
LEFT JOIN entregas_por_jornada e ON e.jornada_id = j.id;

COMMENT ON VIEW vista_reporte_impacto IS
  'Indicadores de impacto con grano de una fila por jornada, agrupables por jornada, comunidad y rango de fechas. security_invoker hace que respete las politicas RLS de las tablas de origen en lugar de leerlas con los permisos del dueno de la vista. No expone datos identificables: los pacientes solo aparecen contados. Los cinco indicadores se obtienen como SUM(pacientes_atendidos), COUNT(DISTINCT comunidad_id), SUM(consultas_realizadas), SUM(tratamientos_entregados) y SUM(medicamentos_utilizados) sobre las filas que el reporte filtre.';

COMMENT ON COLUMN vista_reporte_impacto.pacientes_atendidos IS
  'Pacientes distintos con atencion registrada en la jornada.';

COMMENT ON COLUMN vista_reporte_impacto.consultas_realizadas IS
  'Consultas medicas registradas en la jornada.';

COMMENT ON COLUMN vista_reporte_impacto.tratamientos_entregados IS
  'Recetas emitidas en la jornada. Una receta sin renglones cuenta igual.';

COMMENT ON COLUMN vista_reporte_impacto.medicamentos_utilizados IS
  'Unidades entregadas, sumadas desde receta_detalle.cantidad_entregada.';

COMMENT ON COLUMN vista_reporte_impacto.comunidad_id IS
  'Comunidad de la jornada. El indicador de comunidades beneficiadas se obtiene contando los distintos valores de esta columna, no como columna propia: a nivel de una jornada siempre valdria uno.';
