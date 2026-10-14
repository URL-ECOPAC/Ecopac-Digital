-- ============================================================================
-- 00163: las pantallas se actualizan solas cuando cambian los datos
-- ============================================================================
--
-- Hasta aqui cada pantalla leia sus datos al abrirse y no volvia a mirar: si alguien aprobaba un
-- gasto en Aprobaciones, la pestana Gastos lo seguia mostrando pendiente hasta recargar el
-- navegador. La administracion pidio ver los datos reales lo mas rapido posible, en todas las
-- pantallas.
--
-- Supabase Realtime avisa de los cambios de las tablas que estan en la publicacion
-- supabase_realtime, que hasta ahora estaba vacia. Aqui entran las tablas de negocio que muestran
-- las pantallas. El aviso respeta el RLS de cada persona: nadie se entera de una fila que no puede
-- leer. El cliente no usa el contenido del aviso, solo vuelve a leer con su consulta de siempre
-- (useCambiosEnTiempoReal en packages/shared/api/).
--
-- Solo se agregan las tablas que aun no esten, para que la migracion no falle si alguna ya se
-- habia sumado a mano desde el dashboard.
-- ============================================================================

DO $$
DECLARE
  v_tabla TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  FOREACH v_tabla IN ARRAY ARRAY[
    'alertas_caducidad', 'atenciones', 'consultas', 'donacion_detalle', 'donaciones', 'donantes',
    'existencias', 'gastos', 'jornada_estado_historial', 'jornada_insumos', 'jornada_personal',
    'jornada_presupuesto_origen', 'jornadas', 'lotes', 'medicamentos', 'movimientos_inventario',
    'notificaciones', 'pacientes', 'perfiles', 'proyecto_hitos', 'proyecto_insumos',
    'proyecto_personal', 'proyecto_seguimiento', 'proyectos', 'recetas', 'triajes'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = v_tabla
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', v_tabla);
    END IF;
  END LOOP;
END;
$$;
