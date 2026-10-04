// Consultas de Supabase de las areas de atencion (issue #927, 00182): el catalogo y las areas de
// cada paciente.
//
// El catalogo es chico -tres areas sembradas, crece de una en una- asi que se trae completo y se
// filtra en el cliente, como el de condiciones cronicas. No se borra nada: un area se retira con
// es_vigente, y la conservan los pacientes que ya la tienen.
//
// Todas devuelven `{ ..., error }` en vez de lanzar.

import { obtenerSupabase } from "../api/cliente.js";
import {
  CODIGOS_DE_ERROR_DE_SUPABASE,
  construirError,
  normalizarError,
} from "../api/errores-de-supabase.js";
import { normalizarTexto } from "../validations/index.js";
import { validarAreaCatalogo } from "./areas.validaciones.js";

const COLUMNAS_DEL_AREA = ["id", "nombre", "descripcion", "esVigente:es_vigente"].join(", ");

/**
 * El embebido de las areas de un paciente, para pedirlo junto con el paciente
 * (`areas:paciente_area(...)`). aAreasDelPaciente() lo aplana.
 */
export const EMBEBIDO_DE_AREAS_DEL_PACIENTE = `areas:paciente_area(area:areas_atencion(${COLUMNAS_DEL_AREA}))`;

/** Una fila del catalogo, con la descripcion vacia como null. */
function aArea(fila) {
  if (!fila) return null;
  return {
    id: fila.id,
    nombre: fila.nombre,
    descripcion: fila.descripcion ?? null,
    esVigente: fila.esVigente ?? true,
  };
}

/**
 * Aplana el embebido de EMBEBIDO_DE_AREAS_DEL_PACIENTE: de `[{ area: {...} }]` a `[{...}]`, por
 * nombre. Una fila que RLS deja en null se descarta.
 *
 * @param {Array<{ area: object|null }>|null|undefined} filas
 * @returns {Array<{ id: string, nombre: string, descripcion: string|null, esVigente: boolean }>}
 */
export function aAreasDelPaciente(filas) {
  return (filas ?? [])
    .map((fila) => aArea(fila?.area))
    .filter(Boolean)
    .sort((una, otra) => una.nombre.localeCompare(otra.nombre, "es"));
}

/** El error que devuelve una escritura sin el id que hace falta. */
function errorSinId(mensaje) {
  return { ...construirError(CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO), mensaje };
}

/**
 * El catalogo de areas, por nombre.
 *
 * @param {{ soloVigentes?: boolean }} [opciones] Por defecto trae tambien las retiradas: la
 *   pantalla del catalogo las reactiva y el filtro de pacientes las ofrece.
 * @returns {Promise<{ areas: object[], error: object|null }>}
 */
export async function obtenerCatalogoDeAreas({ soloVigentes = false } = {}) {
  try {
    let consulta = obtenerSupabase().from("areas_atencion").select(COLUMNAS_DEL_AREA);
    if (soloVigentes) consulta = consulta.eq("es_vigente", true);

    const { data, error } = await consulta.order("nombre", { ascending: true });
    if (error) return { areas: [], error: normalizarError(error) };
    return { areas: (data ?? []).map(aArea), error: null };
  } catch (error) {
    return { areas: [], error: normalizarError(error) };
  }
}

/** Lo que se escribe de un area: nombre limpio y descripcion vacia como null. */
function aColumnasDelArea(datos) {
  const fila = {};
  if (Object.prototype.hasOwnProperty.call(datos, "nombre")) {
    fila.nombre = normalizarTexto(datos.nombre);
  }
  if (Object.prototype.hasOwnProperty.call(datos, "descripcion")) {
    fila.descripcion = normalizarTexto(datos.descripcion) || null;
  }
  if (Object.prototype.hasOwnProperty.call(datos, "esVigente")) {
    fila.es_vigente = Boolean(datos.esVigente);
  }
  return fila;
}

/** Un nombre repetido vuelve como error del campo, no como fallo de la pantalla. */
function respuestaDeEscritura({ data, error }) {
  if (error) {
    const normalizado = normalizarError(error);
    if (normalizado.codigo === CODIGOS_DE_ERROR_DE_SUPABASE.UNICIDAD) {
      return {
        area: null,
        errores: { nombre: "Ya existe un área con este nombre." },
        error: null,
      };
    }
    return { area: null, errores: {}, error: normalizado };
  }
  if (!data) {
    return {
      area: null,
      errores: {},
      error: {
        ...construirError(CODIGOS_DE_ERROR_DE_SUPABASE.PERMISO_DENEGADO),
        mensaje: "No se pudo guardar el área. Solo la administración mantiene este catálogo.",
      },
    };
  }
  return { area: aArea(data), errores: {}, error: null };
}

