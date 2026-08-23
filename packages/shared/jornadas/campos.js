// Esquema declarativo de los formularios del modulo de jornadas: formulario de
// jornada (creacion/edicion), asignacion de personal y marcar asistencia.
//
// Los campos y su validacion reflejan las columnas y los CHECK reales de jornadas y
// jornada_personal (00012, mas codigo/fecha_inicio_real/fecha_fin_real/
// orden_kanban/cupo_estimado/botiquin_bodega_id/asistio agregados en la 00036), no el
// diccionario de datos original cuando difieren (ver AGENTS.md, "Fuente de verdad").
// estado, orden_kanban, fecha_inicio_real y fecha_fin_real no son campos de este
// formulario: los mueve el kanban (arrastrar una tarjeta) y las acciones de iniciar/
// finalizar jornada, no una edicion manual.

export const TIPOS_DE_CAMPO = {
  TEXTO: 'texto',
  TEXTO_LARGO: 'texto_largo',
  NUMERO: 'numero',
  FECHA: 'fecha',
  HORA: 'hora',
  SELECT: 'select',
  BOOLEANO: 'booleano',
};

/** Valores de rol_usuario (00001_initial_schema.sql), para el rol que se ejerce en la jornada. */
export const OPCIONES_ROL_EN_JORNADA = [
  { valor: 'administrador', etiqueta: 'Administrador' },
  { valor: 'junta directiva', etiqueta: 'Junta directiva' },
  { valor: 'socio fundador', etiqueta: 'Socio fundador' },
  { valor: 'medico', etiqueta: 'Medico' },
  { valor: 'voluntario general', etiqueta: 'Voluntario' },
];

/** Formulario de creacion/edicion de una jornada (jornadas, 00012 + 00036). */
export const CAMPOS_JORNADA = [
  { id: 'nombre', label: 'Nombre', tipo: TIPOS_DE_CAMPO.TEXTO, validacion: { requerido: true, maxLongitud: 150 } },
  { id: 'codigo', label: 'Codigo', tipo: TIPOS_DE_CAMPO.TEXTO, validacion: { requerido: false, maxLongitud: 30 } },
  { id: 'fecha', label: 'Fecha', tipo: TIPOS_DE_CAMPO.FECHA, validacion: { requerido: true, minFecha: 'hoy' } },
  { id: 'comunidad', label: 'Comunidad', tipo: TIPOS_DE_CAMPO.SELECT, opcionesDesde: 'comunidades', validacion: { requerido: true } },
  { id: 'responsable', label: 'Responsable', tipo: TIPOS_DE_CAMPO.SELECT, opcionesDesde: 'perfiles', validacion: { requerido: true } },
  { id: 'proyecto', label: 'Proyecto', tipo: TIPOS_DE_CAMPO.SELECT, opcionesDesde: 'proyectos', validacion: { requerido: false } },
  { id: 'cupoEstimado', label: 'Cupo estimado', tipo: TIPOS_DE_CAMPO.NUMERO, validacion: { requerido: false, min: 0 } },
  { id: 'presupuestoAsignado', label: 'Presupuesto asignado', tipo: TIPOS_DE_CAMPO.NUMERO, validacion: { requerido: false, min: 0 } },
  { id: 'botiquinBodega', label: 'Bodega de botiquin', tipo: TIPOS_DE_CAMPO.SELECT, opcionesDesde: 'bodegas', validacion: { requerido: false } },
];

/**
 * Formulario de asignacion de personal a una jornada (jornada_personal, 00012).
 * asistio no esta aqui: se marca despues, con CAMPOS_MARCAR_ASISTENCIA.
 */
export const CAMPOS_ASIGNACION_PERSONAL = [
  { id: 'perfil', label: 'Perfil', tipo: TIPOS_DE_CAMPO.SELECT, opcionesDesde: 'perfiles', validacion: { requerido: true } },
  { id: 'rolEnJornada', label: 'Rol en la jornada', tipo: TIPOS_DE_CAMPO.SELECT, opciones: OPCIONES_ROL_EN_JORNADA, validacion: { requerido: true } },
  { id: 'horaInicio', label: 'Hora de inicio', tipo: TIPOS_DE_CAMPO.HORA, validacion: { requerido: true } },
  { id: 'horaFin', label: 'Hora de fin', tipo: TIPOS_DE_CAMPO.HORA, validacion: { requerido: true, mayorQueCampo: 'horaInicio' } },
  { id: 'responsabilidad', label: 'Responsabilidad', tipo: TIPOS_DE_CAMPO.TEXTO_LARGO, validacion: { requerido: false } },
];

/** Marcar la asistencia de un perfil ya asignado (jornada_personal.asistio, 00036). */
export const CAMPOS_MARCAR_ASISTENCIA = [
  { id: 'asistio', label: 'Asistio', tipo: TIPOS_DE_CAMPO.BOOLEANO, validacion: { requerido: false } },
];
