import { diasHastaVencimiento, formatearFechaCorta, aFechaLocal } from "../formato/fechas.js";

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
 * Un lote SIN fecha de vencimiento es un insumo que no vence (00171): se entrega. Solo un lote de
 * insumo puede no tenerla; a uno de medicamento la base se la exige. Uno con una fecha que no se
 * puede leer devuelve false: no se entrega algo cuya vigencia no se puede determinar.
 *
 * Esta validacion es de experiencia de usuario: la garantia real la da la base de datos
 * (fn_aplicar_ajuste_existencias, 00047, rechaza la salida de un lote vencido).
 *
 * @param {{ fechaVencimiento?: string }} lote Lote con su fecha de vencimiento.
 * @param {Date} [hoy] Fecha de referencia; se inyecta en las pruebas.
 * @returns {boolean}
 */
export function esLoteEntregable(lote, hoy = new Date()) {
  const fecha = fechaDeVencimientoDe(lote);
  if (!lote || esSinVencimiento(fecha)) return Boolean(lote);
  const dias = diasHastaVencimiento(fecha, hoy);
  if (dias === null) return false;
  return dias >= 0;
}

/** Sin fecha de vencimiento: null, undefined o cadena vacia. */
function esSinVencimiento(fecha) {
  return fecha === null || fecha === undefined || fecha === "";
}

/**
 * Comparador FEFO (First Expire, First Out) para Array#sort: primero el que vence antes, y al
 * final los lotes sin fecha, que no vencen (00171). Restar las dos fechas, como se hacia, da NaN
 * con un lote sin fecha y deja el orden en manos del motor.
 *
 * @param {string|null|undefined} fechaA Fecha de vencimiento AAAA-MM-DD, o nada.
 * @param {string|null|undefined} fechaB
 * @returns {number}
 */
export function compararPorVencimiento(fechaA, fechaB) {
  const a = aFechaLocal(fechaA);
  const b = aFechaLocal(fechaB);
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a - b;
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
  if (lote && esSinVencimiento(fecha)) return null;
  const dias = diasHastaVencimiento(fecha, hoy);

  if (dias === null) return "El lote no tiene una fecha de vencimiento valida.";
  if (dias >= 0) return null;
  return `El lote vencio el ${formatearFechaCorta(fecha)} y no se puede entregar.`;
}
/**
 * Evalúa los lotes de un medicamento y sugiere la asignación siguiendo la regla FEFO.
 *
 * @param {Array} lotes - Lista de lotes disponibles [{ id, fecha_vencimiento, cantidad_disponible }]
 * @param {number} cantidadSolicitada - Cantidad requerida
 * @param {Date|string} [fechaReferencia=new Date()] - Fecha base para evaluar vencimiento
 * @returns {Object} { lotesSugeridos, suficiente, cantidadFaltante }
 */
export function sugerirLote(lotes = [], cantidadSolicitada = 0, fechaReferencia = new Date()) {
  if (!Array.isArray(lotes) || cantidadSolicitada <= 0) {
    return {
      lotesSugeridos: [],
      suficiente: false,
      cantidadFaltante: Math.max(0, cantidadSolicitada),
    };
  }

  // Filtrar no vencidos con stock disponible y ordenar por vencimiento ascendente (FEFO).
  // esLoteEntregable() ya decide "vencido" correctamente (issue #694): antes esta funcion
  // reimplementaba el corte a mano con new Date(lote.fecha_vencimiento) >= hoy, que en
  // Guatemala (UTC-6) adelanta un dia cualquier cadena AAAA-MM-DD y hacia vencido un lote que
  // en realidad vencia hoy.
  const lotesValidos = lotes
    .filter(
      (lote) =>
        lote && esLoteEntregable(lote, fechaReferencia) && Number(lote.cantidad_disponible) > 0,
    )
    .sort((a, b) => compararPorVencimiento(a.fecha_vencimiento, b.fecha_vencimiento));

  let restante = cantidadSolicitada;
  const lotesSugeridos = [];

  for (const lote of lotesValidos) {
    if (restante <= 0) break;

    const disponible = Number(lote.cantidad_disponible);
    const cantidadAAsignar = Math.min(disponible, restante);

    lotesSugeridos.push({
      lote_id: lote.id,
      cantidad: cantidadAAsignar,
      fecha_vencimiento: lote.fecha_vencimiento,
    });

    restante -= cantidadAAsignar;
  }

  return {
    lotesSugeridos,
    suficiente: restante === 0,
    cantidadFaltante: restante > 0 ? restante : 0,
  };
}
