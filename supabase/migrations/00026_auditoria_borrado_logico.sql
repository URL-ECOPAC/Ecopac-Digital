-- Ecopac Digital - Registro de auditoria y borrado logico
--
-- Deja constancia de quien creo, modifico o dio de baja informacion sensible. Sin esto, una
-- correccion legitima en el expediente de un paciente es indistinguible de una alteracion:
-- no queda rastro de que decia la fila antes, ni de quien la toco.
--
-- Dos reglas gobiernan este archivo:
--
--   1. La tabla de auditoria se lee, no se escribe. Las filas las ponen los triggers, que
--      corren con los privilegios de su dueno; desde la aplicacion no hay forma de insertar,
--      modificar ni borrar en ella.
--   2. Los datos clinicos no se borran fisicamente. Un paciente se da de baja poniendo
--      fecha_baja (columna que ya existe desde 00009) y esa baja queda auditada como tal.

-- ============================================================================
-- Tipo de operacion registrada
-- ============================================================================
-- "baja" no es una operacion de SQL sino del negocio: es el UPDATE que estrena fecha_baja.
-- Se separa de una actualizacion cualquiera porque es la que responde a la pregunta "quien
-- dio de baja a este paciente y cuando", que en papel era una firma en la ficha.
CREATE TYPE operacion_auditoria AS ENUM (
  'insercion',
  'actualizacion',
  'baja',
  'eliminacion'
);

-- ============================================================================
-- Tabla eventos_auditoria
-- ============================================================================
-- fila_id es UUID y no TEXT porque las seis tablas auditadas usan UUID como llave primaria.
-- Si alguna vez se audita una tabla con otro tipo de llave, esta columna hay que revisarla.
--
-- realizado_por guarda el UUID del perfil pero NO lleva llave foranea, a proposito. Un
-- registro de auditoria tiene que sobrevivir a lo que le pase al resto del esquema: con
-- ON DELETE SET NULL se perderia el autor del evento, y con RESTRICT un perfil quedaria
-- imposible de borrar para siempre. Ninguna de las dos es aceptable en una bitacora.
-- Puede venir NULL cuando la operacion no la origina una sesion (migraciones, seed, o el
-- trigger que crea el perfil al registrarse un usuario).
--
-- Los valores viajan como JSONB, que es lo que permite que una sola funcion de trigger sirva
-- a tablas con columnas distintas. Eso significa que aqui SI hay datos de pacientes: es
-- justamente el proposito de la bitacora, y por eso la tabla es de lectura exclusiva de la
-- administradora (ver las politicas mas abajo).
CREATE TABLE eventos_auditoria (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tabla_afectada TEXT NOT NULL,
  fila_id UUID NOT NULL,
  operacion operacion_auditoria NOT NULL,
  realizado_por UUID,
  realizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valores_anteriores JSONB,
  valores_nuevos JSONB
);

-- La consulta natural es "que le paso a esta fila", no "que paso en esta tabla".
CREATE INDEX idx_eventos_auditoria_tabla_fila
  ON eventos_auditoria (tabla_afectada, fila_id);

-- Para la revision cronologica: lo ultimo que ocurrio en el sistema.
CREATE INDEX idx_eventos_auditoria_realizado_en
  ON eventos_auditoria (realizado_en DESC);

-- Para auditar a una persona concreta. Parcial porque las filas sin sesion no se investigan.
CREATE INDEX idx_eventos_auditoria_realizado_por
  ON eventos_auditoria (realizado_por)
  WHERE realizado_por IS NOT NULL;

ALTER TABLE eventos_auditoria ENABLE ROW LEVEL SECURITY;

-- Solo hay politica de SELECT, y solo para la administradora. La ausencia de politicas de
-- INSERT, UPDATE y DELETE no es un olvido: con RLS habilitado, lo que no tiene politica esta
-- prohibido, asi que ni siquiera la administradora puede alterar la bitacora desde la API.
--
-- No se usa FORCE ROW LEVEL SECURITY a proposito: el dueno de la tabla debe seguir eximido
-- para que los triggers de mas abajo puedan insertar. Activarlo dejaria la bitacora vacia.
CREATE POLICY "Solo administrador lee eventos_auditoria"
  ON eventos_auditoria FOR SELECT
  USING (public.es_administrador());

COMMENT ON TABLE eventos_auditoria IS
  'Bitacora de cambios sobre informacion sensible. Se escribe solo por trigger y solo la lee la administradora.';

COMMENT ON COLUMN eventos_auditoria.realizado_por IS
  'Perfil que origino el cambio. Sin llave foranea para que el registro sobreviva al borrado del perfil. NULL si la operacion no viene de una sesion.';

