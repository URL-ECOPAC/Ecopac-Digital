-- Ecopac Digital - Auditoria de usuario_permiso
-- Issue #104. Las concesiones y revocaciones puntuales de permisos (usuario_permiso, migracion
-- 00003) no quedaban auditadas: los seis triggers de la 00026 cubren pacientes, expedientes,
-- consultas, recetas, movimientos_inventario y perfiles, pero no usuario_permiso.
--
-- No se reutiliza registrar_evento_auditoria() (00026) porque asume una PK simple llamada id:
--   v_fila_id := (v_nuevos ->> 'id')::UUID;
-- usuario_permiso tiene PK compuesta (perfil_id, permiso_id) y no tiene columna id. Pegarle el
-- trigger generico tal cual dejaria fila_id en NULL, y esa columna es NOT NULL en
-- eventos_auditoria: el INSERT del trigger fallaria en cada concesion o revocacion.
--
-- Por eso esta migracion agrega una funcion de trigger dedicada, con la misma forma que la
-- generica (SECURITY DEFINER, to_jsonb(OLD)/to_jsonb(NEW) completos, mismas tres ramas de
-- INSERT/UPDATE/DELETE), pero usando perfil_id como fila_id: es el perfil cuyo acceso cambio,
-- que es el dato relevante para auditar "a quien le tocaron los permisos". permiso_id,
-- concedido, otorgado_por y motivo siguen quedando en valores_anteriores/valores_nuevos porque
-- to_jsonb() captura la fila completa, no solo la PK.

CREATE OR REPLACE FUNCTION registrar_evento_auditoria_usuario_permiso()
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
    v_fila_id := (v_anteriores ->> 'perfil_id')::UUID;

  ELSIF TG_OP = 'UPDATE' THEN
    v_anteriores := to_jsonb(OLD);
    v_nuevos := to_jsonb(NEW);
    v_operacion := 'actualizacion';
    v_fila_id := (v_nuevos ->> 'perfil_id')::UUID;

  ELSE
    v_anteriores := NULL;
    v_nuevos := to_jsonb(NEW);
    v_operacion := 'insercion';
    v_fila_id := (v_nuevos ->> 'perfil_id')::UUID;
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

COMMENT ON FUNCTION registrar_evento_auditoria_usuario_permiso() IS
  'Como registrar_evento_auditoria() (00026), pero para usuario_permiso: usa perfil_id como fila_id porque esta tabla no tiene columna id (su PK es compuesta perfil_id+permiso_id). permiso_id, concedido, otorgado_por y motivo quedan en valores_anteriores/valores_nuevos igual que en los triggers genericos.';

CREATE TRIGGER trg_usuario_permiso_auditoria
AFTER INSERT OR UPDATE OR DELETE ON usuario_permiso
FOR EACH ROW
EXECUTE FUNCTION registrar_evento_auditoria_usuario_permiso();
