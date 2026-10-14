DROP POLICY "Junta directiva lee atenciones para reportes" ON atenciones;
DROP POLICY "Junta directiva lee consultas para reportes" ON consultas;
DROP POLICY "Junta directiva lee recetas para reportes" ON recetas;
DROP POLICY "Junta directiva lee receta_detalle para reportes" ON receta_detalle;

CREATE OR REPLACE VIEW vista_reporte_impacto
WITH (security_invoker = FALSE)
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
LEFT JOIN entregas_por_jornada e ON e.jornada_id = j.id
WHERE public.es_administrador()
   OR public.rol_actual() IN ('junta directiva', 'socio fundador');

COMMENT ON VIEW vista_reporte_impacto IS
  'Indicadores de impacto por jornada, agrupables por jornada, comunidad y rango de fechas.
   DECISION (issue #407): los roles consultivos ven agregados, nunca filas clinicas. Las
   politicas de lectura que la 00041 abrio sobre atenciones, consultas, recetas y
   receta_detalle se eliminaron aqui: RLS filtra filas, no columnas, y una politica FOR SELECT
   entrega la fila entera, incluido el texto clinico libre de consultas.
   La vista no lleva security_invoker: el dueno lee las tablas base y el WHERE de aqui abajo
   restringe quien obtiene filas, el mismo patron de perfiles_directorio (00038) y
   pacientes_reporte (00041). Las vistas no soportan RLS, asi que el acceso se gobierna con
   GRANT.
   La proxima issue de reportes NO debe volver a abrir las tablas base: si un reporte necesita
   mas datos, se amplia esta vista o se crea otra con el mismo patron.';

COMMENT ON COLUMN vista_reporte_impacto.pacientes_atendidos IS
  'Pacientes distintos con atencion registrada en la jornada.';

COMMENT ON COLUMN vista_reporte_impacto.consultas_realizadas IS
  'Consultas medicas registradas en la jornada.';

COMMENT ON COLUMN vista_reporte_impacto.tratamientos_entregados IS
  'Recetas emitidas en la jornada. Una receta sin renglones cuenta igual.';

COMMENT ON COLUMN vista_reporte_impacto.medicamentos_utilizados IS
  'Unidades entregadas, sumadas desde receta_detalle.cantidad_entregada.';

COMMENT ON COLUMN vista_reporte_impacto.comunidad_id IS
  'Comunidad de la jornada. El indicador de comunidades beneficiadas se obtiene contando los distintos valores de esta columna.';

GRANT SELECT ON vista_reporte_impacto TO authenticated;
REVOKE ALL ON vista_reporte_impacto FROM anon;
