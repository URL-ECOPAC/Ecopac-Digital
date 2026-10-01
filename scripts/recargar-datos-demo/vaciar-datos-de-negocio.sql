-- Vacia los datos de negocio de una base de DESARROLLO antes de recargar supabase/seed-demo.sql.
-- Lo corre scripts/recargar-datos-demo.sh; no se ejecuta a mano ni contra produccion.
--
-- Se vacia lo que se registra trabajando: pacientes y su atencion, jornadas, proyectos,
-- donaciones, presupuesto y gastos, inventario (lotes, existencias, movimientos, alertas),
-- notificaciones y la bitacora de auditoria.
--
-- Se conserva:
--   - las cuentas (auth.users, perfiles) y sus permisos (usuario_permiso, rol_modulo,
--     rol_permiso, perfil_especialidad);
--   - los catalogos: territorio, comunidades, idiomas, condiciones cronicas, diagnosticos,
--     medicamentos y principios activos, presentaciones, bodegas, proveedores, categorias de
--     gasto, fuentes de presupuesto, limites de uso y la configuracion de alertas.
--
-- CASCADE solo alcanza tablas de esta misma lista: ninguna tabla que se conserva tiene llave
-- foranea hacia una que se vacia.

TRUNCATE
  public.pacientes,
  public.expedientes,
  public.padecimientos_cronicos,
  public.fusiones_pacientes,
  public.atenciones,
  public.triajes,
  public.consultas,
  public.consulta_diagnostico,
  public.recetas,
  public.receta_detalle,
  public.jornadas,
  public.jornada_personal,
  public.jornada_estado_historial,
  public.jornada_insumos,
  public.jornada_presupuesto_origen,
  public.movimientos_de_caja,
  public.proyectos,
  public.proyecto_hitos,
  public.proyecto_seguimiento,
  public.proyecto_estado_historial,
  public.proyecto_personal,
  public.proyecto_insumos,
  public.donantes,
  public.donaciones,
  public.donacion_detalle,
  public.gastos,
  public.lotes,
  public.existencias,
  public.movimientos_inventario,
  public.alertas_caducidad,
  public.alerta_caducidad_detalle,
  public.avisos_caducidad,
  public.notificaciones,
  public.eventos_auditoria
RESTART IDENTITY CASCADE;
