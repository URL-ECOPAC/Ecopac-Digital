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
  // Issue #178, criterio 1. No sale de listarJornadas(): se mezcla en el hook de pantalla desde
  // contarPacientesAtendidosPorJornada() (api.js), que consulta vista_reporte_impacto en lote.
  // Esa vista no da SELECT a medico ni voluntario (00064): para esos roles la tarjeta no trae
  // esta clave, y la pantalla pinta un guion en vez de inventar un 0 que afirmaria una atencion
  // nula que no se puede confirmar.
  { id: 'pacientesAtendidos', label: 'Pacientes atendidos', tipo: TIPOS_DE_PRESENTACION.NUMERO },
];

// `codigo` y `cupoEstimado` quedan arriba para quien mas los necesite (por ejemplo el detalle de
// una jornada), pero el tablero de #178 no los pinta: el criterio 1 de esa issue solo pide
// nombre, fecha, comunidad, responsable, estado y pacientesAtendidos. JornadasPage.jsx elige esas
// seis claves a mano en vez de recorrer COLUMNAS_JORNADA completo.

/** Personal asignado a una jornada (jornada_personal), dentro de su detalle. */
export const COLUMNAS_PERSONAL_JORNADA = [
  { id: 'perfil', label: 'Nombre', tipo: TIPOS_DE_PRESENTACION.TEXTO, principal: true },
  { id: 'rolEnJornada', label: 'Rol', tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: 'horaInicio', label: 'Hora inicio', tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: 'horaFin', label: 'Hora fin', tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: 'asistio', label: 'Asistio', tipo: TIPOS_DE_PRESENTACION.BOOLEANO },
];
