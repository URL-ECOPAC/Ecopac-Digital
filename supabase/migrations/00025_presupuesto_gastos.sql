-- Ecopac Digital - Tabla de gastos por jornada

-- ============================================================================
-- 1. Enum para categorías de gasto
-- ============================================================================
DROP TYPE IF EXISTS categoria_gasto CASCADE;

CREATE TYPE categoria_gasto AS ENUM (
  'Medicamentos',
  'Logistica',
  'Diagnostico',
  'Honorarios',
  'Educacion',
  'Infraestructura'
);

-- ============================================================================
-- 2. Tabla gastos
-- ============================================================================
CREATE TABLE IF NOT EXISTS gastos (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  jornada_id UUID NOT NULL REFERENCES jornadas(id) ON DELETE RESTRICT,
  concepto TEXT NOT NULL,
  categoria categoria_gasto NOT NULL,
  monto NUMERIC(12, 2) NOT NULL CHECK (monto > 0),
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  encargado_id UUID REFERENCES perfiles(id) ON DELETE SET NULL,
  
  -- Reutiliza el enum de aprobación existente
  estado estado_movimiento NOT NULL DEFAULT 'pendiente',
  
  -- Auditoría de creación y aprobación
  registrado_por UUID NOT NULL REFERENCES perfiles(id) ON DELETE RESTRICT,
  aprobado_por UUID REFERENCES perfiles(id) ON DELETE RESTRICT,
  fecha_aprobacion TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 3. Índices para filtros
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_gastos_jornada_id ON gastos (jornada_id);
CREATE INDEX IF NOT EXISTS idx_gastos_estado ON gastos (estado);

ALTER TABLE gastos ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. Trigger para updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_gastos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_gastos_updated_at
BEFORE UPDATE ON gastos
FOR EACH ROW
EXECUTE FUNCTION fn_gastos_updated_at();