-- Ecopac Digital - fn_valor_de_inventario_disponible(), valorizacion de stock (issue #752)
--
-- Cruza existencias.cantidad_disponible (issue #690: lo que hay AHORA, no lotes.cantidad_ingresada,
-- que es lo que entro historicamente) con lotes.costo_unitario, con una fila por
-- (bodega, medicamento, origen). Es la misma agregacion en la base, no en el cliente, que ya usa
-- fn_existencias_disponibles (00065): la issue #759 midio que solo tres funciones de
-- packages/shared paginan, y el resto pide .select() sin .range() y agrega en el cliente, que
-- deja de funcionar por encima de max_rows = 1000 sin ningun error. Una tabla de valorizacion
-- crece con cada lote y cada bodega: agregar aqui, no alla, evita sumarse a ese problema desde
-- el primer dia.
--
-- POR QUE UNA FILA POR (bodega, medicamento, origen) Y NO UN SOLO TOTAL
--
-- El requerimiento pide el total, pero tambien "desglose por origen" (compra vs donacion, para
-- presentar a cooperantes) y el reporte de inventario ya agrupa por bodega y por medicamento. Una
-- fila granular deja que quien consuma la funcion arme cualquiera de esas vistas agregando en el
-- cliente sobre pocas filas -- el mismo patron que reportes/api.js ya usa con
-- vista_reporte_impacto: una consulta, varias agrupaciones.
--
-- POR QUE unidades_sin_costo Y lotes_sin_costo, NO UN VALOR EN CERO
--
-- costo_unitario es NULL en un lote donado o en uno de compra sin precio capturado (00121). Sumar
-- eso como cero mentiria: un inventario con la mitad de sus unidades sin costo conocido no vale
-- "la mitad de lo que deberia", vale "no se sabe cuanto vale la mitad". El requerimiento lo dice
-- explicito: "el reporte tiene que decir cuanto del inventario no esta valorizado". Por eso
-- valor_disponible solo suma lo que si tiene costo, y unidades_sin_costo/lotes_sin_costo cuentan
-- aparte lo que no.
--
-- QUIEN LA PUEDE LLAMAR
--
-- costo_unitario es informacion financiera. La 00121 ya deja escrito por que no se puede
-- restringir la columna de lotes sin reescribir el GRANT de toda la tabla (limitacion real de
-- Postgres/PostgREST, no una eleccion). Esta funcion es SECURITY DEFINER, y es el unico canal
-- pensado para el valor monetario: comprueba el rol ella misma, con la misma regla que ya
-- protege el resto de reportes financieros (presupuesto_de_jornada/proyecto/sistema, 00080,
-- y obtenerIndicadoresImpacto, api.js de reportes) -- administrador y los roles consultivos
-- (junta directiva, socio fundador). Ni medico ni voluntario general la pueden ejecutar.
CREATE OR REPLACE FUNCTION fn_valor_de_inventario_disponible(
  p_bodega_id UUID DEFAULT NULL
)
RETURNS TABLE(
  bodega_id UUID,
  bodega TEXT,
  medicamento_id UUID,
  medicamento TEXT,
  origen origen_lote,
  cantidad_disponible BIGINT,
  valor_disponible NUMERIC,
  unidades_sin_costo BIGINT,
  lotes_sin_costo BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT (public.es_administrador() OR public.es_consultivo()) THEN
    RAISE EXCEPTION 'Solo administracion y los roles consultivos consultan la valorizacion de inventario.'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    e.bodega_id,
    b.nombre::TEXT AS bodega,
    l.medicamento_id,
    m.nombre::TEXT AS medicamento,
    l.origen,
    SUM(e.cantidad_disponible)::BIGINT AS cantidad_disponible,
    SUM(e.cantidad_disponible * l.costo_unitario) FILTER (WHERE l.costo_unitario IS NOT NULL) AS valor_disponible,
    COALESCE(SUM(e.cantidad_disponible) FILTER (WHERE l.costo_unitario IS NULL), 0)::BIGINT AS unidades_sin_costo,
    COUNT(DISTINCT l.id) FILTER (WHERE l.costo_unitario IS NULL)::BIGINT AS lotes_sin_costo
  FROM public.existencias e
  JOIN public.lotes l ON l.id = e.lote_id
  JOIN public.medicamentos m ON m.id = l.medicamento_id
  JOIN public.bodegas b ON b.id = e.bodega_id
  WHERE e.cantidad_disponible > 0
    AND (p_bodega_id IS NULL OR e.bodega_id = p_bodega_id)
  GROUP BY e.bodega_id, b.nombre, l.medicamento_id, m.nombre, l.origen
  ORDER BY b.nombre, m.nombre, l.origen;
END;
$$;

COMMENT ON FUNCTION fn_valor_de_inventario_disponible(UUID) IS
  'Valor monetario del inventario disponible (existencias.cantidad_disponible, no '
  'lotes.cantidad_ingresada), agregado por bodega, medicamento y origen. p_bodega_id nulo suma '
  'todas las bodegas. valor_disponible solo suma lotes con costo_unitario conocido; '
  'unidades_sin_costo y lotes_sin_costo cuentan aparte lo que no tiene costo capturado, para que '
  'el reporte declare cuanto del inventario queda sin valorizar en vez de contarlo como cero. '
  'SECURITY DEFINER: solo administrador y los roles consultivos (junta directiva, socio '
  'fundador) reciben resultado, por la misma razon que protege presupuesto_de_jornada/proyecto/'
  'sistema (00080) y obtenerIndicadoresImpacto (reportes/api.js) -- costo_unitario es '
  'informacion financiera que la 00121 no pudo restringir a nivel de columna. Issue #752.';

GRANT EXECUTE ON FUNCTION fn_valor_de_inventario_disponible(UUID) TO authenticated;

-- Una funcion nueva nace con EXECUTE abierto a PUBLIC/anon por el default de Postgres -la 00120
-- (issue #706) blindo esto para el bootstrap de un proyecto real, pero la propia 00120 deja
-- escrito que ese blindaje no reproduce en el stack local (CLI que fija el CI); confirmado de
-- nuevo aqui: sin este REVOKE explicito, la prueba 8 de privilegios_anon.sql -que barre TODA
-- funcion invocable de public, no solo una lista- encuentra esta funcion abierta a anon. El
-- chequeo de rol interno (es_administrador() OR es_consultivo()) ya protege el dato aunque este
-- GRANT se hubiera olvidado -anon no tiene sesion, rol_actual() es NULL, y ninguna de las dos
-- funciones acepta NULL-, pero la guarda de PostgreSQL/Postgres es la que hace cumplir que
-- ninguna funcion de este esquema se salga de ese patron sin que alguien lo note.
REVOKE EXECUTE ON FUNCTION fn_valor_de_inventario_disponible(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fn_valor_de_inventario_disponible(UUID) FROM anon;
