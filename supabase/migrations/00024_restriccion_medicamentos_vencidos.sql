-- Ecopac Digital - Restricción que impide despachar medicamentos vencidos

-- ============================================================================
-- 1. Actualizar función fn_actualizar_existencias con chequeo de caducidad
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_actualizar_existencias()
RETURNS TRIGGER AS $$
DECLARE
  v_stock_actual INT;
  v_fecha_vencimiento DATE;
BEGIN
  -- Solo actúa cuando el estado cambia a 'aprobado'
  IF (OLD.estado IS DISTINCT FROM NEW.estado) AND NEW.estado = 'aprobado' THEN
    
    IF NEW.fecha_aprobacion IS NULL THEN
      NEW.fecha_aprobacion := NOW();
    END IF;

    -- Consultar cantidad disponible y fecha de vencimiento en lotes_existencias
    SELECT cantidad, fecha_vencimiento 
    INTO v_stock_actual, v_fecha_vencimiento
    FROM lotes_existencias
    WHERE id = NEW.lote_id
    FOR UPDATE;

    -- Validar si se intenta aprobar una salida de un lote vencido
    IF NEW.tipo = 'salida' THEN
      IF v_fecha_vencimiento IS NOT NULL AND v_fecha_vencimiento < CURRENT_DATE THEN
        RAISE EXCEPTION 'No se puede aprobar la salida de un medicamento vencido. El lote venció el %.', v_fecha_vencimiento;
      END IF;

      IF v_stock_actual < NEW.cantidad THEN
        RAISE EXCEPTION 'Existencia insuficiente para aprobar la salida. Disponible: %, Solicitado: %', v_stock_actual, NEW.cantidad;
      END IF;

      UPDATE lotes_existencias
      SET cantidad = cantidad - NEW.cantidad,
          updated_at = NOW()
      WHERE id = NEW.lote_id;

    ELSIF NEW.tipo = 'ingreso' THEN
      UPDATE lotes_existencias
      SET cantidad = cantidad + NEW.cantidad,
          updated_at = NOW()
      WHERE id = NEW.lote_id;
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 2. Vista de existencias disponibles (Excluye lotes vencidos o sin stock)
-- ============================================================================
CREATE OR REPLACE VIEW vista_lotes_disponibles AS
SELECT 
  le.id AS lote_id,
  le.medicamento_id,
  m.nombre AS medicamento_nombre,
  le.numero_lote,
  le.fecha_vencimiento,
  le.cantidad AS cantidad_disponible,
  le.created_at,
  le.updated_at
FROM lotes_existencias le
JOIN medicamentos m ON m.id = le.medicamento_id
WHERE le.cantidad > 0
  AND (le.fecha_vencimiento IS NULL OR le.fecha_vencimiento >= CURRENT_DATE);

COMMENT ON VIEW vista_lotes_disponibles IS 
  'Muestra los lotes con stock positivo que no han alcanzado su fecha de vencimiento.';