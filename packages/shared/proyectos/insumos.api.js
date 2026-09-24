// Consultas de los insumos previstos de un proyecto (tabla proyecto_insumos, migracion 00147).
//
// Entidad propia dentro del modulo de proyectos, con su propio archivo por el mismo motivo que
// equipo.api.js y avance.api.js. Es una LISTA DE LO PREVISTO: no toca existencias, lotes ni
// movimientos de inventario (ver la cabecera de la 00147). El articulo es una fila del catalogo
// de inventario: el mismo que ofrece "Producto / Insumo" en "Registrar ingreso" (listarMedicamentos,
// que devuelve medicamentos e insumos juntos), sin filtrar por tipo.
//
// Todas las funciones devuelven `{ ..., error }` en vez de lanzar, igual que el resto del modulo.
//
// Solo la administradora, o quien tenga proyectos.gestionar, lee y escribe esta tabla (RLS): son
// datos de planificacion con dinero, y el medico no los ve (#864).

import { obtenerSupabase } from "../api/cliente.js";
import { normalizarError } from "../api/errores-de-supabase.js";
import { vacioANull } from "./normalizacion.js";

const COLUMNAS_DEL_INSUMO = [
  "id",
  "proyectoId:proyecto_id",
  "medicamentoId:medicamento_id",
  "cantidad",
  "unidad",
  "costoUnitarioEstimado:costo_unitario_estimado",
  "nota",
  "createdAt:created_at",
  "updatedAt:updated_at",
  "articulo:medicamentos(nombre, concentracion, marca)",
].join(", ");

/** Redondeo a centavos: cantidad x costo puede arrastrar cola binaria (3 x 0.1). */
function aCentavos(valor) {
  return Math.round(valor * 100) / 100;
}

/**
 * Aplana el articulo embebido a `articuloNombre` y calcula `costoTotalEstimado`.
 *
 * El total no se guarda (cambiar la cantidad no debe obligar a rehacer el costo): sale de
 * cantidad x costo unitario, y es null cuando no hay costo estimado -"no estimado" no es 0-.
 */
function aInsumo(fila) {
  if (!fila) return null;
  const { articulo, ...resto } = fila;
  const costo = resto.costoUnitarioEstimado;
  const tieneCosto = costo !== null && costo !== undefined;

  return {
    ...resto,
    // Misma etiqueta que "Producto / Insumo" en "Registrar ingreso": nombre (concentracion).
    articuloNombre: articulo?.concentracion
      ? `${articulo.nombre} (${articulo.concentracion})`
      : (articulo?.nombre ?? ""),
    costoTotalEstimado: tieneCosto ? aCentavos(Number(costo) * Number(resto.cantidad)) : null,
  };
}

/** "" -> null y texto numerico -> numero, para el costo que llega de un formulario. */
function aCosto(valor) {
  const limpio = vacioANull(typeof valor === "string" ? valor.trim() : valor);
  return limpio === null || limpio === undefined ? null : Number(limpio);
}

/** Traduce del camelCase de las pantallas al snake_case de la tabla, omitiendo lo no enviado. */
function aColumnasDelInsumo(datos = {}) {
  const tiene = (campo) => Object.prototype.hasOwnProperty.call(datos, campo);
  const fila = {};

  if (tiene("medicamentoId")) fila.medicamento_id = datos.medicamentoId;
  if (tiene("cantidad")) fila.cantidad = Number(datos.cantidad);
  if (tiene("unidad")) fila.unidad = String(datos.unidad ?? "").trim();
  if (tiene("costoUnitarioEstimado")) {
    fila.costo_unitario_estimado = aCosto(datos.costoUnitarioEstimado);
  }
  if (tiene("nota")) {
    fila.nota =
      typeof datos.nota === "string" ? vacioANull(datos.nota.trim()) : (datos.nota ?? null);
  }
  return fila;
}

/**
 * Insumos previstos de un proyecto, en el orden en que se fueron agregando.
 *
 * @param {string} proyectoId UUID del proyecto.
 * @returns {Promise<{ insumos: object[], error: object|null }>}
 */
