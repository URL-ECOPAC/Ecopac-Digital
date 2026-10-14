CREATE OR REPLACE FUNCTION fn_existencias_disponibles(
  p_bodega_id UUID DEFAULT NULL,
  p_busqueda TEXT DEFAULT NULL,
  p_limite INT DEFAULT 50,
  p_desplazamiento INT DEFAULT 0
)
RETURNS TABLE(
  medicamento_id UUID,
  medicamento TEXT,
  concentracion TEXT,
  presentacion TEXT,
  marca TEXT,
  componentes TEXT[],
  cantidad_disponible INT,
  fecha_vencimiento_proxima DATE,
  lotes_disponibles INT,
  total_medicamentos BIGINT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH disponibles AS (
    SELECT
      v.medicamento_id,
      v.lote_id,
      v.cantidad_disponible,
      v.fecha_vencimiento
    FROM public.vista_lotes_disponibles v
    WHERE p_bodega_id IS NULL OR v.bodega_id = p_bodega_id
  ),
  agregado AS (
    SELECT
      d.medicamento_id AS med_id,
      SUM(d.cantidad_disponible)::INT AS cantidad,
      MIN(d.fecha_vencimiento) AS vence,
      COUNT(DISTINCT d.lote_id)::INT AS lotes
    FROM disponibles d
    GROUP BY d.medicamento_id
  ),
  con_catalogo AS (
    SELECT
      a.med_id,
      a.cantidad,
      a.vence,
      a.lotes,
      m.nombre::TEXT AS nombre,
      m.concentracion::TEXT AS concentracion,
      m.presentacion::TEXT AS presentacion,
      m.marca::TEXT AS marca,
      ARRAY(
        SELECT pa.nombre::TEXT
        FROM public.medicamento_principio mp
        JOIN public.principios_activos pa ON pa.id = mp.principio_id
        WHERE mp.medicamento_id = a.med_id
        ORDER BY pa.nombre
      ) AS componentes
    FROM agregado a
    JOIN public.medicamentos m ON m.id = a.med_id
  ),
  filtrado AS (
    SELECT c.*
    FROM con_catalogo c
    WHERE p_busqueda IS NULL
       OR btrim(p_busqueda) = ''
       OR lower(public.f_unaccent(c.nombre))
            LIKE '%' || lower(public.f_unaccent(btrim(p_busqueda))) || '%'
       OR lower(public.f_unaccent(c.marca))
            LIKE '%' || lower(public.f_unaccent(btrim(p_busqueda))) || '%'
       OR lower(public.f_unaccent(c.concentracion))
            LIKE '%' || lower(public.f_unaccent(btrim(p_busqueda))) || '%'
       OR EXISTS (
            SELECT 1
            FROM unnest(c.componentes) AS componente
            WHERE lower(public.f_unaccent(componente))
                    LIKE '%' || lower(public.f_unaccent(btrim(p_busqueda))) || '%'
          )
  )
  SELECT
    f.med_id,
    f.nombre,
    f.concentracion,
    f.presentacion,
    f.marca,
    f.componentes,
    f.cantidad,
    f.vence,
    f.lotes,
    COUNT(*) OVER ()::BIGINT
  FROM filtrado f
  ORDER BY f.nombre, f.concentracion, f.marca
  LIMIT p_limite
  OFFSET p_desplazamiento;
$$;

COMMENT ON FUNCTION fn_existencias_disponibles(UUID, TEXT, INT, INT) IS
  'Inventario disponible agregado por medicamento: cantidad total, fecha de vencimiento mas '
  'proxima y numero de lotes con existencia. Se apoya en vista_lotes_disponibles (00047), que '
  'ya excluye lo vencido y lo que tiene cantidad cero, asi que la exclusion de vencidos no se '
  'repite aqui. p_bodega_id nulo suma todas las bodegas; con valor, agrupa despues de filtrar, '
  'que es el motivo por el que esto es una funcion y no una vista de granularidad fija. '
  'p_busqueda compara sin acentos contra nombre, marca, concentracion y los principios activos '
  'del medicamento. total_medicamentos repite en cada fila el total sin paginar, para que quien '
  'consume sepa cuantas paginas hay sin una segunda consulta. SECURITY INVOKER: respeta las '
  'politicas RLS de existencias, lotes, medicamentos y bodegas (00034), igual que la vista. '
  'Issue #145 (RF-18).';

GRANT EXECUTE ON FUNCTION fn_existencias_disponibles(UUID, TEXT, INT, INT) TO authenticated;
