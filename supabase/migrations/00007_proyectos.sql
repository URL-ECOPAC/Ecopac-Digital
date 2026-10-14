-- Ecopac Digital - Tabla de proyectos sociales
--
-- Un proyecto agrupa varias jornadas. Su presupuesto es la sumatoria del de las suyas
-- (decision #274), por eso esta tabla NO lleva columna de presupuesto: el monto vive en la
-- tabla de jornadas y aqui solo se guarda el estado y el porcentaje de avance del proyecto.

-- ============================================================================
-- Tipo enumerado del dominio
-- ============================================================================
CREATE TYPE estado_proyecto AS ENUM (
  'planificado',
  'en curso',
  'finalizado',
  'cancelado'
);

-- ============================================================================
-- Tabla
-- ============================================================================
CREATE TABLE proyectos (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  nombre VARCHAR(150) NOT NULL,
  descripcion TEXT,
  fecha_inicio DATE,
  fecha_fin DATE,
  responsable_id UUID REFERENCES perfiles(id) ON DELETE SET NULL,
  estado estado_proyecto NOT NULL DEFAULT 'planificado',
  porcentaje_avance INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_proyectos_porcentaje_avance
    CHECK (porcentaje_avance BETWEEN 0 AND 100)
);

ALTER TABLE proyectos ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Triggers
-- ============================================================================
-- Actualiza la columna updated_at con la hora actual en cada UPDATE de fila,
-- reutilizando la funcion actualizar_timestamp_updated_at() definida en la migracion 00001.
CREATE TRIGGER trg_proyectos_updated_at
BEFORE UPDATE ON proyectos
FOR EACH ROW
EXECUTE FUNCTION actualizar_timestamp_updated_at();

COMMENT ON TRIGGER trg_proyectos_updated_at ON proyectos IS
  'Actualiza automaticamente updated_at antes de cada UPDATE de una fila de proyectos.';
