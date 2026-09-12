// Consultas de Supabase de las bodegas (issue #143).
//
// Reemplaza a packages/shared/servicios/inventarioServicio.ts, que describia una tabla que no
// existe: pedia bodegas.tipo ('fija' | 'movil') y bodegas.activa, y embebia
// `existencias:lotes(cantidad_actual)`. La tabla real (00017_proveedores_bodegas.sql) es
//
//   bodegas (id, nombre, ubicacion, es_movil BOOLEAN, created_at, updated_at)
//
// sin columna `tipo` y sin columna `activa`, y ninguna migracion posterior la altera: la 00061
// y la 00062 solo le activan RLS. La cantidad almacenada tampoco cuelga de lotes, que no tiene
// llave foranea a bodegas: la relacion es bodegas <- existencias -> lotes y la cantidad es
// existencias.cantidad_disponible (00020).
//
// Se llama bodegas.api.js y no api.js por el mismo motivo que lotes.api.js y medicamentos.api.js:
// inventario/ lo construye mas de una issue en paralelo y un api.js unico seria un iman de
// conflictos.
//
// Todas las funciones devuelven `{ dato, error }` en vez de lanzar, igual que supabase-js: quien
// las consume es un hook que tiene que reflejar el fallo en pantalla, no reventar el render.
//
// Ninguna funcion decide aqui quien puede escribir: eso lo aplican las politicas de la 00062
// (SELECT abierto a autenticados, el resto solo administrador), y un intento sin permiso vuelve
// como error 42501, que normalizarError() ya traduce. El cliente pregunta para dibujar, el
// servidor decide.

import { obtenerSupabase } from "../api/cliente.js";
import {
  CODIGOS_DE_ERROR_DE_SUPABASE,
  construirError,
  normalizarError,
} from "../api/errores-de-supabase.js";

// Las columnas se enumeran en lugar de pedir "*" para que una columna nueva no empiece a viajar
// sola hasta el cliente.
const COLUMNAS_DE_LA_BODEGA = [
  "id",
  "nombre",
  "ubicacion",
  "esMovil:es_movil",
  "createdAt:created_at",
  "updatedAt:updated_at",
].join(", ");

/** Traduce del camelCase de las pantallas al snake_case de la tabla bodegas. */
function aColumnasDeTabla(datos = {}) {
  const mapa = {
    nombre: "nombre",
    ubicacion: "ubicacion",
    esMovil: "es_movil",
  };

  const fila = {};
  for (const [campo, columna] of Object.entries(mapa)) {
    if (Object.prototype.hasOwnProperty.call(datos, campo)) fila[columna] = datos[campo];
  }
  return fila;
}

/**
 * Traduce una fila de bodegas a una bodega.
 *
 * `existenciasTotales` llega ya sumado (existencias_totales_por_bodega(), 00124) y no como un
 * arreglo de existencias para sumar aqui: PostgREST tambien corta en max_rows el arreglo que
 * embebe un recurso anidado, no solo las filas del nivel superior (issue #773, comprobado con
 * 1100 existencias de una sola bodega devolviendo solo 1000 embebidas). Sumar del lado del
 * cliente sobre ese arreglo mentiria en silencio en cuanto una bodega pasara las 1000
 * combinaciones de lote. Vale `null` cuando la consulta no pidio las existencias, para distinguir
 * "no se consulto" de "no hay nada almacenado" (que es 0, no null).
 *
 * @param {object} fila
 * @param {number} [totalExistencias] Total ya agregado en la base; ausente si no se pidio.
 */
function aBodega(fila, totalExistencias) {
  if (!fila) return null;

  return {
    id: fila.id,
    nombre: fila.nombre,
    ubicacion: fila.ubicacion,
    esMovil: fila.esMovil,
    existenciasTotales: totalExistencias === undefined ? null : totalExistencias,
    createdAt: fila.createdAt,
    updatedAt: fila.updatedAt,
  };
}

/**
 * Totales de existencias de un conjunto de bodegas, agregados en la base
 * (existencias_totales_por_bodega(), 00124). Una bodega sin existencias, o cuyas existencias RLS
 * no deja ver, no aparece como llave del mapa: quien la consume trata esa ausencia como total 0.
 *
 * @param {string[]} idsDeBodega
 * @returns {Promise<{ totales: Record<string, number>, error: object|null }>}
 */
async function totalesDeExistenciasPorBodega(idsDeBodega) {
  const { data, error } = await obtenerSupabase().rpc("existencias_totales_por_bodega", {
    p_bodega_ids: idsDeBodega,
  });

  if (error) return { totales: {}, error };

  const totales = {};
  for (const fila of data ?? []) {
    totales[fila.bodega_id] = Number(fila.total_disponible ?? 0);
  }
  return { totales, error: null };
}

