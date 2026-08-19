-- Ecopac Digital - Tablas de recetas médicas y detalle de prescripción
--
-- recetas vincula la consulta médica con el médico emisor y genera un folio único por receta.
-- receta_detalle registra cada medicamento prescrito (dosis, frecuencia, duración y cantidad)
-- y permite vincular de forma opcional el lote específico de inventario del que se despachó.

-- ============================================================================
-- Tabla auxiliar de lotes (por si no existe previamente)
-- ============================================================================
CREATE TABLE IF NOT EXISTS lotes (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  medicamento_id UUID NOT NULL REFERENCES medicamentos(id) ON DELETE CASCADE,
  numero_lote VARCHAR(50) NOT NULL,
  fecha_vencimiento DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Tabla recetas
-- ============================================================================
CREATE TABLE IF NOT EXISTS recetas (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  consulta_id UUID NOT NULL REFERENCES consultas(id) ON DELETE CASCADE,
  medico_id UUID NOT NULL REFERENCES perfiles(id) ON DELETE RESTRICT,
  folio VARCHAR(50) UNIQUE NOT NULL DEFAULT ('REC-' || UPPER(SUBSTRING(extensions.gen_random_uuid()::text FROM 1 FOR 8))),
  indicaciones_generales TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recetas_consulta_id ON recetas (consulta_id);
CREATE INDEX IF NOT EXISTS idx_recetas_medico_id ON recetas (medico_id);

ALTER TABLE recetas ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_recetas_updated_at
BEFORE UPDATE ON recetas
FOR EACH ROW
EXECUTE FUNCTION actualizar_timestamp_updated_at();

COMMENT ON TRIGGER trg_recetas_updated_at ON recetas IS
  'Actualiza automaticamente updated_at antes de cada UPDATE de una fila de recetas.';

-- ============================================================================
-- Tabla receta_detalle
-- ============================================================================
CREATE TABLE IF NOT EXISTS receta_detalle (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  receta_id UUID NOT NULL REFERENCES recetas(id) ON DELETE CASCADE,
  medicamento_id UUID NOT NULL REFERENCES medicamentos(id) ON DELETE RESTRICT,
  lote_id UUID REFERENCES lotes(id) ON DELETE SET NULL,
  
  dosis VARCHAR(100) NOT NULL,
  frecuencia VARCHAR(100) NOT NULL,
  duracion VARCHAR(100) NOT NULL,
  cantidad_entregada INT NOT NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Validación: la cantidad entregada debe ser mayor que cero
  CONSTRAINT chk_receta_detalle_cantidad_positiva CHECK (cantidad_entregada > 0)
);

CREATE INDEX IF NOT EXISTS idx_receta_detalle_receta_id ON receta_detalle (receta_id);
CREATE INDEX IF NOT EXISTS idx_receta_detalle_medicamento_id ON receta_detalle (medicamento_id);
CREATE INDEX IF NOT EXISTS idx_receta_detalle_lote_id ON receta_detalle (lote_id);

ALTER TABLE receta_detalle ENABLE ROW LEVEL SECURITY;