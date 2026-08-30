import { obtenerSupabase } from "../api/cliente.js";
import { normalizarError } from "../api/errores-de-supabase.js";

export const LIMITE_DE_EXISTENCIAS_POR_DEFECTO = 50;

function aExistencia(fila) {
  if (!fila) return null;

  return {
    medicamentoId: fila.medicamento_id,
    medicamento: fila.medicamento,
    concentracion: fila.concentracion,
    presentacion: fila.presentacion,
    marca: fila.marca,
    componentes: fila.componentes ?? [],
    cantidadDisponible: fila.cantidad_disponible,
    fechaVencimientoProxima: fila.fecha_vencimiento_proxima,
    lotesDisponibles: fila.lotes_disponibles,
  };
}

/**
 * Inventario disponible agregado por medicamento, para que el medico sepa que puede recetar
 * antes de recetarlo (RF-18).
 *
 * Llama por RPC a fn_existencias_disponibles (00065), que agrupa en la base: la suma por
 * medicamento y la fecha de vencimiento mas proxima no se pueden pedir por PostgREST, y
 * agregarlas aqui obligaria a traer el catalogo entero antes de paginar.
 *
 * Los lotes vencidos no se cuentan: la funcion se apoya en vista_lotes_disponibles (00047),
 * que los excluye. Como es una vista y no una tabla materializada, un movimiento recien
 * aprobado se refleja en la siguiente llamada sin cache intermedio.
 *
 * @param {object} [filtros]
 * @param {string} [filtros.bodega] UUID de bodega; si se omite, suma todas.
 * @param {string} [filtros.busqueda] Texto libre contra nombre, marca, concentracion y
 *   principio activo, sin distinguir acentos.
 * @param {number} [filtros.limite=50] Filas por pagina.
 * @param {number} [filtros.pagina=1] Numero de pagina, empezando en 1.
 * @returns {Promise<{ existencias: object[], total: number, error: object|null }>} `total` es
 *   la cantidad de medicamentos que cumplen el filtro, sin paginar.
 */
export async function consultarExistencias({
  bodega,
  busqueda,
  limite = LIMITE_DE_EXISTENCIAS_POR_DEFECTO,
  pagina = 1,
} = {}) {
  const filas = Math.max(1, Number(limite) || LIMITE_DE_EXISTENCIAS_POR_DEFECTO);
  const numeroDePagina = Math.max(1, Number(pagina) || 1);

  try {
    const { data, error } = await obtenerSupabase().rpc("fn_existencias_disponibles", {
      p_bodega_id: bodega || null,
      p_busqueda: busqueda || null,
      p_limite: filas,
      p_desplazamiento: (numeroDePagina - 1) * filas,
    });

    if (error) return { existencias: [], total: 0, error: normalizarError(error) };

    const resultado = data ?? [];
    return {
      existencias: resultado.map(aExistencia),
      total: Number(resultado[0]?.total_medicamentos ?? 0),
      error: null,
    };
  } catch (error) {
    return { existencias: [], total: 0, error: normalizarError(error) };
  }
}

/**
 * Existencias disponibles de una bodega concreta. Azucar sobre consultarExistencias({ bodega }):
 * es la consulta que arma la pantalla de inventario de una jornada, no un listado con filtros.
 *
 * @param {string} bodegaId UUID de la bodega.
 * @param {{ busqueda?: string, limite?: number, pagina?: number }} [opciones]
 * @returns {Promise<{ existencias: object[], total: number, error: object|null }>}
 */
export function consultarExistenciasDeBodega(bodegaId, opciones = {}) {
  if (!bodegaId) return Promise.resolve({ existencias: [], total: 0, error: null });
  return consultarExistencias({ ...opciones, bodega: bodegaId });
}

/**
 * Lotes concretos con existencia de un medicamento, con su bodega.
 *
 * consultarExistencias() agrega por medicamento y devuelve `lotesDisponibles` como un CONTEO,
 * no como una lista: sirve para buscar, no para recetar. Para generar una receta hace falta el
 * lote y la bodega concretos (issue #138), que es lo que devuelve esta funcion.
 *
 * La vista ya excluye lo vencido y lo que esta en cero (00047), asi que todo lo que vuelve de
 * aqui se puede entregar.
 *
 * @param {string} medicamentoId
 * @param {{ bodega?: string }} [opciones]
 * @returns {Promise<{ lotes: object[], error: object|null }>}
 */
export async function consultarLotesDisponibles(medicamentoId, { bodega } = {}) {
  if (!medicamentoId) return { lotes: [], error: null };

  try {
    let consulta = obtenerSupabase()
      .from("vista_lotes_disponibles")
      .select(
        "loteId:lote_id, medicamentoId:medicamento_id, numeroLote:numero_lote, fechaVencimiento:fecha_vencimiento, cantidadDisponible:cantidad_disponible, bodegaId:bodega_id, bodega:bodega_nombre",
      )
      .eq("medicamento_id", medicamentoId)
      .order("fecha_vencimiento", { ascending: true });

    if (bodega) consulta = consulta.eq("bodega_id", bodega);

    const { data, error } = await consulta;

    if (error) return { lotes: [], error: normalizarError(error) };
    return { lotes: data ?? [], error: null };
  } catch (error) {
    return { lotes: [], error: normalizarError(error) };
  }
}