/**
 * Registra una bodega nueva.
 *
 * Exige nombre: la columna es NOT NULL y UNIQUE (00017), y un nombre vacio daria un error de la
 * base menos claro que CAMPO_REQUERIDO. `esMovil` no se exige porque la columna tiene
 * DEFAULT FALSE, y `ubicacion` es nullable a proposito: la bodega movil no tiene ubicacion fija.
 *
 * @param {{ nombre: string, ubicacion?: string, esMovil?: boolean }} datos
 * @returns {Promise<{ bodega: object|null, error: object|null }>}
 */
export async function registrarBodega(datos = {}) {
  if (!datos.nombre) {
    return { bodega: null, error: construirError(CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO) };
  }

  try {
    const { data, error } = await obtenerSupabase()
      .from("bodegas")
      .insert(aColumnasDeTabla(datos))
      .select(COLUMNAS_DE_LA_BODEGA)
      .single();

    if (error) return { bodega: null, error: normalizarError(error) };
    return { bodega: aBodega(data), error: null };
  } catch (error) {
    // Un fallo de red no llega por el campo error sino como excepcion del fetch.
    return { bodega: null, error: normalizarError(error) };
  }
}

/**
 * Actualiza una bodega existente. Solo viajan las claves presentes en `datos`, para que la
 * pantalla pueda mandar el campo que cambio sin reenviar la fila entera.
 *
 * @param {string} id UUID de la bodega.
 * @param {{ nombre?: string, ubicacion?: string, esMovil?: boolean }} datos
 * @returns {Promise<{ bodega: object|null, error: object|null }>}
 */
export async function actualizarBodega(id, datos = {}) {
  if (!id) {
    return { bodega: null, error: construirError(CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO) };
  }

  const cambios = aColumnasDeTabla(datos);
  if (Object.keys(cambios).length === 0) {
    return { bodega: null, error: construirError(CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO) };
  }

  try {
    const { data, error } = await obtenerSupabase()
      .from("bodegas")
      .update(cambios)
      .eq("id", id)
      .select(COLUMNAS_DE_LA_BODEGA)
      .single();

    if (error) return { bodega: null, error: normalizarError(error) };
    return { bodega: aBodega(data), error: null };
  } catch (error) {
    return { bodega: null, error: normalizarError(error) };
  }
}

/**
 * Lista las bodegas, ordenadas por nombre.
 *
 * `esMovil` filtra fijas de moviles; es el filtro que la version anterior intentaba hacer con una
 * columna `tipo` inexistente. `conExistencias` decide si se trae ademas el total almacenado: no va
 * siempre porque obliga a Postgres a recorrer existencias, y la mayoria de los selectores de
 * bodega solo necesitan id y nombre.
 *
 * Un filtro ausente o nulo no se aplica, para que la pantalla pueda pasar su estado de filtros tal
 * cual sin ir limpiando claves vacias.
 *
 * @param {{ busqueda?: string, esMovil?: boolean, conExistencias?: boolean }} [filtros]
 * @returns {Promise<{ bodegas: object[], error: object|null }>}
 */
export async function listarBodegas({ busqueda, esMovil, conExistencias = false } = {}) {
  try {
    let consulta = obtenerSupabase()
      .from("bodegas")
      .select(COLUMNAS_DE_LA_BODEGA)
      .order("nombre", { ascending: true });

    if (busqueda) consulta = consulta.ilike("nombre", `%${busqueda}%`);
    // Comparado contra undefined y no por veracidad: `esMovil: false` es un filtro valido.
    if (esMovil !== undefined && esMovil !== null) consulta = consulta.eq("es_movil", esMovil);

    const { data, error } = await consulta;

    if (error) return { bodegas: [], error: normalizarError(error) };

    const filas = data ?? [];
    if (!conExistencias || filas.length === 0) {
      // Siempre un arreglo: una lista vacia se dibuja sola, un null obliga a comprobarlo cada vez.
      return { bodegas: filas.map((fila) => aBodega(fila)), error: null };
    }

    const { totales, error: errorTotales } = await totalesDeExistenciasPorBodega(
      filas.map((fila) => fila.id),
    );
    if (errorTotales) return { bodegas: [], error: normalizarError(errorTotales) };

    return {
      bodegas: filas.map((fila) => aBodega(fila, totales[fila.id] ?? 0)),
      error: null,
    };
  } catch (error) {
    return { bodegas: [], error: normalizarError(error) };
  }
}

/**
 * Una bodega por id, con su total almacenado.
 *
 * @param {string} id UUID de la bodega.
 * @returns {Promise<{ bodega: object|null, error: object|null }>}
 */
export async function obtenerBodega(id) {
  if (!id) {
    return { bodega: null, error: construirError(CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO) };
  }

  try {
    const { data, error } = await obtenerSupabase()
      .from("bodegas")
      .select(COLUMNAS_DE_LA_BODEGA)
      .eq("id", id)
      .single();

    if (error) return { bodega: null, error: normalizarError(error) };

    const { totales, error: errorTotales } = await totalesDeExistenciasPorBodega([id]);
    if (errorTotales) return { bodega: null, error: normalizarError(errorTotales) };

    return { bodega: aBodega(data, totales[id] ?? 0), error: null };
  } catch (error) {
    return { bodega: null, error: normalizarError(error) };
  }
}
