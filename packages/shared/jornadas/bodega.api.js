// La bodega movil de una jornada (00178): cargarla desde otra bodega y ver lo que consumio.
//
// Toda jornada lleva una bodega movil (jornadas.botiquin_bodega_id). Lo que se lleva a la jornada
// se carga a ella desde la pestana Insumos -un traslado de un lote desde otra bodega, normalmente
// la principal-, y de ella salen los medicamentos que se recetan en la jornada (00176).
//
// Todas devuelven `{ ..., error }` en vez de lanzar.

import { obtenerSupabase } from "../api/cliente.js";
import { normalizarError } from "../api/errores-de-supabase.js";

/** Redondeo a centavos: cantidad x costo puede arrastrar cola binaria (3 x 0.1). */
function aCentavos(valor) {
  return Math.round(valor * 100) / 100;
}

/**
 * Traslada `cantidad` de un lote desde `bodegaOrigenId` a la bodega movil de la jornada
 * (fn_cargar_insumo_a_bodega_de_jornada, 00178): un ingreso y una salida aprobados en una sola
 * transaccion. Solo la administradora; la base comprueba ademas que la jornada no este finalizada,
 * que el lote no este vencido y que haya existencia en el origen.
 *
 * @param {{ jornadaId: string, loteId: string, bodegaOrigenId: string,
 *   cantidad: number|string }} datos
 * @returns {Promise<{ ingresoId: string|null, error: object|null }>}
 */
export async function cargarInsumoABodegaDeJornada({
  jornadaId,
  loteId,
  bodegaOrigenId,
  cantidad,
} = {}) {
  if (!jornadaId || !loteId || !bodegaOrigenId) return { ingresoId: null, error: null };

  try {
    const { data, error } = await obtenerSupabase().rpc("fn_cargar_insumo_a_bodega_de_jornada", {
      p_jornada_id: jornadaId,
      p_lote_id: loteId,
      p_bodega_origen_id: bodegaOrigenId,
      p_cantidad: Number(cantidad),
    });

    if (error) return { ingresoId: null, error: normalizarError(error) };
    return { ingresoId: data ?? null, error: null };
  } catch (error) {
    return { ingresoId: null, error: normalizarError(error) };
  }
}

/**
 * Una fila de fn_consumo_de_insumos_de_jornada con sus valores. Un costo desconocido deja los
 * valores en null: "no se sabe" no es cero. Pura y exportada para probarla sin Supabase.
 *
 * @param {object} fila
 * @returns {object} Con: loteId, medicamentoId, articulo, numeroLote, fechaVencimiento,
 *   costoUnitario, cargado, entregado, enBodega, valorCargado, valorEntregado, valorEnBodega.
 */
export function aConsumoDeLote(fila) {
  const tieneCosto = fila.costo_unitario !== null && fila.costo_unitario !== undefined;
  const costo = tieneCosto ? Number(fila.costo_unitario) : null;
  const cargado = Number(fila.cargado ?? 0);
  const entregado = Number(fila.entregado ?? 0);
  const enBodega = Number(fila.en_bodega ?? 0);
  const valorDe = (cantidad) => (tieneCosto ? aCentavos(costo * cantidad) : null);

  return {
    loteId: fila.lote_id,
    medicamentoId: fila.medicamento_id,
    articulo: fila.concentracion ? `${fila.articulo} (${fila.concentracion})` : fila.articulo,
    numeroLote: fila.numero_lote ?? null,
    fechaVencimiento: fila.fecha_vencimiento ?? null,
    costoUnitario: costo,
    cargado,
    entregado,
    enBodega,
    valorCargado: valorDe(cargado),
    valorEntregado: valorDe(entregado),
    valorEnBodega: valorDe(enBodega),
  };
}

/**
 * Totales del consumo de una jornada: el valor cargado, el entregado y el que queda en la bodega,
 * sumando solo lo que tiene costo, y cuantos lotes no lo tienen.
 *
 * @param {ReturnType<typeof aConsumoDeLote>[]} consumo
 * @returns {{ valorCargado: number, valorEntregado: number, valorEnBodega: number,
 *   unidadesEntregadas: number, lotesSinCosto: number }}
 */
export function resumirConsumoDeJornada(consumo = []) {
  const suma = (clave) => aCentavos(consumo.reduce((total, fila) => total + (fila[clave] ?? 0), 0));
  return {
    valorCargado: suma("valorCargado"),
    valorEntregado: suma("valorEntregado"),
    valorEnBodega: suma("valorEnBodega"),
    unidadesEntregadas: consumo.reduce((total, fila) => total + fila.entregado, 0),
    lotesSinCosto: consumo.filter((fila) => fila.costoUnitario === null).length,
  };
}

/**
 * Lo que consumio una jornada, lote por lote (fn_consumo_de_insumos_de_jornada, 00178): lo cargado
 * a su bodega movil, lo entregado en sus recetas y lo que queda en la bodega.
 *
 * @param {string} jornadaId UUID de la jornada.
 * @returns {Promise<{ consumo: object[], error: object|null }>}
 */
export async function listarConsumoDeInsumosDeJornada(jornadaId) {
  if (!jornadaId) return { consumo: [], error: null };

  try {
    const { data, error } = await obtenerSupabase().rpc("fn_consumo_de_insumos_de_jornada", {
      p_jornada_id: jornadaId,
    });

    if (error) return { consumo: [], error: normalizarError(error) };
    return { consumo: (data ?? []).map(aConsumoDeLote), error: null };
  } catch (error) {
    return { consumo: [], error: normalizarError(error) };
  }
}
