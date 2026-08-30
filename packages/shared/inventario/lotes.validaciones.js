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

  const hoy = new Date(fechaReferencia);
  hoy.setHours(0, 0, 0, 0);

  // Filtrar no vencidos con stock disponible y ordenar por vencimiento ascendente (FEFO)
  const lotesValidos = lotes
    .filter((lote) => {
      if (!lote || !lote.fecha_vencimiento) return false;
      const fechaVenc = new Date(lote.fecha_vencimiento);
      return fechaVenc >= hoy && Number(lote.cantidad_disponible) > 0;
    })
    .sort((a, b) => new Date(a.fecha_vencimiento) - new Date(b.fecha_vencimiento));

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
