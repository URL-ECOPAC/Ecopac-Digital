-- Ecopac Digital - Ajustes a departamentos y municipios, y tabla de comunidades
--
-- 00006_departamentos_municipios.sql ya esta aplicada en ecopac-dev (confirmado con
-- supabase migration list --linked), asi que no se edita: esta migracion corrige hacia
-- adelante lo que le falta frente al DoD del issue #67 (nombres unicos dentro del
-- padre, indices sobre las llaves foraneas, timestamps) y agrega comunidades, la tabla
-- que completa la jerarquia territorial (departamento -> municipio -> comunidad).
--
-- Pendiente, fuera de alcance de esta migracion: departamentos.id y municipios.id
-- siguen siendo INT en vez de UUID como el resto del esquema. Cambiar el tipo de una
-- llave primaria ya referenciada en el remoto es una migracion de datos delicada
-- (reescribir FKs, indices y cualquier dato sembrado) y debe decidirse con el equipo
-- antes de tocarla.

-- ============================================================================
-- Ajustes a departamentos y municipios
-- ============================================================================
ALTER TABLE departamentos
  ADD CONSTRAINT departamentos_nombre_key UNIQUE (nombre),
  ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TRIGGER trg_departamentos_updated_at
BEFORE UPDATE ON departamentos
FOR EACH ROW
EXECUTE FUNCTION actualizar_timestamp_updated_at();

ALTER TABLE municipios
  ADD CONSTRAINT municipios_departamento_id_nombre_key UNIQUE (departamento_id, nombre),
  ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX idx_municipios_departamento_id ON municipios (departamento_id);

CREATE TRIGGER trg_municipios_updated_at
BEFORE UPDATE ON municipios
FOR EACH ROW
EXECUTE FUNCTION actualizar_timestamp_updated_at();

-- ============================================================================
-- Tabla comunidades
-- ============================================================================
-- municipio_id es INT porque referencia municipios.id (INT). El id propio de
-- comunidades es UUID, consistente con el resto del esquema, porque es una tabla
-- nueva sin datos ni referencias existentes que obliguen a un tipo en particular.
CREATE TABLE comunidades (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  municipio_id INT NOT NULL REFERENCES municipios(id) ON DELETE CASCADE,
  nombre VARCHAR(100) NOT NULL,
  latitud NUMERIC(9, 6),
  longitud NUMERIC(9, 6),
  referencia_acceso TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (municipio_id, nombre)
);

CREATE INDEX idx_comunidades_municipio_id ON comunidades (municipio_id);

ALTER TABLE comunidades ENABLE ROW LEVEL SECURITY;

-- Misma politica que ya tienen departamentos y municipios (00006): lectura publica,
-- solo Admin edita (la politica de escritura queda para el issue de RLS por rol).
CREATE POLICY "Lectura publica comunidades" ON comunidades FOR SELECT USING (true);

CREATE TRIGGER trg_comunidades_updated_at
BEFORE UPDATE ON comunidades
FOR EACH ROW
EXECUTE FUNCTION actualizar_timestamp_updated_at();
