-- Ecopac Digital - Atenciones y triajes
--
-- La atencion vincula un paciente con una jornada: es la columna vertebral del flujo
-- de campo (registro -> triaje -> consulta -> receta). Del triaje cuelgan los signos
-- vitales del paciente en esa atencion (relacion uno a uno, ver atencion_id UNIQUE).
--
-- Decisiones de diseno:
-- - ON DELETE RESTRICT en ambas FKs de atenciones: las atenciones y los triajes son
--   historial clinico (mismo criterio que pacientes/expedientes en 00009, que nunca
--   se borran fisicamente). Una jornada sin atenciones se puede borrar; una jornada
--   con atenciones queda protegida contra un DELETE accidental que borraria en cascada
--   el registro clinico de toda una jornada. triajes.atencion_id si es CASCADE: el
--   triaje no tiene sentido sin su atencion.
-- - RLS habilitado en ambas tablas pero sin politicas (deny-all), igual que pacientes
--   en 00009 y jornadas en 00012: la matriz de politicas se define en un issue
--   posterior.

-- ============================================================================
-- Tabla atenciones
-- ============================================================================
-- UNIQUE (paciente_id, jornada_id): el mismo paciente no se puede registrar dos veces
-- en la misma jornada. Ese indice cubre ademas la FK paciente_id (columna izquierda).
CREATE TABLE atenciones (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  paciente_id UUID NOT NULL REFERENCES pacientes(id) ON DELETE RESTRICT,
  jornada_id UUID NOT NULL REFERENCES jornadas(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (paciente_id, jornada_id)
);

CREATE INDEX idx_atenciones_jornada_id ON atenciones (jornada_id);

ALTER TABLE atenciones ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_atenciones_updated_at
BEFORE UPDATE ON atenciones
FOR EACH ROW
EXECUTE FUNCTION actualizar_timestamp_updated_at();

-- ============================================================================
-- Tabla triajes
-- ============================================================================
-- Signos vitales del paciente en una atencion. Los rangos de los checks son
-- fisiologicos razonables: lo bastante amplios para aceptar casos extremos reales
-- (neonatos, emergencias), pero atrapan el error tipico de campo: un digito de mas
-- o de menos al anotar. Unidades: mmHg (presion), mg/dL (glucosa), kg (peso),
-- cm (talla), grados Celsius (temperatura), latidos por minuto (frecuencia).
CREATE TABLE triajes (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  atencion_id UUID UNIQUE NOT NULL REFERENCES atenciones(id) ON DELETE CASCADE,
  presion_sistolica SMALLINT NOT NULL,
  presion_diastolica SMALLINT NOT NULL,
  -- Cambiados a NULL permitidos por flexibilidad operativa en campo:
  glucosa SMALLINT, 
  peso NUMERIC(5, 2),
  talla NUMERIC(5, 2),
  temperatura NUMERIC(4, 1),
  frecuencia_cardiaca SMALLINT NOT NULL,
  -- Tipado explícito y matemática decimal forzada:
  imc NUMERIC(4, 1) GENERATED ALWAYS AS (ROUND(peso / POWER(talla / 100.0, 2), 1)) STORED,
  -- Agregado comportamiento ON DELETE explícito:
  tomado_por UUID NOT NULL REFERENCES perfiles(id) ON DELETE RESTRICT,
  tomado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_triajes_presion_sistolica_rango CHECK (presion_sistolica BETWEEN 40 AND 300),
  CONSTRAINT chk_triajes_presion_diastolica_rango CHECK (presion_diastolica BETWEEN 20 AND 200),
  CONSTRAINT chk_triajes_presion_coherente CHECK (presion_sistolica > presion_diastolica),
  CONSTRAINT chk_triajes_glucosa_rango CHECK (glucosa BETWEEN 20 AND 800),
  CONSTRAINT chk_triajes_peso_rango CHECK (peso BETWEEN 1 AND 400),
  CONSTRAINT chk_triajes_talla_rango CHECK (talla BETWEEN 30 AND 250),
  CONSTRAINT chk_triajes_temperatura_rango CHECK (temperatura BETWEEN 25 AND 45),
  CONSTRAINT chk_triajes_frecuencia_cardiaca_rango CHECK (frecuencia_cardiaca BETWEEN 20 AND 250)
);

-- Indice para auditoría de perfiles:
CREATE INDEX idx_triajes_tomado_por ON triajes (tomado_por);

ALTER TABLE triajes ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_triajes_updated_at
BEFORE UPDATE ON triajes
FOR EACH ROW
EXECUTE FUNCTION actualizar_timestamp_updated_at();
