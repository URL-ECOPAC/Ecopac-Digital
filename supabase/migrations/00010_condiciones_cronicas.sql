-- Ecopac Digital - Catalogo de condiciones cronicas y su asociacion al paciente
-- Soporta el seguimiento de pacientes cronicos (HU06).

-- ============================================================================
-- Catalogo de condiciones cronicas
-- ============================================================================
CREATE TABLE condiciones_cronicas (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  nombre VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE condiciones_cronicas ENABLE ROW LEVEL SECURITY;

-- Catalogo publico, igual que departamentos/municipios/comunidades: cualquier
-- autenticado lo puede leer; escribirlo queda para el issue de politicas de escritura
-- de catalogos.
CREATE POLICY "Lectura publica condiciones_cronicas" ON condiciones_cronicas
  FOR SELECT USING (true);

INSERT INTO condiciones_cronicas (nombre) VALUES
  ('Diabetes'),
  ('Hipertension'),
  ('Asma'),
  ('Epilepsia'),
  ('Desnutricion');

-- ============================================================================
-- Asociacion paciente-condicion
-- ============================================================================
CREATE TYPE estado_condicion_cronica AS ENUM (
  'activa',
  'controlada',
  'resuelta'
);

-- UNIQUE (paciente_id, condicion_id): un paciente puede tener varias condiciones,
-- pero cada condicion no se duplica en el mismo paciente.
CREATE TABLE padecimientos_cronicos (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  paciente_id UUID NOT NULL REFERENCES pacientes(id) ON DELETE RESTRICT,
  condicion_id UUID NOT NULL REFERENCES condiciones_cronicas(id) ON DELETE RESTRICT,
  fecha_diagnostico DATE NOT NULL,
  estado estado_condicion_cronica NOT NULL DEFAULT 'activa',
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (paciente_id, condicion_id)
);

CREATE INDEX idx_padecimientos_cronicos_paciente_id ON padecimientos_cronicos (paciente_id);
CREATE INDEX idx_padecimientos_cronicos_condicion_id ON padecimientos_cronicos (condicion_id);

ALTER TABLE padecimientos_cronicos ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_padecimientos_cronicos_updated_at
BEFORE UPDATE ON padecimientos_cronicos
FOR EACH ROW
EXECUTE FUNCTION actualizar_timestamp_updated_at();

-- Datos clinicos sensibles: solo administrador y medico pueden ver o registrar
-- condiciones cronicas de un paciente, igual que el resto del expediente clinico
-- (staff/voluntarios no acceden). Solo administrador puede borrar un registro, ya que
-- medico no tiene D en la matriz de permisos del expediente.
CREATE POLICY "Medico y administrador leen padecimientos_cronicos"
  ON padecimientos_cronicos FOR SELECT
  USING (public.es_administrador() OR public.rol_actual() = 'medico');

CREATE POLICY "Medico y administrador registran padecimientos_cronicos"
  ON padecimientos_cronicos FOR INSERT
  WITH CHECK (public.es_administrador() OR public.rol_actual() = 'medico');

CREATE POLICY "Medico y administrador actualizan padecimientos_cronicos"
  ON padecimientos_cronicos FOR UPDATE
  USING (public.es_administrador() OR public.rol_actual() = 'medico')
  WITH CHECK (public.es_administrador() OR public.rol_actual() = 'medico');

CREATE POLICY "Solo administrador borra padecimientos_cronicos"
  ON padecimientos_cronicos FOR DELETE
  USING (public.es_administrador());
