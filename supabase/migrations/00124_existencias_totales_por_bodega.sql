-- Total de existencias por bodega, agregado en la base (issue #773).
--
-- bodegas.api.js calculaba existenciasTotales sumando en JavaScript el arreglo `existencias`
-- embebido en cada fila de bodegas (`bodegas <- existencias`, seleccionado como
-- `existencias(cantidad_disponible)`). Se asumia que max_rows (supabase/config.toml) solo
-- limitaba el numero de bodegas devueltas -el nivel superior de la consulta- y no el tamano de
-- un arreglo embebido dentro de una fila. Se comprobo lo contrario contra el stack local: una
-- bodega con 1100 combinaciones de lote (existencias) devolvio el arreglo embebido cortado en
-- exactamente 1000. El total sumado en el cliente habria dicho 1000 unidades de menos sin ningun
-- error.
--
-- La solucion no es paginar el embebido (PostgREST no pagina un recurso anidado con `.range()`):
-- es dejar de traer el detalle solo para sumarlo. Esta funcion agrega en la base, mismo criterio
-- que presupuesto_de_proyecto() (00040): el cliente nunca recibe las filas de existencias, solo
-- el total ya sumado.

CREATE OR REPLACE FUNCTION existencias_totales_por_bodega(p_bodega_ids UUID[] DEFAULT NULL)
RETURNS TABLE (
  bodega_id UUID,
  total_disponible BIGINT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT
    e.bodega_id,
    SUM(e.cantidad_disponible)
  FROM public.existencias e
  WHERE p_bodega_ids IS NULL OR e.bodega_id = ANY(p_bodega_ids)
  GROUP BY e.bodega_id;
$$;

COMMENT ON FUNCTION existencias_totales_por_bodega(UUID[]) IS
  'Suma cantidad_disponible por bodega (issue #773). Una bodega sin existencias, o cuyas existencias RLS no deja ver, no genera fila -- quien llama trata "bodega ausente en el resultado" como total cero. SECURITY INVOKER: respeta la politica de SELECT de existencias (00034), abierta a cualquier sesion autenticada.';

GRANT EXECUTE ON FUNCTION existencias_totales_por_bodega(UUID[]) TO authenticated;

-- Toda funcion nueva nace con EXECUTE abierto a PUBLIC (y, en el proyecto real, tambien a anon de
-- forma explicita) hasta que se cierra a mano -- issue #706, migracion 00120.
REVOKE EXECUTE ON FUNCTION existencias_totales_por_bodega(UUID[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION existencias_totales_por_bodega(UUID[]) FROM anon;
