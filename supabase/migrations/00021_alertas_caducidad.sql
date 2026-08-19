CREATE TYPE estado_alerta AS ENUM ('pendiente', 'atendida');

CREATE TYPE accion_alerta AS ENUM ('donado', 'reubicado', 'descartado');

CREATE TABLE alertas_caducidad (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  lote_id UUID NOT NULL REFERENCES lotes(id) ON DELETE CASCADE,
  estado estado_alerta NOT NULL DEFAULT 'pendiente',
  cantidad_afectada INT NOT NULL,
  accion accion_alerta,
  atendida_por UUID REFERENCES perfiles(id) ON DELETE RESTRICT,
  atendida_en TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_alertas_caducidad_cantidad_positiva
    CHECK (cantidad_afectada > 0),
  CONSTRAINT chk_alertas_caducidad_cierre_coherente CHECK (
    (estado = 'pendiente'
      AND accion IS NULL AND atendida_por IS NULL AND atendida_en IS NULL)
    OR
    (estado = 'atendida'
      AND accion IS NOT NULL AND atendida_por IS NOT NULL AND atendida_en IS NOT NULL)
  )
);

CREATE UNIQUE INDEX uq_alertas_caducidad_lote_pendiente
  ON alertas_caducidad (lote_id) WHERE estado = 'pendiente';

CREATE INDEX idx_alertas_caducidad_estado ON alertas_caducidad (estado);
CREATE INDEX idx_alertas_caducidad_lote_id ON alertas_caducidad (lote_id);

ALTER TABLE alertas_caducidad ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_alertas_caducidad_updated_at
BEFORE UPDATE ON alertas_caducidad
FOR EACH ROW
EXECUTE FUNCTION actualizar_timestamp_updated_at();
