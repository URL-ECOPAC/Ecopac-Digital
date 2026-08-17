-- Ecopac Digital - Tablas de pacientes y expedientes
-- Cada paciente tiene un expediente clinico unico: es la regla de negocio central del
-- sistema (relacion uno a uno, ver expedientes.paciente_id UNIQUE).

-- ============================================================================
-- Tabla pacientes
-- ============================================================================
CREATE TABLE pacientes (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  nombres VARCHAR(100) NOT NULL,
  apellidos VARCHAR(100) NOT NULL,
  fecha_nacimiento DATE NOT NULL,
  sexo VARCHAR(20) NOT NULL,
  comunidad_id UUID NOT NULL REFERENCES comunidades(id) ON DELETE RESTRICT,
  telefono_contacto VARCHAR(20) NOT NULL,
  idioma idioma_preferido NOT NULL,
  -- Opcional: muchos pacientes de comunidades rurales no tienen DPI.
  dpi VARCHAR(20) UNIQUE,
  -- Borrado logico: si tiene fecha, el paciente esta dado de baja. La fila nunca se
  -- borra fisicamente para conservar el historial clinico.
  fecha_baja DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pacientes_comunidad_id ON pacientes (comunidad_id);

ALTER TABLE pacientes ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_pacientes_updated_at
BEFORE UPDATE ON pacientes
FOR EACH ROW
EXECUTE FUNCTION actualizar_timestamp_updated_at();

-- ============================================================================
-- Tabla expedientes
-- ============================================================================
-- paciente_id es UNIQUE (ademas de FK) para que la relacion con pacientes sea uno a
-- uno. ON DELETE RESTRICT porque pacientes nunca se borra fisicamente (ver
-- fecha_baja arriba), asi que esta referencia nunca deberia bloquear un borrado real.
CREATE TABLE expedientes (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  paciente_id UUID UNIQUE NOT NULL REFERENCES pacientes(id) ON DELETE RESTRICT,
  numero_ficha VARCHAR(30) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE expedientes ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_expedientes_updated_at
BEFORE UPDATE ON expedientes
FOR EACH ROW
EXECUTE FUNCTION actualizar_timestamp_updated_at();
