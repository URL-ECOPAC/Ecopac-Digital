// La bodega de una jornada (00178): cargarla desde otra bodega y ver lo que consumio.
//
// Toda jornada lleva una bodega (jornadas.botiquin_bodega_id). Si es movil, lo que se lleva a la
// jornada se carga a ella desde la pestana Insumos -un traslado de un lote desde otra bodega,
// normalmente la principal-, y de ella salen los medicamentos que se recetan en la jornada (00176).
// Desde la 00181 tambien puede ser la bodega principal: entrega directo, no se carga ni se devuelve,
// y su consumo es solo lo entregado.
//
// Todas devuelven `{ ..., error }` en vez de lanzar.

import { obtenerSupabase } from "../api/cliente.js";
import { normalizarError, normalizarErrorConReglas } from "../api/errores-de-supabase.js";
import { ESTADOS_JORNADA, ESTADOS_PROYECTO } from "../enums.js";
import { REGLAS_DE_RECHAZO_DE_INVENTARIO } from "../inventario/rechazos.js";

/**
 * La jornada entrega directo de la bodega principal (00181): no se carga ni se devuelve, y su
 * consumo es solo lo entregado. Lee el embebido `botiquinBodega` que trae obtenerJornada().
 *
 * @param {{ botiquinBodegaId?: string|null, botiquinBodega?: { esPrincipal?: boolean }|null }} jornada
 * @returns {boolean}
 */
export function jornadaUsaBodegaPrincipal(jornada) {
  return Boolean(jornada?.botiquinBodegaId && jornada?.botiquinBodega?.esPrincipal);
}

/**
 * Por que no se puede cargar la bodega de la jornada, o null si se puede. Es lo mismo que comprueba
 * fn_cargar_insumo_a_bodega_de_jornada (00181/00186), dicho antes de abrir el formulario: antes el
 * boton quedaba habilitado con el proyecto cancelado y el rechazo llegaba al guardar (issue #925).
 *
 * @param {{ estado?: string, proyecto?: { estado?: string }|null }} jornada
 * @returns {string|null}
 */
export function motivoParaNoCargarBodega(jornada) {
  if (jornada?.estado === ESTADOS_JORNADA.FINALIZADA) {
    return "La jornada ya finalizó: su bodega ya no se carga. Lo que sobra se puede devolver.";
  }
  const estadoProyecto = jornada?.proyecto?.estado;
  if (
    estadoProyecto === ESTADOS_PROYECTO.CANCELADO ||
    estadoProyecto === ESTADOS_PROYECTO.FINALIZADO
  ) {
    return `El proyecto está ${estadoProyecto}: ya no se puede modificar su inventario.`;
  }
  return null;
}

/**
 * A la jornada todavia le queda algo en su bodega movil: un lote con `queda` (cargado - entregado
 * - devuelto) mayor que cero. Espejo de trg_jornadas_sin_inventario_cargado_al_cambiar_bodega
 * (00181, con `queda` desde la 00186), que impide cambiar de bodega en ese caso.
 *
 * @param {Array<{ queda: number }>} consumo Filas de listarConsumoDeInsumosDeJornada().
 * @returns {boolean}
 */
export function tieneInventarioCargado(consumo = []) {
  return consumo.some((fila) => fila.queda > 0);
}

/**
 * Por que no se puede cambiar la bodega de la jornada (00181).
 *
 * @param {string} [bodega] Nombre de la bodega actual.
 * @returns {string}
 */
export function mensajeDeInventarioCargado(bodega) {
  return (
    `La bodega ${bodega ? `«${bodega}» ` : ""}todavía tiene inventario cargado para esta ` +
    "jornada. Devuélvelo desde la pestaña Insumos antes de cambiar de bodega."
  );
}

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

    if (error) {
      return {
        ingresoId: null,
        error: normalizarErrorConReglas(error, REGLAS_DE_RECHAZO_DE_INVENTARIO),
      };
    }
    return { ingresoId: data ?? null, error: null };
  } catch (error) {
    return { ingresoId: null, error: normalizarError(error) };
  }
}

/**
 * Devuelve `cantidad` de un lote de la bodega movil de la jornada a una bodega fija
 * (fn_devolver_de_bodega_de_jornada, 00179). Es lo que sobra al terminar la jornada; se puede con la
 * jornada finalizada. Solo la administradora, y desde la 00186 solo hasta lo que le queda a la
 * jornada de ese lote: lo que hay en la bodega y es de otra jornada se devuelve desde esa.
 *
 * @param {{ jornadaId: string, loteId: string, bodegaDestinoId: string,
 *   cantidad: number|string }} datos
 * @returns {Promise<{ ingresoId: string|null, error: object|null }>}
 */
