CREATE TYPE operacion_auditoria AS ENUM (
  'insercion',
  'actualizacion',
  'baja',
  'eliminacion'
);

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

CREATE INDEX idx_eventos_auditoria_tabla_fila
  ON eventos_auditoria (tabla_afectada, fila_id);

CREATE INDEX idx_eventos_auditoria_realizado_en
  ON eventos_auditoria (realizado_en DESC);

CREATE INDEX idx_eventos_auditoria_realizado_por
  ON eventos_auditoria (realizado_por)
  WHERE realizado_por IS NOT NULL;

ALTER TABLE eventos_auditoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Solo administrador lee eventos_auditoria"
  ON eventos_auditoria FOR SELECT
  USING (public.es_administrador());

COMMENT ON TABLE eventos_auditoria IS
  'Bitacora de cambios sobre informacion sensible. Se escribe solo por trigger y solo la lee la administradora. Sin politicas de INSERT, UPDATE ni DELETE: con RLS habilitado, lo que no tiene politica esta prohibido. No se usa FORCE ROW LEVEL SECURITY porque el dueno debe seguir eximido para que los triggers SECURITY DEFINER puedan insertar.';

COMMENT ON COLUMN eventos_auditoria.fila_id IS
  'Llave primaria de la fila auditada. UUID porque las seis tablas auditadas la usan.';

COMMENT ON COLUMN eventos_auditoria.realizado_por IS
  'Perfil que origino el cambio. Sin llave foranea para que el registro sobreviva al borrado del perfil. NULL si la operacion no viene de una sesion.';

COMMENT ON COLUMN eventos_auditoria.operacion IS
  'La baja se distingue de una actualizacion cualquiera: es el UPDATE que estrena fecha_baja.';

COMMENT ON COLUMN eventos_auditoria.valores_anteriores IS
  'Fila completa antes del cambio. Incluye datos de pacientes, y por eso la tabla es de lectura exclusiva de la administradora.';

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

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION registrar_evento_auditoria() IS
  'Escribe una fila en eventos_auditoria por cada INSERT, UPDATE o DELETE de las tablas sensibles. Opera sobre to_jsonb(OLD) y to_jsonb(NEW) en lugar de sobre los campos, lo que le permite servir a tablas con columnas distintas sin conocerlas.';

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
  'Bloquea el borrado fisico de pacientes: la baja se registra con fecha_baja y queda auditada. Falla en voz alta en lugar de convertir el DELETE en una baja silenciosa.';

CREATE TRIGGER trg_pacientes_impedir_borrado_fisico
BEFORE DELETE ON pacientes
FOR EACH ROW
EXECUTE FUNCTION impedir_borrado_fisico_paciente();
