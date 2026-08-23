// Columnas de tabla y campos de tarjeta del modulo de jornadas. Mismo patron que
// packages/shared/pacientes/columnas.js.
//
// El kanban (KanbanBoard, ver docs/ARQUITECTURA-FRONTEND.md) no tiene su propio
// descriptor de columnas: agrupa las jornadas por estado (una columna del tablero por
// valor de estado_jornada) y cada tarjeta usa COLUMNAS_JORNADA igual que la fila de
// una tabla, via el mismo mecanismo de DataList/Card que ya interpreta 'principal'.

export const COLUMNAS_JORNADA = [
  { id: 'nombre', label: 'Nombre', tipo: 'texto', principal: true },
  { id: 'codigo', label: 'Codigo', tipo: 'texto' },
  { id: 'comunidad', label: 'Comunidad', tipo: 'texto' },
  { id: 'fecha', label: 'Fecha', tipo: 'fecha' },
  { id: 'estado', label: 'Estado', tipo: 'chip' },
  { id: 'responsable', label: 'Responsable', tipo: 'texto' },
  { id: 'cupoEstimado', label: 'Cupo estimado', tipo: 'numero' },
];

/** Personal asignado a una jornada (jornada_personal), dentro de su detalle. */
export const COLUMNAS_PERSONAL_JORNADA = [
  { id: 'perfil', label: 'Nombre', tipo: 'texto', principal: true },
  { id: 'rolEnJornada', label: 'Rol', tipo: 'texto' },
  { id: 'horaInicio', label: 'Hora inicio', tipo: 'texto' },
  { id: 'horaFin', label: 'Hora fin', tipo: 'texto' },
  { id: 'asistio', label: 'Asistio', tipo: 'booleano' },
];
