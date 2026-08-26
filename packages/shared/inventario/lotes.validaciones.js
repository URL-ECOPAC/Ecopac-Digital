import { diasHastaVencimiento, formatearFechaCorta } from "../formato/fechas.js";

function fechaDeVencimientoDe(lote) {
  if (!lote) return null;
  return lote.fechaVencimiento ?? lote.fecha_vencimiento ?? null;
}

/**
 * Indica si un lote se puede entregar segun su fecha de vencimiento.
 *
 * Un lote que vence hoy SI es entregable; uno que vencio ayer no. Es el mismo corte que aplica
 * la vista vista_lotes_disponibles (00047) con `fecha_vencimiento >= CURRENT_DATE`, y el mismo
 * que usa el campo `vencido` de lotes.api.js, para que la pantalla y el servidor nunca
 * discrepen sobre el mismo lote.
 *
 * Un lote sin fecha de vencimiento legible devuelve false. La columna es NOT NULL desde la
 * 00020, asi que no deberia ocurrir; si ocurre, no se entrega un medicamento cuya vigencia no
 * se puede determinar.
 *
 * Esta validacion es de experiencia de usuario: la garantia real la da la base de datos
 * (fn_aplicar_ajuste_existencias, 00047, rechaza la salida de un lote vencido).
 *
 * @param {{ fechaVencimiento?: string }} lote Lote con su fecha de vencimiento.
 * @param {Date} [hoy] Fecha de referencia; se inyecta en las pruebas.
 * @returns {boolean}
 */
export function esLoteEntregable(lote, hoy = new Date()) {
  const dias = diasHastaVencimiento(fechaDeVencimientoDe(lote), hoy);
  if (dias === null) return false;
  return dias >= 0;
}

/**
 * Mensaje que explica por que un lote no se puede entregar, o null si si se puede.
 *
 * Existe aparte de esLoteEntregable() porque el criterio de aceptacion pide un booleano, pero
 * la regla del repositorio prohibe devolver solo un booleano en una validacion: sin un mensaje
 * compartido, web y movil escribirian textos distintos para el mismo caso.
 *
 * @param {{ fechaVencimiento?: string }} lote
 * @param {Date} [hoy]
 * @returns {string|null}
 */
export function motivoLoteNoEntregable(lote, hoy = new Date()) {
  const fecha = fechaDeVencimientoDe(lote);
  const dias = diasHastaVencimiento(fecha, hoy);

  if (dias === null) return "El lote no tiene una fecha de vencimiento valida.";
  if (dias >= 0) return null;
  return `El lote vencio el ${formatearFechaCorta(fecha)} y no se puede entregar.`;
}