export async function devolverDeBodegaDeJornada({
  jornadaId,
  loteId,
  bodegaDestinoId,
  cantidad,
} = {}) {
  if (!jornadaId || !loteId || !bodegaDestinoId) return { ingresoId: null, error: null };

  try {
    const { data, error } = await obtenerSupabase().rpc("fn_devolver_de_bodega_de_jornada", {
      p_jornada_id: jornadaId,
      p_lote_id: loteId,
      p_bodega_destino_id: bodegaDestinoId,
      p_cantidad: Number(cantidad),
    });

    if (error) {
      return {
        ingresoId: null,
        error: normalizarErrorConReglas(error, REGLAS_DE_RECHAZO_DE_INVENTARIO),
      };
    }
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
 * `queda` es lo que le queda a la jornada (cargado - entregado - devuelto, 00186) y `enBodega` lo
 * que hay hoy en toda la bodega. `deOtros` es lo de la bodega que no es de esta jornada ni espera
 * aprobacion: sobrante de otra jornada o lo que entro sin jornada.
 *
 * @returns {object} Con: loteId, medicamentoId, articulo, numeroLote, fechaVencimiento,
 *   costoUnitario, cargado, entregado, devuelto, enBodega, pendiente, queda, deOtros,
 *   valorCargado, valorEntregado, valorDevuelto, valorEnBodega, valorQueda.
 */
export function aConsumoDeLote(fila) {
  const tieneCosto = fila.costo_unitario !== null && fila.costo_unitario !== undefined;
  const costo = tieneCosto ? Number(fila.costo_unitario) : null;
  const cargado = Number(fila.cargado ?? 0);
  const entregado = Number(fila.entregado ?? 0);
  const devuelto = Number(fila.devuelto ?? 0);
  const enBodega = Number(fila.en_bodega ?? 0);
  const pendiente = Number(fila.pendiente ?? 0);
  const queda = Number(fila.queda ?? 0);
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
    devuelto,
    enBodega,
    pendiente,
    queda,
    deOtros: Math.max(0, enBodega - Math.max(queda, 0) - pendiente),
    valorCargado: valorDe(cargado),
    valorEntregado: valorDe(entregado),
    valorDevuelto: valorDe(devuelto),
    valorEnBodega: valorDe(enBodega),
    valorQueda: valorDe(Math.max(queda, 0)),
  };
}

/**
 * Totales del consumo de una jornada: el valor cargado, el entregado, el devuelto y el que le
 * queda a la jornada, sumando solo lo que tiene costo, y cuantos lotes no lo tienen. Ademas las
 * unidades que esperan aprobacion y las que hay en la bodega sin ser de esta jornada.
 *
 * @param {ReturnType<typeof aConsumoDeLote>[]} consumo
 * @returns {{ valorCargado: number, valorEntregado: number, valorDevuelto: number,
 *   valorEnBodega: number, valorQueda: number, unidadesEntregadas: number,
 *   unidadesPendientes: number, unidadesDeOtros: number, lotesSinCosto: number }}
 */
export function resumirConsumoDeJornada(consumo = []) {
  const suma = (clave) => aCentavos(consumo.reduce((total, fila) => total + (fila[clave] ?? 0), 0));
  return {
    valorCargado: suma("valorCargado"),
    valorEntregado: suma("valorEntregado"),
    valorDevuelto: suma("valorDevuelto"),
    valorEnBodega: suma("valorEnBodega"),
    valorQueda: suma("valorQueda"),
    unidadesEntregadas: consumo.reduce((total, fila) => total + fila.entregado, 0),
    unidadesPendientes: consumo.reduce((total, fila) => total + (fila.pendiente ?? 0), 0),
    unidadesDeOtros: consumo.reduce((total, fila) => total + (fila.deOtros ?? 0), 0),
    lotesSinCosto: consumo.filter((fila) => fila.costoUnitario === null).length,
  };
}

/**
 * Lo que consumio una jornada, lote por lote (fn_consumo_de_insumos_de_jornada, 00178): lo cargado
 * a su bodega movil, lo entregado en sus recetas, lo devuelto (00179), lo que espera aprobacion y
 * lo que le queda a la jornada (00186).
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
