-- Agrega el proyecto a vista_reporte_impacto.
--
-- La issue #205 pide que los indicadores de impacto se puedan agrupar por mes, por comunidad, por
-- jornada y por proyecto. La vista traia los tres primeros pero no el proyecto, asi que la unica
-- agrupacion que faltaba no se podia resolver desde el cliente: PostgREST no sabe embeber
-- relaciones a traves de una vista arbitraria, de modo que no habia forma de llegar a
-- jornadas.proyecto_id sin una segunda consulta.
--
-- Es una correccion hacia adelante: no se edita la 00027 ni la 00054, se vuelve a declarar la
-- vista con CREATE OR REPLACE. El cuerpo es el de la 00054 con dos columnas nuevas al final del
-- SELECT; CREATE OR REPLACE VIEW exige que las columnas existentes conserven nombre, tipo y orden,
-- y solo admite agregar al final, que es lo que se hace aqui.
--
-- Se conservan las dos decisiones de la 00054 y no se tocan:
--   - security_invoker = FALSE, con el WHERE de control de acceso dentro de la vista. Las vistas
--     no soportan RLS, asi que el acceso se gobierna asi (mismo patron que perfiles_directorio en
--     la 00038 y pacientes_reporte en la 00041).
--   - Los roles consultivos ven agregados, nunca filas clinicas (issue #407).
--
-- proyectos entra con LEFT JOIN porque jornadas.proyecto_id es nullable
-- (REFERENCES proyectos(id) ON DELETE SET NULL, 00012): una jornada suelta, sin proyecto, tiene
-- que seguir contando en los indicadores.

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
  COALESCE(e.medicamentos_utilizados, 0) AS medicamentos_utilizados,
  -- Columnas nuevas, al final para no romper CREATE OR REPLACE.
  j.proyecto_id,
  pr.nombre AS proyecto
FROM jornadas j
JOIN comunidades com ON com.id = j.comunidad_id
LEFT JOIN proyectos pr ON pr.id = j.proyecto_id
LEFT JOIN pacientes_por_jornada p ON p.jornada_id = j.id
LEFT JOIN consultas_por_jornada cs ON cs.jornada_id = j.id
LEFT JOIN entregas_por_jornada e ON e.jornada_id = j.id
WHERE public.es_administrador()
   OR public.rol_actual() IN ('junta directiva', 'socio fundador');

COMMENT ON COLUMN vista_reporte_impacto.proyecto_id IS
  'Proyecto al que pertenece la jornada, o NULL si la jornada no cuelga de ninguno. Permite la agrupacion por proyecto que pide la issue #205.';

COMMENT ON COLUMN vista_reporte_impacto.proyecto IS
  'Nombre del proyecto, para etiquetar el grupo sin una segunda consulta.';

-- CREATE OR REPLACE conserva los privilegios de la vista, pero se repiten para que quede
-- explicito y para que una base reconstruida desde cero termine en el mismo estado que la 00054.
GRANT SELECT ON vista_reporte_impacto TO authenticated;
REVOKE ALL ON vista_reporte_impacto FROM anon;
