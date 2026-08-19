CREATE TYPE origen_lote AS ENUM ('compra', 'donacion');

ALTER TABLE lotes
  ADD COLUMN proveedor_id UUID NOT NULL REFERENCES proveedores(id) ON DELETE RESTRICT,
  ADD COLUMN origen origen_lote NOT NULL,
  ADD COLUMN cantidad_ingresada INT NOT NULL,
  ADD COLUMN fecha_ingreso DATE NOT NULL DEFAULT CURRENT_DATE;

ALTER TABLE lotes
  ALTER COLUMN fecha_vencimiento SET NOT NULL;

ALTER TABLE lotes
  ADD CONSTRAINT chk_lotes_vencimiento_posterior
    CHECK (fecha_vencimiento > fecha_ingreso),
  ADD CONSTRAINT chk_lotes_cantidad_positiva
    CHECK (cantidad_ingresada > 0),
  ADD CONSTRAINT uq_lotes_medicamento_proveedor_numero
    UNIQUE (medicamento_id, proveedor_id, numero_lote);

ALTER TABLE lotes ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_lotes_updated_at
BEFORE UPDATE ON lotes
FOR EACH ROW
EXECUTE FUNCTION actualizar_timestamp_updated_at();

CREATE INDEX idx_lotes_fecha_vencimiento ON lotes (fecha_vencimiento);
CREATE INDEX idx_lotes_proveedor_id ON lotes (proveedor_id);

CREATE TABLE existencias (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  lote_id UUID NOT NULL REFERENCES lotes(id) ON DELETE CASCADE,
  bodega_id UUID NOT NULL REFERENCES bodegas(id) ON DELETE RESTRICT,
  cantidad_disponible INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_existencias_lote_bodega UNIQUE (lote_id, bodega_id),
  CONSTRAINT chk_existencias_cantidad_no_negativa CHECK (cantidad_disponible >= 0)
);

ALTER TABLE existencias ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_existencias_updated_at
BEFORE UPDATE ON existencias
FOR EACH ROW
EXECUTE FUNCTION actualizar_timestamp_updated_at();

CREATE INDEX idx_existencias_bodega_id ON existencias (bodega_id);