-- ============================================================================
-- Funcion de trigger
-- ============================================================================
-- Una sola funcion para las seis tablas. Trabaja sobre to_jsonb(OLD) y to_jsonb(NEW) en vez
-- de sobre los campos, que es lo que le permite ser generica: no necesita saber que columnas
-- tiene la tabla que la invoca.
--
-- SECURITY DEFINER porque eventos_auditoria tiene RLS y ningun rol de la aplicacion tiene
-- politica de INSERT sobre ella. Es la unica via de escritura que existe.
CREATE OR REPLACE FUNCTION registrar_evento_auditoria()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_anteriores JSONB;
  v_nuevos JSONB;
  v_operacion public.operacion_auditoria;
  v_fila_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_anteriores := to_jsonb(OLD);
    v_nuevos := NULL;
    v_operacion := 'eliminacion';
    v_fila_id := (v_anteriores ->> 'id')::UUID;

  ELSIF TG_OP = 'UPDATE' THEN
    v_anteriores := to_jsonb(OLD);
    v_nuevos := to_jsonb(NEW);
    v_fila_id := (v_nuevos ->> 'id')::UUID;

    -- La comparacion va sobre el JSON y no sobre OLD.fecha_baja porque esta misma funcion la
    -- usan tablas que no tienen esa columna: sobre el JSON, "ausente" y "nulo" se leen igual
    -- y la condicion simplemente no se cumple.
    IF (v_anteriores ->> 'fecha_baja') IS NULL AND (v_nuevos ->> 'fecha_baja') IS NOT NULL THEN
      v_operacion := 'baja';
    ELSE
      v_operacion := 'actualizacion';
    END IF;

  ELSE
    v_anteriores := NULL;
    v_nuevos := to_jsonb(NEW);
    v_operacion := 'insercion';
    v_fila_id := (v_nuevos ->> 'id')::UUID;
  END IF;

  INSERT INTO public.eventos_auditoria (
    tabla_afectada,
    fila_id,
    operacion,
    realizado_por,
    valores_anteriores,
    valores_nuevos
  )
  VALUES (
    TG_TABLE_NAME,
    v_fila_id,
    v_operacion,
    auth.uid(),
    v_anteriores,
    v_nuevos
  );

  -- Los triggers AFTER ignoran el valor devuelto, pero devolver la fila deja la funcion
  -- reutilizable si alguna vez se enlaza como BEFORE.
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION registrar_evento_auditoria() IS
  'Escribe una fila en eventos_auditoria por cada INSERT, UPDATE o DELETE de las tablas sensibles.';

-- ============================================================================
-- Triggers sobre las tablas sensibles
-- ============================================================================
-- AFTER y no BEFORE: solo se audita lo que efectivamente quedo guardado. Un INSERT que viola
-- un CHECK no debe dejar rastro de un cambio que nunca ocurrio.
CREATE TRIGGER trg_pacientes_auditoria
AFTER INSERT OR UPDATE OR DELETE ON pacientes
FOR EACH ROW
EXECUTE FUNCTION registrar_evento_auditoria();

CREATE TRIGGER trg_expedientes_auditoria
AFTER INSERT OR UPDATE OR DELETE ON expedientes
FOR EACH ROW
EXECUTE FUNCTION registrar_evento_auditoria();

CREATE TRIGGER trg_consultas_auditoria
AFTER INSERT OR UPDATE OR DELETE ON consultas
FOR EACH ROW
EXECUTE FUNCTION registrar_evento_auditoria();

CREATE TRIGGER trg_recetas_auditoria
AFTER INSERT OR UPDATE OR DELETE ON recetas
FOR EACH ROW
EXECUTE FUNCTION registrar_evento_auditoria();

CREATE TRIGGER trg_movimientos_inventario_auditoria
AFTER INSERT OR UPDATE OR DELETE ON movimientos_inventario
FOR EACH ROW
EXECUTE FUNCTION registrar_evento_auditoria();

CREATE TRIGGER trg_perfiles_auditoria
AFTER INSERT OR UPDATE OR DELETE ON perfiles
FOR EACH ROW
EXECUTE FUNCTION registrar_evento_auditoria();

-- ============================================================================
-- Borrado logico de pacientes
-- ============================================================================
-- La columna fecha_baja existe desde 00009, pero nada impedia un DELETE que se llevara por
-- delante el historial clinico. Este trigger lo impide.
--
-- Falla en voz alta en lugar de convertir el DELETE en una baja silenciosa: si la aplicacion
-- cree que borro una fila y la fila sigue ahi, el error aparece mucho despues y en otro
-- sitio. Mejor que reviente donde se cometio.
CREATE OR REPLACE FUNCTION impedir_borrado_fisico_paciente()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION
    'Los pacientes no se borran fisicamente. Registra la baja asignando fecha_baja.'
    USING ERRCODE = 'restrict_violation';
END;
$$;

COMMENT ON FUNCTION impedir_borrado_fisico_paciente() IS
  'Bloquea el borrado fisico de pacientes: la baja se registra con fecha_baja y queda auditada.';

-- BEFORE, para detener el borrado antes de que ocurra. Se dispara antes que el trigger AFTER
-- de auditoria, asi que un intento bloqueado no ensucia la bitacora con un evento que no paso.
CREATE TRIGGER trg_pacientes_impedir_borrado_fisico
BEFORE DELETE ON pacientes
FOR EACH ROW
EXECUTE FUNCTION impedir_borrado_fisico_paciente();
