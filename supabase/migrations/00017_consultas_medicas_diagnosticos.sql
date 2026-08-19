-- Ecopac Digital - Tablas de catálogo de diagnósticos, consultas médicas y diagnósticos asociados

-- ============================================================================
-- Tabla diagnosticos (Catálogo)
-- ============================================================================
CREATE TABLE IF NOT EXISTS diagnosticos (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  codigo VARCHAR(20),
  nombre VARCHAR(255) NOT NULL,
  descripcion TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_diagnosticos_nombre ON diagnosticos (nombre);

ALTER TABLE diagnosticos ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_diagnosticos_updated_at
BEFORE UPDATE ON diagnosticos
FOR EACH ROW
EXECUTE FUNCTION actualizar_timestamp_updated_at();

-- ============================================================================
-- Tabla consultas
-- ============================================================================
CREATE TABLE IF NOT EXISTS consultas (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  expediente_id UUID NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
  atencion_id UUID NOT NULL REFERENCES atenciones(id) ON DELETE RESTRICT,
  medico_id UUID NOT NULL REFERENCES perfiles(id) ON DELETE RESTRICT,
  jornada_id UUID NOT NULL REFERENCES jornadas(id) ON DELETE RESTRICT,
  
  -- Campos que reproducen el orden y la estructura de la ficha clínica física
  motivo_consulta TEXT NOT NULL,
  antecedentes TEXT,
  sintomas TEXT,
  exploracion TEXT,
  tratamiento TEXT,
  observaciones TEXT,
  plan_seguimiento TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consultas_expediente_id ON consultas (expediente_id);
CREATE INDEX IF NOT EXISTS idx_consultas_atencion_id ON consultas (atencion_id);
CREATE INDEX IF NOT EXISTS idx_consultas_medico_id ON consultas (medico_id);
CREATE INDEX IF NOT EXISTS idx_consultas_jornada_id ON consultas (jornada_id);

ALTER TABLE consultas ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_consultas_updated_at
BEFORE UPDATE ON consultas
FOR EACH ROW
EXECUTE FUNCTION actualizar_timestamp_updated_at();

COMMENT ON TRIGGER trg_consultas_updated_at ON consultas IS
  'Actualiza automaticamente updated_at antes de cada UPDATE de una fila de consultas.';

-- ============================================================================
-- Tabla consulta_diagnostico
-- ============================================================================
CREATE TABLE IF NOT EXISTS consulta_diagnostico (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  consulta_id UUID NOT NULL REFERENCES consultas(id) ON DELETE CASCADE,
  diagnostico_id UUID NOT NULL REFERENCES diagnosticos(id) ON DELETE RESTRICT,
  es_principal BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT uq_consulta_diagnostico UNIQUE (consulta_id, diagnostico_id)
);

CREATE INDEX IF NOT EXISTS idx_consulta_diagnostico_consulta_id ON consulta_diagnostico (consulta_id);
CREATE INDEX IF NOT EXISTS idx_consulta_diagnostico_diagnostico_id ON consulta_diagnostico (diagnostico_id);

-- Restricción para garantizar que solo exista UN diagnóstico principal por consulta
CREATE UNIQUE INDEX IF NOT EXISTS idx_unico_diagnostico_principal 
ON consulta_diagnostico (consulta_id) 
WHERE (es_principal IS TRUE);

ALTER TABLE consulta_diagnostico ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Trigger: Validar que la jornada esté 'en curso'
-- ============================================================================
CREATE OR REPLACE FUNCTION validar_jornada_en_curso()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_estado public.estado_jornada;
BEGIN
  SELECT estado INTO v_estado
  FROM public.jornadas
  WHERE id = NEW.jornada_id;

  IF v_estado IS NULL OR v_estado != 'en curso' THEN
    RAISE EXCEPTION 'No se puede registrar la consulta: La jornada asociada no esta en curso (Estado actual: %).', 
      COALESCE(v_estado::text, 'NO ENCONTRADA');
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION validar_jornada_en_curso() IS
  'Valida que la jornada asociada a la consulta se encuentre en estado en curso antes de guardar.';

CREATE TRIGGER trg_validar_jornada_en_curso
BEFORE INSERT OR UPDATE ON consultas
FOR EACH ROW
EXECUTE FUNCTION validar_jornada_en_curso();