/**
 * Da de alta un area en el catalogo. Solo la administradora (politica de INSERT, 00182).
 *
 * @param {{ nombre: string, descripcion?: string }} datos
 * @returns {Promise<{ area: object|null, errores: Record<string, string>, error: object|null }>}
 */
export async function crearAreaCatalogo(datos = {}) {
  const errores = validarAreaCatalogo(datos);
  if (Object.keys(errores).length > 0) return { area: null, errores, error: null };

  try {
    const respuesta = await obtenerSupabase()
      .from("areas_atencion")
      .insert(aColumnasDelArea({ nombre: datos.nombre, descripcion: datos.descripcion ?? "" }))
      .select(COLUMNAS_DEL_AREA)
      .maybeSingle();
    return respuestaDeEscritura(respuesta);
  } catch (error) {
    return { area: null, errores: {}, error: normalizarError(error) };
  }
}

/**
 * Edita un area: nombre, descripcion o vigencia. Retirarla (esVigente false) es solo de la
 * administradora (impedir_retirar_sin_ser_administrador, 00148).
 *
 * @param {string} id
 * @param {{ nombre?: string, descripcion?: string, esVigente?: boolean }} cambios
 * @returns {Promise<{ area: object|null, errores: Record<string, string>, error: object|null }>}
 */
export async function actualizarAreaCatalogo(id, cambios = {}) {
  if (!id) {
    return { area: null, errores: {}, error: errorSinId("Hace falta el id del área.") };
  }

  if (Object.prototype.hasOwnProperty.call(cambios, "nombre")) {
    const errores = validarAreaCatalogo(cambios);
    if (Object.keys(errores).length > 0) return { area: null, errores, error: null };
  }

  const fila = aColumnasDelArea(cambios);
  if (Object.keys(fila).length === 0) {
    return { area: null, errores: {}, error: errorSinId("No hay cambios para guardar.") };
  }

  try {
    const respuesta = await obtenerSupabase()
      .from("areas_atencion")
      .update(fila)
      .eq("id", id)
      .select(COLUMNAS_DEL_AREA)
      .maybeSingle();
    return respuestaDeEscritura(respuesta);
  } catch (error) {
    return { area: null, errores: {}, error: normalizarError(error) };
  }
}

/**
 * Deja al paciente exactamente en `areaIds`: agrega las que faltan y quita las que sobran. Las que
 * ya tiene no se tocan, asi que un area retirada que el paciente conserva no se pierde por guardar
 * la ficha.
 *
 * Lo pueden hacer quien edita pacientes y quien registro a este (politicas de paciente_area,
 * 00182).
 *
 * @param {string} pacienteId
 * @param {string[]} areaIds
 * @returns {Promise<{ error: object|null }>}
 */
export async function sincronizarAreasDelPaciente(pacienteId, areaIds = []) {
  if (!pacienteId) return { error: errorSinId("Hace falta el id del paciente.") };

  const deseadas = [...new Set((areaIds ?? []).filter(Boolean))];

  try {
    const supabase = obtenerSupabase();
    const { data, error } = await supabase
      .from("paciente_area")
      .select("areaId:area_id")
      .eq("paciente_id", pacienteId);
    if (error) return { error: normalizarError(error) };

    const actuales = (data ?? []).map((fila) => fila.areaId);
    const porQuitar = actuales.filter((id) => !deseadas.includes(id));
    const porAgregar = deseadas.filter((id) => !actuales.includes(id));

    if (porQuitar.length > 0) {
      const { error: errorAlQuitar } = await supabase
        .from("paciente_area")
        .delete()
        .eq("paciente_id", pacienteId)
        .in("area_id", porQuitar);
      if (errorAlQuitar) return { error: normalizarError(errorAlQuitar) };
    }

    if (porAgregar.length > 0) {
      const { error: errorAlAgregar } = await supabase
        .from("paciente_area")
        .insert(porAgregar.map((areaId) => ({ paciente_id: pacienteId, area_id: areaId })));
      if (errorAlAgregar) return { error: normalizarError(errorAlAgregar) };
    }

    return { error: null };
  } catch (error) {
    return { error: normalizarError(error) };
  }
}
