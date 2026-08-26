import { esLoteEntregable, motivoLoteNoEntregable } from "./lotes.validaciones.js";

function aCantidad(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

/**
 * Indica si se puede sacar la cantidad solicitada de un lote en una bodega.
 *
 * Comprueba tres cosas, en este orden: que el lote no este vencido, que la cantidad solicitada
 * sea un numero mayor que cero, y que no supere la existencia disponible. Pedir exactamente lo
 * que hay SI es valido: el lote queda en cero, no en negativo.
 *
 * Esta validacion es de experiencia de usuario. La garantia real la da la base de datos:
 * fn_aplicar_ajuste_existencias (00047) rechaza la salida si el stock no alcanza o si el lote
 * vencio, y existencias tiene el CHECK de cantidad no negativa (00020).
 *
 * @param {object} entrada
 * @param {{ fechaVencimiento?: string }} entrada.lote Lote del que se quiere sacar.
 * @param {number} entrada.cantidadDisponible Existencia del lote en esa bodega.
 * @param {number} entrada.cantidadSolicitada Cantidad que se quiere sacar.
 * @param {Date} [hoy] Fecha de referencia; se inyecta en las pruebas.
 * @returns {boolean}
 */
export function hayDisponibilidad(
  { lote, cantidadDisponible, cantidadSolicitada } = {},
  hoy = new Date(),
) {
  if (!esLoteEntregable(lote, hoy)) return false;

  const solicitada = aCantidad(cantidadSolicitada);
  const disponible = aCantidad(cantidadDisponible);

  if (solicitada === null || solicitada <= 0) return false;
  if (disponible === null || disponible < 0) return false;

  return solicitada <= disponible;
}

/**
 * Mensaje que explica por que no se puede sacar la cantidad solicitada, o null si si se puede.
 *
 * Cuando el problema es de existencia, el mensaje dice cuanto hay realmente, que es el criterio
 * de aceptacion de la issue: un "no hay suficiente" a secas obliga a la persona a adivinar.
 *
 * @param {object} entrada Los mismos campos que hayDisponibilidad().
 * @param {Date} [hoy]
 * @returns {string|null}
 */
export function motivoSinDisponibilidad(
  { lote, cantidadDisponible, cantidadSolicitada } = {},
  hoy = new Date(),
) {
  const motivoDelLote = motivoLoteNoEntregable(lote, hoy);
  if (motivoDelLote) return motivoDelLote;

  const solicitada = aCantidad(cantidadSolicitada);
  const disponible = aCantidad(cantidadDisponible);

  if (solicitada === null || solicitada <= 0) {
    return "La cantidad a entregar debe ser mayor que cero.";
  }
  if (disponible === null || disponible < 0) {
    return "No se pudo determinar la existencia disponible del lote.";
  }
  if (solicitada > disponible) {
    return `Solo hay ${disponible} disponibles de este lote y se solicitaron ${solicitada}.`;
  }
  return null;
}
