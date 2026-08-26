// Columnas de tabla y campos de tarjeta del modulo de jornadas. Mismo patron que
// packages/shared/pacientes/columnas.js.
//
// El kanban (KanbanBoard, ver docs/ARQUITECTURA-FRONTEND.md) no tiene su propio
// descriptor de columnas: agrupa las jornadas por estado (una columna del tablero por
// valor de estado_jornada) y cada tarjeta usa COLUMNAS_JORNADA igual que la fila de
// una tabla, via el mismo mecanismo de DataList/Card que ya interpreta 'principal'.

import { TIPOS_DE_PRESENTACION } from '../descriptores.js';

export const COLUMNAS_JORNADA = [
  { id: 'nombre', label: 'Nombre', tipo: TIPOS_DE_PRESENTACION.TEXTO, principal: true },
  { id: 'codigo', label: 'Codigo', tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: 'comunidad', label: 'Comunidad', tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: 'fecha', label: 'Fecha', tipo: TIPOS_DE_PRESENTACION.FECHA },
  { id: 'estado', label: 'Estado', tipo: TIPOS_DE_PRESENTACION.CHIP },
  { id: 'responsable', label: 'Responsable', tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: 'cupoEstimado', label: 'Cupo estimado', tipo: TIPOS_DE_PRESENTACION.NUMERO },
];

/** Personal asignado a una jornada (jornada_personal), dentro de su detalle. */
export const COLUMNAS_PERSONAL_JORNADA = [
  { id: 'perfil', label: 'Nombre', tipo: TIPOS_DE_PRESENTACION.TEXTO, principal: true },
  { id: 'rolEnJornada', label: 'Rol', tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: 'horaInicio', label: 'Hora inicio', tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: 'horaFin', label: 'Hora fin', tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: 'asistio', label: 'Asistio', tipo: TIPOS_DE_PRESENTACION.BOOLEANO },
];
