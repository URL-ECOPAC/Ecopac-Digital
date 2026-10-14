-- ============================================================================
-- 00152: la bitacora registra todas las tablas de negocio
-- ============================================================================
--
-- La 00026 audito solo las tablas "sensibles" (pacientes, expedientes, consultas, recetas,
-- movimientos de inventario, perfiles), y las migraciones siguientes sumaron algunas mas. La
-- bitacora mostraba entonces solo una parte de lo que pasa en el sistema: un cambio en una jornada,
-- un gasto, una donacion, un lote o un catalogo no dejaba rastro. La administracion pidio que se vea
-- todo.
--
-- Se audita toda tabla que la aplicacion escribe. Quedan fuera, a proposito:
--   - eventos_auditoria: es la bitacora misma.
--   - existencias: es un saldo derivado; lo que la mueve (movimientos_inventario) ya se audita.
--   - jornada_estado_historial, proyecto_estado_historial: ya son historiales, escritos por trigger.
--   - notificaciones: las escribe el sistema; su envio se ve en la pestana de correos (00149).
--   - alerta_caducidad_detalle: el desglose de atender una alerta; la alerta (alertas_caducidad) si
--     se audita.
--   - limites_de_uso: contador interno del limite de uso.
--   - departamentos, municipios, idiomas, permisos: catalogos fijos sembrados por migracion.
--
-- El volumen crece: una atencion completa suma ahora tambien su triaje, su atencion y los
-- renglones de receta y diagnostico. Sigue muy por debajo del limite del plan (ver
-- docs/SEGURIDAD.md, "Retencion propuesta para eventos_auditoria").
-- ============================================================================

-- ============================================================================
-- 1. El trigger generico acepta la columna que identifica la fila
-- ============================================================================
-- fila_id es NOT NULL y se leia siempre de `id`. Dos tablas no tienen `id` (medicamento_principio y
-- perfil_especialidad, con llave compuesta): para ellas el trigger recibe como argumento la columna
-- UUID que mejor identifica el registro. Sin argumento se comporta igual que antes.
CREATE OR REPLACE FUNCTION public.registrar_evento_auditoria()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_anteriores JSONB;
  v_nuevos JSONB;
  v_operacion public.operacion_auditoria;
  v_fila_id UUID;
  v_columna_id TEXT := coalesce(TG_ARGV[0], 'id');
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_anteriores := to_jsonb(OLD);
    v_nuevos := NULL;
    v_operacion := 'eliminacion';
    v_fila_id := (v_anteriores ->> v_columna_id)::UUID;

  ELSIF TG_OP = 'UPDATE' THEN
    v_anteriores := to_jsonb(OLD);
    v_nuevos := to_jsonb(NEW);
    v_fila_id := (v_nuevos ->> v_columna_id)::UUID;

    IF (v_anteriores ->> 'fecha_baja') IS NULL AND (v_nuevos ->> 'fecha_baja') IS NOT NULL THEN
      v_operacion := 'baja';
    ELSE
      v_operacion := 'actualizacion';
    END IF;

  ELSE
    v_anteriores := NULL;
    v_nuevos := to_jsonb(NEW);
    v_operacion := 'insercion';
    v_fila_id := (v_nuevos ->> v_columna_id)::UUID;
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
$function$;

-- ============================================================================
-- 2. Triggers en las tablas que faltaban
-- ============================================================================
DO $$
DECLARE
  v_tabla TEXT;
BEGIN
  FOREACH v_tabla IN ARRAY ARRAY[
    -- Atencion clinica
    'atenciones', 'triajes', 'consulta_diagnostico', 'receta_detalle', 'fusiones_pacientes',
    -- Catalogos que la aplicacion mantiene
    'diagnosticos', 'condiciones_cronicas', 'comunidades',
    -- Inventario
    'medicamentos', 'principios_activos', 'presentaciones', 'bodegas', 'proveedores', 'lotes',
    'alertas_caducidad',
    -- Jornadas
    'jornadas', 'jornada_personal', 'jornada_presupuesto_origen', 'jornada_insumos',
    -- Proyectos y presupuesto
    'proyectos', 'proyecto_personal', 'proyecto_hitos', 'proyecto_seguimiento', 'proyecto_insumos',
    'gastos',
    -- Donaciones
    'donantes', 'donaciones', 'donacion_detalle'
  ]
  LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%1$s_auditoria
         AFTER INSERT OR UPDATE OR DELETE ON public.%1$I
         FOR EACH ROW EXECUTE FUNCTION public.registrar_evento_auditoria()',
      v_tabla
    );
  END LOOP;
END $$;

-- Las dos tablas de llave compuesta: el medicamento y el perfil identifican el registro.
CREATE TRIGGER trg_medicamento_principio_auditoria
AFTER INSERT OR UPDATE OR DELETE ON public.medicamento_principio
FOR EACH ROW EXECUTE FUNCTION public.registrar_evento_auditoria('medicamento_id');

CREATE TRIGGER trg_perfil_especialidad_auditoria
AFTER INSERT OR UPDATE OR DELETE ON public.perfil_especialidad
FOR EACH ROW EXECUTE FUNCTION public.registrar_evento_auditoria('perfil_id');
