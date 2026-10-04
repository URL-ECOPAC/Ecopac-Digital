// Estados de una cita (issue #927). Espejo del enum estado_cita de la 00184 y de sus transiciones
// en fn_validar_cita: el cliente las usa para decidir que botones dibuja, la base las hace cumplir.
//
// El color del StatusChip sale de statusColors de @ecopac/ui-tokens, indexado por el valor del enum
// (`creada`, `en_atencion`, `atendida`, `cancelada`).

import { opcionesDe } from "../enums.js";

export const ESTADOS_CITA = Object.freeze({
  CREADA: "creada",
  EN_ATENCION: "en_atencion",
  ATENDIDA: "atendida",
  CANCELADA: "cancelada",
});

/** En pantalla, como pide la issue: Creado, En atencion, Atendido, Cancelado. */
export const ETIQUETAS_ESTADO_CITA = Object.freeze({
  [ESTADOS_CITA.CREADA]: "Creado",
  [ESTADOS_CITA.EN_ATENCION]: "En atención",
  [ESTADOS_CITA.ATENDIDA]: "Atendido",
  [ESTADOS_CITA.CANCELADA]: "Cancelado",
});

export const OPCIONES_ESTADO_CITA = opcionesDe(ESTADOS_CITA, ETIQUETAS_ESTADO_CITA);

/**
 * A que estados se puede pasar a mano desde cada uno. `atendida` no esta: la pone la consulta al
 * guardarse (fn_consulta_de_cita_despues), nunca un boton.
 */
export const TRANSICIONES_CITA = Object.freeze({
  [ESTADOS_CITA.CREADA]: Object.freeze([ESTADOS_CITA.EN_ATENCION, ESTADOS_CITA.CANCELADA]),
  [ESTADOS_CITA.EN_ATENCION]: Object.freeze([ESTADOS_CITA.CREADA, ESTADOS_CITA.CANCELADA]),
  [ESTADOS_CITA.ATENDIDA]: Object.freeze([]),
  [ESTADOS_CITA.CANCELADA]: Object.freeze([]),
});

/**
 * @param {string} desde
 * @param {string} hacia
 * @returns {boolean}
 */
export function puedePasarCitaA(desde, hacia) {
  return (TRANSICIONES_CITA[desde] ?? []).includes(hacia);
}

/**
 * Una cita que todavia ocupa sala: la cancelada la libera.
 *
 * @param {{ estado: string }|null} cita
 * @returns {boolean}
 */
export function citaOcupaSala(cita) {
  return Boolean(cita) && cita.estado !== ESTADOS_CITA.CANCELADA;
}

/**
 * Solo una cita creada se reagenda; atendida y cancelada solo cambian sus notas.
 *
 * @param {{ estado: string }|null} cita
 * @returns {boolean}
 */
export function citaSeReagenda(cita) {
  return cita?.estado === ESTADOS_CITA.CREADA;
}

/**
 * Pendiente para el cierre de la jornada: creada o en atencion.
 *
 * @param {{ estado: string }|null} cita
 * @returns {boolean}
 */
export function citaPendiente(cita) {
  return cita?.estado === ESTADOS_CITA.CREADA || cita?.estado === ESTADOS_CITA.EN_ATENCION;
}

/**
 * @param {string} estado
 * @returns {string}
 */
export function etiquetaDeEstadoDeCita(estado) {
  return ETIQUETAS_ESTADO_CITA[estado] ?? estado ?? "";
}
