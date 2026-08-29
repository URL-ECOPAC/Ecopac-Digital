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

/**
 * Resultados de buscar personal para asignar a una jornada (issue #182).
 *
 * `nombreCompleto` y `rolEtiqueta` llegan ya resueltos en cada fila (armarFilaDeResultado(),
 * jornadas/useAsignacionPersonal.js): no se resuelven por catalogo, a diferencia de otras
 * columnas de este archivo que usan `etiquetasDesde`.
 */
export const COLUMNAS_RESULTADOS_ASIGNACION_PERSONAL = [
  { id: 'nombreCompleto', label: 'Nombre', tipo: TIPOS_DE_PRESENTACION.TEXTO, principal: true },
  { id: 'rolEtiqueta', label: 'Rol', tipo: TIPOS_DE_PRESENTACION.TEXTO },
];

/**
 * Pacientes atendidos en una jornada, con su diagnostico principal (issue #181, criterio 2).
 *
 * Solo tiene sentido pintarla para quien puedeVerHistorial() de pacientes/permisos.js (espejo
 * de la 00033, administrador o medico): para el resto la pantalla oculta la seccion entera en
 * vez de mostrar esta tabla vacia (ver useDetalleJornada.js).
 */
export const COLUMNAS_PACIENTES_ATENDIDOS_JORNADA = [
  { id: 'paciente', label: 'Paciente', tipo: TIPOS_DE_PRESENTACION.TEXTO, principal: true },
  {
    id: 'diagnosticoPrincipal',
    label: 'Diagnostico principal',
    tipo: TIPOS_DE_PRESENTACION.TEXTO,
  },
];

/**
 * Historial de cambios de estado de una jornada (issue #181, criterio 3: "con quien y cuando").
 *
 * Solo tiene sentido pintarla para quien puedeVerHistorialJornada() de permisos.js (espejo de
 * la 00039:83-85, solo administrador): para el resto la pantalla oculta la seccion entera en vez
 * de mostrar esta tabla vacia (ver useDetalleJornada.js).
 *
 * `estadoAnterior`/`estadoNuevo` usan el mismo tipo CHIP que 'estado' en COLUMNAS_JORNADA: son
 * el valor crudo del enum estado_jornada, que StatusChip indexa directo contra las variables
 * --estado-* (mismo color que ya usa el tablero). La fila de creacion de la jornada trae
 * `estadoAnterior` nulo -StatusChip ya sabe pintar nada en ese caso (Chip.jsx:20)-, no un texto
 * inventado como "Creacion".
 *
 * `cambiadoPor` y `cuando` llegan pre-formateados por el hook (nombre completo del perfil,
 * formatearFechaConHora()) porque DataList no tiene un tipo de columna para fecha-con-hora
 * (solo TIPOS_DE_PRESENTACION.FECHA, sin hora) y este descriptor no puede ampliar ese catalogo.
 */
export const COLUMNAS_HISTORIAL_JORNADA = [
  { id: 'estadoAnterior', label: 'Estado anterior', tipo: TIPOS_DE_PRESENTACION.CHIP },
  { id: 'estadoNuevo', label: 'Estado nuevo', tipo: TIPOS_DE_PRESENTACION.CHIP, principal: true },
  { id: 'cambiadoPor', label: 'Quien', tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: 'cuando', label: 'Cuando', tipo: TIPOS_DE_PRESENTACION.TEXTO },
];
