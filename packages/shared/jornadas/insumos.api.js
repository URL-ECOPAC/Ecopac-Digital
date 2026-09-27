// Consultas de los insumos previstos de una jornada (tabla jornada_insumos, migracion 00151).
//
// Desde la 00151 los insumos se planean por jornada, igual que los gastos se registran contra una
// jornada, y el proyecto solo los muestra agrupados. Es una LISTA DE LO PREVISTO: no toca
// existencias, lotes ni movimientos de inventario (mismo criterio que proyecto_insumos, 00147). La
// forma de cada fila y la traduccion del formulario son las mismas que las de un insumo de
// proyecto, y se reutilizan de proyectos/insumos.api.js.
//
// Escribe la administradora o quien tenga jornadas.gestionar; leen ademas quien gestiona proyectos
// y el rol al que la matriz le abrio Jornadas o Proyectos (RLS). El personal de campo no los ve:
// llevan costo (#864).
//
// Todas devuelven `{ ..., error }` en vez de lanzar.

import { obtenerSupabase } from "../api/cliente.js";
import { normalizarError } from "../api/errores-de-supabase.js";
import { aColumnasDeInsumoPrevisto, aInsumoPrevisto } from "../proyectos/insumos.api.js";

const COLUMNAS_DEL_INSUMO_DE_JORNADA = [
  "id",
  "jornadaId:jornada_id",
  "medicamentoId:medicamento_id",
  "cantidad",
  "unidad",
  "costoUnitarioEstimado:costo_unitario_estimado",
  "nota",
  "createdAt:created_at",
  "updatedAt:updated_at",
  "articulo:medicamentos(nombre, concentracion, marca)",
].join(", ");

/**
 * Insumos previstos de una jornada, en el orden en que se fueron agregando.
 *
 * @param {string} jornadaId UUID de la jornada.
 * @returns {Promise<{ insumos: object[], error: object|null }>}
 */
export async function listarInsumosDeJornada(jornadaId) {
  if (!jornadaId) return { insumos: [], error: null };

  try {
    const { data, error } = await obtenerSupabase()
      .from("jornada_insumos")
      .select(COLUMNAS_DEL_INSUMO_DE_JORNADA)
      .eq("jornada_id", jornadaId)
      .order("created_at", { ascending: true });

    if (error) return { insumos: [], error: normalizarError(error) };
    return { insumos: (data ?? []).map(aInsumoPrevisto), error: null };
  } catch (error) {
    return { insumos: [], error: normalizarError(error) };
  }
}

/**
 * Insumos previstos de todas las jornadas de un proyecto, cada uno con el nombre y la fecha de su
 * jornada. Es lo que la pestana Insumos del proyecto muestra, agrupado por jornada.
 *
 * @param {string} proyectoId UUID del proyecto.
 * @returns {Promise<{ insumos: object[], error: object|null }>} Cada insumo trae ademas
 *   `jornadaNombre` y `jornadaFecha`.
 */
export async function listarInsumosDeLasJornadasDelProyecto(proyectoId) {
  if (!proyectoId) return { insumos: [], error: null };

  try {
    const { data, error } = await obtenerSupabase()
      .from("jornada_insumos")
      .select(
        `${COLUMNAS_DEL_INSUMO_DE_JORNADA}, jornada:jornadas!inner(nombre, fecha, proyecto_id)`,
      )
      .eq("jornada.proyecto_id", proyectoId)
      .order("created_at", { ascending: true });

    if (error) return { insumos: [], error: normalizarError(error) };
    return {
      insumos: (data ?? []).map(({ jornada, ...fila }) => ({
        ...aInsumoPrevisto(fila),
        jornadaNombre: jornada?.nombre ?? null,
        jornadaFecha: jornada?.fecha ?? null,
      })),
      error: null,
    };
  } catch (error) {
    return { insumos: [], error: normalizarError(error) };
  }
}

/**
 * Agrega un insumo previsto a una jornada. Un articulo figura una sola vez por jornada: repetirlo
 * llega como violacion de unicidad ya normalizada.
 *
 * @param {string} jornadaId UUID de la jornada.
 * @param {{ medicamentoId: string, cantidad: number|string, unidad: string,
 *   costoUnitarioEstimado?: number|string|null, nota?: string }} datos
 * @returns {Promise<{ insumo: object|null, error: object|null }>}
 */
export async function agregarInsumoAJornada(jornadaId, datos = {}) {
  if (!jornadaId || !datos.medicamentoId) return { insumo: null, error: null };

  try {
    const { data, error } = await obtenerSupabase()
      .from("jornada_insumos")
      .insert({ ...aColumnasDeInsumoPrevisto(datos), jornada_id: jornadaId })
      .select(COLUMNAS_DEL_INSUMO_DE_JORNADA)
      .single();

    if (error) return { insumo: null, error: normalizarError(error) };
    return { insumo: aInsumoPrevisto(data), error: null };
  } catch (error) {
    return { insumo: null, error: normalizarError(error) };
  }
}

/**
 * Cambia cantidad, unidad, costo o nota de un insumo de jornada. El articulo no se cambia: es
 * quitar y agregar.
 *
 * @param {string} id UUID de la fila de jornada_insumos.
 * @param {{ cantidad?: number|string, unidad?: string, costoUnitarioEstimado?: number|string|null,
 *   nota?: string }} datos
 * @returns {Promise<{ insumo: object|null, error: object|null }>}
 */
export async function actualizarInsumoDeJornada(id, datos = {}) {
  if (!id) return { insumo: null, error: null };

  const editable = { ...datos };
  delete editable.medicamentoId;
  const fila = aColumnasDeInsumoPrevisto(editable);
  if (Object.keys(fila).length === 0) return { insumo: null, error: null };

  try {
    const { data, error } = await obtenerSupabase()
      .from("jornada_insumos")
      .update(fila)
      .eq("id", id)
      .select(COLUMNAS_DEL_INSUMO_DE_JORNADA)
      .maybeSingle();

    if (error) return { insumo: null, error: normalizarError(error) };
    return { insumo: aInsumoPrevisto(data), error: null };
  } catch (error) {
    return { insumo: null, error: normalizarError(error) };
  }
}

/**
 * Quita un insumo de la jornada. Un DELETE que RLS no deja pasar borra cero filas: `quitado` solo
 * es true si de verdad se borro algo.
 *
 * @param {string} id UUID de la fila de jornada_insumos.
 * @returns {Promise<{ quitado: boolean, error: object|null }>}
 */
export async function quitarInsumoDeJornada(id) {
  if (!id) return { quitado: false, error: null };

  try {
    const { data, error } = await obtenerSupabase()
      .from("jornada_insumos")
      .delete()
      .eq("id", id)
      .select("id");

    if (error) return { quitado: false, error: normalizarError(error) };
    return { quitado: (data ?? []).length > 0, error: null };
  } catch (error) {
    return { quitado: false, error: normalizarError(error) };
  }
}