export async function listarInsumosDelProyecto(proyectoId) {
  if (!proyectoId) return { insumos: [], error: null };

  try {
    const { data, error } = await obtenerSupabase()
      .from("proyecto_insumos")
      .select(COLUMNAS_DEL_INSUMO)
      .eq("proyecto_id", proyectoId)
      .order("created_at", { ascending: true });

    if (error) return { insumos: [], error: normalizarError(error) };
    // Siempre un arreglo: una lista vacia se dibuja sola, un null obliga a comprobarlo cada vez.
    return { insumos: (data ?? []).map(aInsumo), error: null };
  } catch (error) {
    return { insumos: [], error: normalizarError(error) };
  }
}

/**
 * Agrega un insumo previsto a un proyecto.
 *
 * Un articulo figura una sola vez por proyecto (UNIQUE): repetirlo llega como violacion de
 * unicidad ya normalizada, no como un fallo generico.
 *
 * @param {string} proyectoId UUID del proyecto.
 * @param {{ medicamentoId: string, cantidad: number|string, unidad: string,
 *   costoUnitarioEstimado?: number|string|null, nota?: string }} datos
 * @returns {Promise<{ insumo: object|null, error: object|null }>}
 */
export async function agregarInsumoAProyecto(proyectoId, datos = {}) {
  if (!proyectoId || !datos.medicamentoId) return { insumo: null, error: null };

  try {
    const { data, error } = await obtenerSupabase()
      .from("proyecto_insumos")
      .insert({ ...aColumnasDelInsumo(datos), proyecto_id: proyectoId })
      .select(COLUMNAS_DEL_INSUMO)
      .single();

    if (error) return { insumo: null, error: normalizarError(error) };
    return { insumo: aInsumo(data), error: null };
  } catch (error) {
    return { insumo: null, error: normalizarError(error) };
  }
}

/**
 * Cambia cantidad, unidad, costo o nota de un insumo previsto. Cambiar de articulo es quitar y
 * agregar: la fila es "este articulo en este proyecto".
 *
 * Sin id, o sin ningun campo que cambiar, no hace nada y devuelve `error: null`.
 *
 * @param {string} id UUID de la fila de proyecto_insumos.
 * @param {{ cantidad?: number|string, unidad?: string, costoUnitarioEstimado?: number|string|null,
 *   nota?: string }} datos
 * @returns {Promise<{ insumo: object|null, error: object|null }>}
 */
export async function actualizarInsumoDeProyecto(id, datos = {}) {
  if (!id) return { insumo: null, error: null };

  // El articulo no se cambia por aqui, aunque venga en el objeto.
  const editable = { ...datos };
  delete editable.medicamentoId;
  const fila = aColumnasDelInsumo(editable);
  if (Object.keys(fila).length === 0) return { insumo: null, error: null };

  try {
    const { data, error } = await obtenerSupabase()
      .from("proyecto_insumos")
      .update(fila)
      .eq("id", id)
      .select(COLUMNAS_DEL_INSUMO)
      .maybeSingle();

    if (error) return { insumo: null, error: normalizarError(error) };
    return { insumo: aInsumo(data), error: null };
  } catch (error) {
    return { insumo: null, error: normalizarError(error) };
  }
}

/**
 * Quita un insumo de la lista del proyecto.
 *
 * Un DELETE que RLS no deja pasar no falla: borra cero filas. Por eso se pide la fila de vuelta y
 * `quitado` solo es true si de verdad se borro algo.
 *
 * @param {string} id UUID de la fila de proyecto_insumos.
 * @returns {Promise<{ quitado: boolean, error: object|null }>}
 */
export async function quitarInsumoDeProyecto(id) {
  if (!id) return { quitado: false, error: null };

  try {
    const { data, error } = await obtenerSupabase()
      .from("proyecto_insumos")
      .delete()
      .eq("id", id)
      .select("id");

    if (error) return { quitado: false, error: normalizarError(error) };
    return { quitado: (data ?? []).length > 0, error: null };
  } catch (error) {
    return { quitado: false, error: normalizarError(error) };
  }
}
