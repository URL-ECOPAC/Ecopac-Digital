-- Ecopac Digital - Principios activos y catalogo de medicamentos
--
-- Catalogo base del modulo de inventario: principios activos, medicamentos y la
-- relacion muchos a muchos entre ambos (un medicamento puede combinar varios
-- principios, como amoxicilina + acido clavulanico).
--
-- Decisiones de diseno:
-- - presentacion reutiliza el enum presentacion_medicamento de 00001, tal cual.
-- - La distincion pediatrico/adulto es una columna booleana (es_pediatrico), no
--   valores nuevos del enum: la forma (tableta, jarabe) y la poblacion son ejes
--   distintos y el medico filtra por poblacion durante la consulta.
-- - forma_farmaceutica es el matiz libre de la presentacion (ej. 'tableta
--   masticable', 'suspension'); nullable porque una presentacion simple no siempre
--   lo necesita, y un NOT NULL empujaria valores basura como 'N/A'.
-- - marca va NOT NULL para que la restriccion unica no se esquive con NULLs; los
--   genericos se registran con marca 'Generico'.
-- - principios_activos es un catalogo sin seed (crece desde la app) y sin
--   updated_at, mismo patron que condiciones_cronicas en 00010.
-- - RLS habilitado en las tres tablas pero sin politicas (deny-all), igual que
--   pacientes (00009), jornadas (00012) y atenciones/triajes (00013): la matriz
--   de politicas se define en un issue posterior.

-- ============================================================================
-- Catalogo de principios activos
-- ============================================================================
CREATE TABLE principios_activos (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  nombre VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE principios_activos ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Tabla medicamentos
-- ============================================================================
-- UNIQUE (nombre, concentracion, presentacion, marca): la combinacion exacta no se
-- registra dos veces. concentracion es texto libre porque no es un solo numero
-- (ej. '500 mg', '250 mg/5 ml').
CREATE TABLE medicamentos (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  nombre VARCHAR(150) NOT NULL,
  concentracion VARCHAR(100) NOT NULL,
  presentacion presentacion_medicamento NOT NULL,
  marca VARCHAR(100) NOT NULL,
  forma_farmaceutica VARCHAR(100),
  es_pediatrico BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (nombre, concentracion, presentacion, marca)
);

ALTER TABLE medicamentos ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_medicamentos_updated_at
BEFORE UPDATE ON medicamentos
FOR EACH ROW
EXECUTE FUNCTION actualizar_timestamp_updated_at();

-- ============================================================================
-- Relacion medicamento-principio (muchos a muchos)
-- ============================================================================
-- Junta pura sin timestamps, mismo patron que rol_permiso (00003) y
-- perfil_especialidad (00002). CASCADE del lado del medicamento: la fila no tiene
-- sentido sin el. RESTRICT del lado del principio: es catalogo, no se borra uno
-- que esta en uso (mismo criterio que padecimientos_cronicos.condicion_id, 00010).
CREATE TABLE medicamento_principio (
  medicamento_id UUID NOT NULL REFERENCES medicamentos(id) ON DELETE CASCADE,
  principio_id UUID NOT NULL REFERENCES principios_activos(id) ON DELETE RESTRICT,
  PRIMARY KEY (medicamento_id, principio_id)
);

CREATE INDEX idx_medicamento_principio_principio_id ON medicamento_principio (principio_id);

ALTER TABLE medicamento_principio ENABLE ROW LEVEL SECURITY;
