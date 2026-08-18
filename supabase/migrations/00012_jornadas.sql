-- Ecopac Digital - Tablas de jornadas, personal asignado e historial de estados
--
-- Una jornada es la unidad de trabajo de la organizacion: tiene fecha, comunidad,
-- responsable y proyecto (opcional). El presupuesto se asigna por jornada en
-- presupuesto_asignado (decision #274); el de un proyecto es la sumatoria del de sus
-- jornadas, por eso proyectos no lleva columna de presupuesto.
--
-- jornada_personal registra las asignaciones de medicos y voluntarios con su horario y
-- responsabilidad. jornada_estado_historial audita cada cambio de estado del tablero
-- kanban mediante un trigger.

-- ============================================================================
-- Tabla jornadas
-- ============================================================================
CREATE TABLE jornadas (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  nombre VARCHAR(150) NOT NULL,
  fecha DATE NOT NULL,
  comunidad_id UUID NOT NULL REFERENCES comunidades(id) ON DELETE RESTRICT,
  responsable_id UUID NOT NULL REFERENCES perfiles(id) ON DELETE RESTRICT,
  proyecto_id UUID REFERENCES proyectos(id) ON DELETE SET NULL,
  estado estado_jornada NOT NULL DEFAULT 'planificada',
  presupuesto_asignado NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_jornadas_presupuesto_no_negativo 
    CHECK (presupuesto_asignado >= 0),
  CONSTRAINT chk_jornadas_fecha_no_anterior_a_creacion 
    CHECK (fecha >= (created_at AT TIME ZONE 'America/Guatemala')::date)
);

CREATE INDEX idx_jornadas_comunidad_id ON jornadas (comunidad_id);
CREATE INDEX idx_jornadas_responsable_id ON jornadas (responsable_id);
CREATE INDEX idx_jornadas_proyecto_id ON jornadas (proyecto_id);

ALTER TABLE jornadas ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_jornadas_updated_at
BEFORE UPDATE ON jornadas
FOR EACH ROW
EXECUTE FUNCTION actualizar_timestamp_updated_at();

COMMENT ON TRIGGER trg_jornadas_updated_at ON jornadas IS
  'Actualiza automaticamente updated_at antes de cada UPDATE de una fila de jornadas.';

-- ============================================================================
-- Tabla jornada_personal
-- ============================================================================
-- UNIQUE (jornada_id, perfil_id) impide asignar dos veces a la misma persona en la
-- misma jornada.
CREATE TABLE jornada_personal (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  jornada_id UUID NOT NULL REFERENCES jornadas(id) ON DELETE CASCADE,
  perfil_id UUID NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  rol_en_jornada rol_usuario NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  responsabilidad TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (jornada_id, perfil_id),
  CONSTRAINT chk_jornada_personal_horario 
    CHECK (hora_fin > hora_inicio)
);

CREATE INDEX idx_jornada_personal_perfil_id ON jornada_personal (perfil_id);

ALTER TABLE jornada_personal ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_jornada_personal_updated_at
BEFORE UPDATE ON jornada_personal
FOR EACH ROW
EXECUTE FUNCTION actualizar_timestamp_updated_at();

COMMENT ON TRIGGER trg_jornada_personal_updated_at ON jornada_personal IS
  'Actualiza automaticamente updated_at antes de cada UPDATE de una fila de jornada_personal.';

-- ============================================================================
-- Tabla jornada_estado_historial
-- ============================================================================
CREATE TABLE jornada_estado_historial (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  jornada_id UUID NOT NULL REFERENCES jornadas(id) ON DELETE CASCADE,
  estado_anterior estado_jornada,
  estado_nuevo estado_jornada NOT NULL,
  cambiado_por UUID REFERENCES perfiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_jornada_estado_historial_jornada_id ON jornada_estado_historial (jornada_id);
CREATE INDEX idx_jornada_estado_historial_cambiado_por ON jornada_estado_historial (cambiado_por);

ALTER TABLE jornada_estado_historial ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Trigger de auditoria de cambios de estado
-- ============================================================================
-- Cada vez que se crea o cambia el estado de una jornada, guarda una fila en 
-- jornada_estado_historial con el estado anterior (nulo si es creacion), el nuevo, 
-- quien lo cambio y cuando. SECURITY DEFINER porque jornada_estado_historial tiene RLS 
-- habilitado y el insert debe funcionar sin permisos directos sobre la tabla.
CREATE OR REPLACE FUNCTION registrar_cambio_estado_jornada()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR OLD.estado IS DISTINCT FROM NEW.estado THEN
    INSERT INTO public.jornada_estado_historial (jornada_id, estado_anterior, estado_nuevo, cambiado_por)
    VALUES (
      NEW.id,
      CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.estado END,
      NEW.estado,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION registrar_cambio_estado_jornada() IS
  'Registra en jornada_estado_historial la creacion y cada cambio de estado de una jornada.';

CREATE TRIGGER trg_jornadas_estado_historial
AFTER INSERT OR UPDATE OF estado ON jornadas
FOR EACH ROW
EXECUTE FUNCTION registrar_cambio_estado_jornada();

COMMENT ON TRIGGER trg_jornadas_estado_historial ON jornadas IS
  'Inserta una fila en jornada_estado_historial cuando se crea una jornada o cambia su estado.';