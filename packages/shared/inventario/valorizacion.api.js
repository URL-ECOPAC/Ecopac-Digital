import { obtenerSupabase } from "../api/cliente.js";
import { normalizarError } from "../api/errores-de-supabase.js";

function aFilaDeValorizacion(fila) {
  return {
    bodegaId: fila.bodega_id,
    bodega: fila.bodega,
    medicamentoId: fila.medicamento_id,
    medicamento: fila.medicamento,
    origen: fila.origen,
    cantidadDisponible: Number(fila.cantidad_disponible ?? 0),
    valorDisponible: fila.valor_disponible === null ? null : Number(fila.valor_disponible),
    unidadesSinCosto: Number(fila.unidades_sin_costo ?? 0),
    lotesSinCosto: Number(fila.lotes_sin_costo ?? 0),
  };
}

/**
 * Suma los totales de un conjunto de filas de valorizacion: el valor conocido, las unidades sin
 * costo y los lotes sin costo. Se exporta aparte de obtenerValorDeInventario() para que quien
 * consuma la lista (el reporte de inventario, el panel de indicadores) no tenga que reimplementar
 * la misma suma, y para poder probarla sin tocar la base.
 *
 * valorDisponible se suma solo entre filas que si tienen valor conocido (no null); si ninguna
 * fila tiene costo conocido, el total tambien es null -- no cero, que mentiria igual que en la
 * base (00121/00122).
 *
 * @param {ReturnType<typeof aFilaDeValorizacion>[]} filas
 */
export function totalizarValorizacion(filas = []) {
  const conCosto = filas.filter((fila) => fila.valorDisponible !== null);

  return {
    valorDisponible:
      conCosto.length === 0
        ? null
        : conCosto.reduce((total, fila) => total + fila.valorDisponible, 0),
    unidadesSinCosto: filas.reduce((total, fila) => total + fila.unidadesSinCosto, 0),
    lotesSinCosto: filas.reduce((total, fila) => total + fila.lotesSinCosto, 0),
  };
}

/**
 * Desglosa el valor del inventario por origen (compra vs donacion, issue #752): es lo que sirve
 * para presentar a cooperantes cuanto del inventario disponible vino de una donacion. Cada fila
 * de origen se totaliza con la misma regla que totalizarValorizacion() -- null y no cero cuando
 * ese origen no tiene ninguna fila con costo conocido--, para no mentir por partes igual que no
 * se miente en el total.
 *
 * Se exporta aparte de obtenerValorDeInventario() por el mismo motivo que totalizarValorizacion():
 * para que el reporte de inventario pueda probarse sin tocar la base.
 *
 * @param {ReturnType<typeof aFilaDeValorizacion>[]} filas
 * @returns {{ origen: string, valorDisponible: number|null, unidadesSinCosto: number,
 *   lotesSinCosto: number }[]} Ordenado por origen, para que la pantalla no dependa del orden en
 *   que la base devolvio las filas.
 */
export function desglosarValorizacionPorOrigen(filas = []) {
  const porOrigen = new Map();

  for (const fila of filas) {
    const grupo = porOrigen.get(fila.origen) ?? [];
    grupo.push(fila);
    porOrigen.set(fila.origen, grupo);
  }

  return Array.from(porOrigen.entries())
    .map(([origen, filasDelOrigen]) => ({ origen, ...totalizarValorizacion(filasDelOrigen) }))
    .sort((a, b) => a.origen.localeCompare(b.origen));
}

/**
 * Valor monetario del inventario disponible, agregado por bodega, medicamento y origen (issue
 * #752). Llama a fn_valor_de_inventario_disponible (00122), que es SECURITY DEFINER y comprueba
 * el rol ella misma: solo administrador y los roles consultivos reciben filas, cualquier otro
 * rol recibe el error de permiso de la funcion, normalizado igual que cualquier otro error de la
 * base. `permisos.js` (puedeVerValorizacion) es el reflejo de esa misma regla para que la
 * interfaz no dispare esta llamada sabiendo que va a fallar.
 *
 * @param {{ bodega?: string }} [opciones] UUID de bodega; si se omite, suma todas.
 * @returns {Promise<{ valorizacion: object[], error: object|null }>}
 */
export async function obtenerValorDeInventario({ bodega } = {}) {
  try {
    const { data, error } = await obtenerSupabase().rpc("fn_valor_de_inventario_disponible", {
      p_bodega_id: bodega || null,
    });

    if (error) return { valorizacion: [], error: normalizarError(error) };
    return { valorizacion: (data ?? []).map(aFilaDeValorizacion), error: null };
  } catch (error) {
    return { valorizacion: [], error: normalizarError(error) };
  }
}
