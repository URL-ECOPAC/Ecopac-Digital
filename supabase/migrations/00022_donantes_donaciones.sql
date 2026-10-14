CREATE TYPE tipo_donante AS ENUM ('persona', 'organizacion');

CREATE TYPE tipo_donacion AS ENUM ('medicamentos', 'insumos', 'dinero', 'servicios');

CREATE TYPE estado_donacion AS ENUM ('registrada', 'anulada');

CREATE TABLE donantes (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  nombre VARCHAR(150) UNIQUE NOT NULL,
  tipo tipo_donante NOT NULL,
  contacto VARCHAR(150),
  telefono VARCHAR(20),
  email extensions.citext,
  direccion VARCHAR(200),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_donantes_nombre_trgm ON donantes
USING GIN ((lower(public.f_unaccent(nombre))) extensions.gin_trgm_ops);

ALTER TABLE donantes ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_donantes_updated_at
BEFORE UPDATE ON donantes
FOR EACH ROW
EXECUTE FUNCTION actualizar_timestamp_updated_at();

CREATE TABLE donaciones (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  donante_id UUID NOT NULL REFERENCES donantes(id) ON DELETE RESTRICT,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  tipo tipo_donacion NOT NULL,
  observaciones TEXT,
  estado estado_donacion NOT NULL DEFAULT 'registrada',
  motivo_anulacion TEXT,
  anulada_por UUID REFERENCES perfiles(id) ON DELETE RESTRICT,
  anulada_en TIMESTAMPTZ,
  registrada_por UUID REFERENCES perfiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_donaciones_anulacion_coherente CHECK (
    (estado = 'registrada'
      AND motivo_anulacion IS NULL AND anulada_por IS NULL AND anulada_en IS NULL)
    OR
    (estado = 'anulada'
      AND motivo_anulacion IS NOT NULL AND anulada_por IS NOT NULL AND anulada_en IS NOT NULL)
  )
);

CREATE INDEX idx_donaciones_donante_id ON donaciones (donante_id);
CREATE INDEX idx_donaciones_fecha ON donaciones (fecha);
CREATE INDEX idx_donaciones_estado ON donaciones (estado);

ALTER TABLE donaciones ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_donaciones_updated_at
BEFORE UPDATE ON donaciones
FOR EACH ROW
EXECUTE FUNCTION actualizar_timestamp_updated_at();

CREATE TABLE donacion_detalle (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  donacion_id UUID NOT NULL REFERENCES donaciones(id) ON DELETE CASCADE,
  descripcion VARCHAR(200) NOT NULL,
  cantidad NUMERIC(12,2),
  unidad VARCHAR(50),
  monto NUMERIC(12,2),
  lote_id UUID UNIQUE REFERENCES lotes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_donacion_detalle_cantidad_positiva
    CHECK (cantidad IS NULL OR cantidad > 0),
  CONSTRAINT chk_donacion_detalle_monto_no_negativo
    CHECK (monto IS NULL OR monto >= 0)
);

CREATE INDEX idx_donacion_detalle_donacion_id ON donacion_detalle (donacion_id);

ALTER TABLE donacion_detalle ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_donacion_detalle_updated_at
BEFORE UPDATE ON donacion_detalle
FOR EACH ROW
EXECUTE FUNCTION actualizar_timestamp_updated_at();
