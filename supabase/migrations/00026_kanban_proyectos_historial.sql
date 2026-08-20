-- Ecopac Digital - Kanban de proyectos: orden en tablero, historial de cambios de estado
-- y bloqueo de transiciones invalidas
--
-- El kanban de avance de proyectos (aparte del kanban de jornadas) reutiliza el `estado`
-- (estado_proyecto) que ya existe desde #72: no se crea ningun enum ni columna "etapa" nueva.
-- Lo unico nuevo en proyectos es orden_columna, la posicion dentro de la columna del tablero.
-- proyecto_estado_historial audita cada cambio de estado replicando el patron de
-- jornada_estado_historial (00012_jornadas.sql), y un segundo trigger bloquea transiciones de
-- estado que no esten en la lista de transiciones permitidas.

-- ============================================================================
-- 1. Columna de orden dentro del tablero kanban
-- ============================================================================
-- Sin constraint UNIQUE: el frontend resuelve el desempate al reordenar (drag-and-drop), igual
-- que cualquier tablero kanban estandar.
ALTER TABLE proyectos
  ADD COLUMN orden_columna INTEGER NOT NULL DEFAULT 0;

-- ============================================================================
-- 2. Tabla proyecto_estado_historial
-- ============================================================================
CREATE TABLE proyecto_estado_historial (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  proyecto_id UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  estado_anterior estado_proyecto,
  estado_nuevo estado_proyecto NOT NULL,
  cambiado_por UUID REFERENCES perfiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_proyecto_estado_historial_proyecto_id ON proyecto_estado_historial (proyecto_id);
CREATE INDEX idx_proyecto_estado_historial_cambiado_por ON proyecto_estado_historial (cambiado_por);

ALTER TABLE proyecto_estado_historial ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. Trigger de auditoria de cambios de estado
-- ============================================================================
-- Cada vez que se crea o cambia el estado de un proyecto, guarda una fila en
-- proyecto_estado_historial con el estado anterior (nulo si es creacion), el nuevo, quien lo
-- cambio y cuando. SECURITY DEFINER porque proyecto_estado_historial tiene RLS habilitado y el
-- insert debe funcionar sin permisos directos sobre la tabla.
CREATE OR REPLACE FUNCTION registrar_cambio_estado_proyecto()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR OLD.estado IS DISTINCT FROM NEW.estado THEN
    INSERT INTO public.proyecto_estado_historial (proyecto_id, estado_anterior, estado_nuevo, cambiado_por)
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

COMMENT ON FUNCTION registrar_cambio_estado_proyecto() IS
  'Registra en proyecto_estado_historial la creacion y cada cambio de estado de un proyecto.';

CREATE TRIGGER trg_proyectos_estado_historial
AFTER INSERT OR UPDATE OF estado ON proyectos
FOR EACH ROW
EXECUTE FUNCTION registrar_cambio_estado_proyecto();

COMMENT ON TRIGGER trg_proyectos_estado_historial ON proyectos IS
  'Inserta una fila en proyecto_estado_historial cuando se crea un proyecto o cambia su estado.';

-- ============================================================================
-- 4. Trigger de bloqueo de transiciones de estado invalidas
-- ============================================================================
-- Transiciones permitidas: planificado -> en curso, en curso -> finalizado,
-- planificado -> cancelado, en curso -> cancelado. finalizado y cancelado son terminales.
-- No se permite saltar de planificado a finalizado ni retroceder.
CREATE OR REPLACE FUNCTION fn_validar_transicion_estado_proyecto()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT (
    (OLD.estado = 'planificado' AND NEW.estado = 'en curso')
    OR (OLD.estado = 'en curso' AND NEW.estado = 'finalizado')
    OR (OLD.estado = 'planificado' AND NEW.estado = 'cancelado')
    OR (OLD.estado = 'en curso' AND NEW.estado = 'cancelado')
  ) THEN
    RAISE EXCEPTION 'Transicion de estado invalida para proyectos: % -> %', OLD.estado, NEW.estado;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION fn_validar_transicion_estado_proyecto() IS
  'Bloquea cambios de estado de proyectos que no esten en la lista de transiciones permitidas.';

CREATE TRIGGER tr_validar_transicion_estado_proyecto
BEFORE UPDATE OF estado ON proyectos
FOR EACH ROW
WHEN (OLD.estado IS DISTINCT FROM NEW.estado)
EXECUTE FUNCTION fn_validar_transicion_estado_proyecto();

COMMENT ON TRIGGER tr_validar_transicion_estado_proyecto ON proyectos IS
  'Impide guardar un cambio de estado de proyecto que no este en la lista de transiciones permitidas.';
