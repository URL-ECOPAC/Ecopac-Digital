-- Ecopac Digital - Movimientos de inventario con flujo de aprobación

-- ============================================================================
-- 1. Garantizar estructuras previas
-- ============================================================================

-- Garantizar tabla lotes_existencias (por si difiere de la migración previa)
CREATE TABLE IF NOT EXISTS lotes_existencias (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  medicamento_id UUID NOT NULL REFERENCES medicamentos(id) ON DELETE CASCADE,
  numero_lote VARCHAR(50) NOT NULL,
  fecha_vencimiento DATE,
  cantidad INT NOT NULL DEFAULT 0 CHECK (cantidad >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. Tipos ENUM
-- ============================================================================
DROP TYPE IF EXISTS estado_movimiento CASCADE;
DROP TYPE IF EXISTS tipo_movimiento CASCADE;

CREATE TYPE tipo_movimiento AS ENUM ('ingreso', 'salida');
CREATE TYPE estado_movimiento AS ENUM ('pendiente', 'aprobado', 'rechazado');

-- ============================================================================
-- 3. Tabla movimientos_inventario
-- ============================================================================
CREATE TABLE IF NOT EXISTS movimientos_inventario (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  tipo tipo_movimiento NOT NULL,
  lote_id UUID NOT NULL REFERENCES lotes_existencias(id) ON DELETE RESTRICT,
  bodega_id UUID REFERENCES bodegas(id) ON DELETE RESTRICT,
  cantidad INT NOT NULL CHECK (cantidad > 0),
  motivo TEXT NOT NULL,
  
  estado estado_movimiento NOT NULL DEFAULT 'pendiente',
  
  registrado_por UUID NOT NULL REFERENCES perfiles(id) ON DELETE RESTRICT,
  aprobado_por UUID REFERENCES perfiles(id) ON DELETE RESTRICT,
  fecha_aprobacion TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_movimientos_lote_id ON movimientos_inventario (lote_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_bodega_id ON movimientos_inventario (bodega_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_estado ON movimientos_inventario (estado);

ALTER TABLE movimientos_inventario ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. Trigger para bloquear edición/eliminación de movimientos finalizados
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_bloquear_movimiento_finalizado()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.estado IN ('aprobado', 'rechazado') THEN
    RAISE EXCEPTION 'No se puede modificar ni eliminar un movimiento de inventario en estado %', OLD.estado;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_bloquear_movimiento_finalizado
BEFORE UPDATE OR DELETE ON movimientos_inventario
FOR EACH ROW
EXECUTE FUNCTION fn_bloquear_movimiento_finalizado();

-- ============================================================================
-- 5. Trigger tr_actualizar_existencias
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_actualizar_existencias()
RETURNS TRIGGER AS $$
DECLARE
  v_stock_actual INT;
BEGIN
  -- Solo actúa cuando el estado cambia a 'aprobado'
  IF (OLD.estado IS DISTINCT FROM NEW.estado) AND NEW.estado = 'aprobado' THEN
    
    IF NEW.fecha_aprobacion IS NULL THEN
      NEW.fecha_aprobacion := NOW();
    END IF;

    -- Consultar cantidad disponible en lotes_existencias
    SELECT cantidad INTO v_stock_actual
    FROM lotes_existencias
    WHERE id = NEW.lote_id
    FOR UPDATE;

    IF NEW.tipo = 'ingreso' THEN
      UPDATE lotes_existencias
      SET cantidad = cantidad + NEW.cantidad,
          updated_at = NOW()
      WHERE id = NEW.lote_id;
      
    ELSIF NEW.tipo = 'salida' THEN
      IF v_stock_actual < NEW.cantidad THEN
        RAISE EXCEPTION 'Existencia insuficiente para aprobar la salida. Disponible: %, Solicitado: %', v_stock_actual, NEW.cantidad;
      END IF;

      UPDATE lotes_existencias
      SET cantidad = cantidad - NEW.cantidad,
          updated_at = NOW()
      WHERE id = NEW.lote_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_actualizar_existencias
BEFORE UPDATE ON movimientos_inventario
FOR EACH ROW
EXECUTE FUNCTION fn_actualizar_existencias();