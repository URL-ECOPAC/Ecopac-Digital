-- Ecopac Digital - Unificar los dos modelos de inventario en el Modelo A (issue #369)
--
-- El esquema tenia dos modelos de stock paralelos: lotes/existencias (00019/00020), con
-- cantidad por bodega, proveedor y origen, y lotes_existencias (00023), con una sola cantidad
-- global por lote que solo usaban movimientos_inventario y las funciones de ajuste de stock
-- (00023/00024/00028). Se elimina lotes_existencias: lotes/existencias ya tenia la mayoria de
-- las referencias entrantes (existencias, receta_detalle, alertas_caducidad,
-- donacion_detalle) y es el unico que trackea cantidad por bodega, necesario para la clinica
-- movil.
--
-- existencias esta particionada por (lote_id, bodega_id) (UNIQUE, 00020), a diferencia de
-- lotes_existencias que era una fila por lote. Por eso, ademas de mover las referencias:
-- - movimientos_inventario.bodega_id pasa de nullable a NOT NULL: sin bodega no hay fila de
--   existencias que ajustar.
-- - fn_aplicar_ajuste_existencias ahora recibe bodega_id y hace upsert (INSERT ... ON
--   CONFLICT) en el camino de ingreso, porque puede no existir aun fila de existencias para
--   esa combinacion de lote y bodega. En salida, una combinacion sin fila se trata como stock
--   0 (sigue lanzando "Existencia insuficiente", nunca actualiza 0 filas).
-- - vista_lotes_disponibles pasa de una fila por lote a una fila por (lote, bodega).
--
-- No hay datos reales que preservar en lotes_existencias/movimientos_inventario a la fecha de
-- esta migracion (confirmado con el equipo): no se escribe logica de backfill de datos
-- historicos.

-- ============================================================================
-- 1. Redefinir las funciones de ajuste de stock para que operen contra existencias
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_aplicar_ajuste_existencias(
  p_lote_id UUID,
  p_bodega_id UUID,
  p_tipo tipo_movimiento,
  p_cantidad INT
)
RETURNS VOID AS $$
DECLARE
  v_stock_actual INT;
  v_fecha_vencimiento DATE;
BEGIN
  SELECT fecha_vencimiento INTO v_fecha_vencimiento
  FROM lotes
  WHERE id = p_lote_id;

  SELECT cantidad_disponible INTO v_stock_actual
  FROM existencias
  WHERE lote_id = p_lote_id AND bodega_id = p_bodega_id
  FOR UPDATE;

  v_stock_actual := COALESCE(v_stock_actual, 0);

  IF p_tipo = 'salida' THEN
    IF v_fecha_vencimiento IS NOT NULL AND v_fecha_vencimiento < CURRENT_DATE THEN
      RAISE EXCEPTION 'No se puede aprobar la salida de un medicamento vencido. El lote venció el %.', v_fecha_vencimiento;
    END IF;

    IF v_stock_actual < p_cantidad THEN
      RAISE EXCEPTION 'Existencia insuficiente para aprobar la salida. Disponible: %, Solicitado: %', v_stock_actual, p_cantidad;
    END IF;

    UPDATE existencias
    SET cantidad_disponible = cantidad_disponible - p_cantidad,
        updated_at = NOW()
    WHERE lote_id = p_lote_id AND bodega_id = p_bodega_id;

  ELSIF p_tipo = 'ingreso' THEN
    INSERT INTO existencias (lote_id, bodega_id, cantidad_disponible)
    VALUES (p_lote_id, p_bodega_id, p_cantidad)
    ON CONFLICT (lote_id, bodega_id) DO UPDATE
    SET cantidad_disponible = existencias.cantidad_disponible + EXCLUDED.cantidad_disponible,
        updated_at = NOW();
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION fn_aplicar_ajuste_existencias(UUID, UUID, tipo_movimiento, INT) IS
  'Ajusta existencias.cantidad_disponible para la fila (lote_id, bodega_id). En salida exige '
  'stock suficiente y lote vigente (fecha_vencimiento contra lotes); en ingreso hace upsert '
  'porque puede no existir aun fila de existencias para esa combinacion. Issue #369: '
  'reemplaza el ajuste sobre lotes_existencias (00028).';

CREATE OR REPLACE FUNCTION fn_actualizar_existencias()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo actúa cuando el estado cambia a 'aprobado'
  IF (OLD.estado IS DISTINCT FROM NEW.estado) AND NEW.estado = 'aprobado' THEN

    IF NEW.fecha_aprobacion IS NULL THEN
      NEW.fecha_aprobacion := NOW();
    END IF;

    PERFORM fn_aplicar_ajuste_existencias(NEW.lote_id, NEW.bodega_id, NEW.tipo, NEW.cantidad);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_autoaprobar_movimiento_inventario()
RETURNS TRIGGER AS $$
BEGIN
  IF es_administrador() THEN
    NEW.estado := 'aprobado';
    NEW.aprobado_por := auth.uid();
    NEW.fecha_aprobacion := NOW();
    NEW.aprobacion_automatica := TRUE;

    PERFORM fn_aplicar_ajuste_existencias(NEW.lote_id, NEW.bodega_id, NEW.tipo, NEW.cantidad);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION fn_autoaprobar_movimiento_inventario() IS
  'Si quien inserta es administrador (es_administrador(), leido del rol en perfiles via '
  'auth.uid(), nunca de un campo del cliente), hace nacer el movimiento en estado aprobado, '
  'con aprobado_por, fecha_aprobacion y aprobacion_automatica fijados automaticamente, y '
  'aplica el ajuste de existencias correspondiente sobre existencias (issue #369, antes '
  'lotes_existencias). Cualquier otro rol conserva el DEFAULT ''pendiente'' de la columna '
  'estado (00023), sin cambios.';

-- ============================================================================
-- 2. Reconstruir vista_lotes_disponibles: una fila por (lote, bodega)
-- ============================================================================

CREATE OR REPLACE VIEW vista_lotes_disponibles AS
SELECT
  l.id AS lote_id,
  l.medicamento_id,
  m.nombre AS medicamento_nombre,
  l.numero_lote,
  l.fecha_vencimiento,
  e.cantidad_disponible,
  e.created_at,
  e.updated_at,
  -- bodega_id/bodega_nombre van al final: CREATE OR REPLACE VIEW exige mantener el
  -- nombre y la posicion de las columnas que la vista ya tenia (00024/00041) y solo
  -- permite agregar columnas nuevas al final.
  e.bodega_id,
  b.nombre AS bodega_nombre
FROM existencias e
JOIN lotes l ON l.id = e.lote_id
JOIN medicamentos m ON m.id = l.medicamento_id
JOIN bodegas b ON b.id = e.bodega_id
WHERE e.cantidad_disponible > 0
  AND l.fecha_vencimiento >= CURRENT_DATE;

ALTER VIEW vista_lotes_disponibles SET (security_invoker = TRUE);

COMMENT ON VIEW vista_lotes_disponibles IS
  'Muestra las combinaciones (lote, bodega) con stock positivo cuyo lote no ha alcanzado su '
  'fecha de vencimiento. security_invoker = TRUE hace que respete las politicas RLS de '
  'existencias, lotes, medicamentos y bodegas (00034). Issue #369: reconstruida sobre '
  'lotes/existencias (antes lotes_existencias); una fila por bodega en vez de una fila por '
  'lote, porque existencias trackea cantidad por bodega.';

-- ============================================================================
-- 3. Migrar movimientos_inventario.lote_id de lotes_existencias a lotes
-- ============================================================================

ALTER TABLE movimientos_inventario
  ALTER COLUMN bodega_id SET NOT NULL;

ALTER TABLE movimientos_inventario
  DROP CONSTRAINT movimientos_inventario_lote_id_fkey;

ALTER TABLE movimientos_inventario
  ADD CONSTRAINT movimientos_inventario_lote_id_fkey
    FOREIGN KEY (lote_id) REFERENCES lotes(id) ON DELETE RESTRICT;

-- ============================================================================
-- 4. Eliminar lotes_existencias (Modelo B): sin dependientes tras los pasos 1-3
-- ============================================================================
-- Se lleva consigo sus policies (00034) e indices sin necesitar tocarlos explicitamente.

DROP TABLE lotes_existencias;
