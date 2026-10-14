// Consultas de Supabase del catalogo de clinicas (issue #927, 00183).
//
// Todas devuelven `{ ..., error }` en vez de lanzar.

import { obtenerSupabase } from "../api/cliente.js";
import {
  CODIGOS_DE_ERROR_DE_SUPABASE,
  construirError,
  normalizarError,
} from "../api/errores-de-supabase.js";
import { normalizarTexto } from "../validations/index.js";
import { validarClinica } from "./clinicas.validaciones.js";

const COLUMNAS_DE_LA_CLINICA = [
  "id",
  "nombre",
  "salasDisponibles:salas_disponibles",
  "esVigente:es_vigente",
].join(", ");

/** Como queda una clinica en el cliente. */
function aClinica(fila) {
  if (!fila) return null;
  return {
    id: fila.id,
    nombre: fila.nombre,
    salasDisponibles: Number(fila.salasDisponibles),
    esVigente: fila.esVigente ?? true,
  };
}

/** Lo que se escribe: solo los campos que vienen. */
function aColumnasDeLaClinica(datos) {
  const fila = {};
  if (Object.prototype.hasOwnProperty.call(datos, "nombre")) {
    fila.nombre = normalizarTexto(datos.nombre);
  }
  if (Object.prototype.hasOwnProperty.call(datos, "salasDisponibles")) {
    fila.salas_disponibles = Number(datos.salasDisponibles);
  }
  if (Object.prototype.hasOwnProperty.call(datos, "esVigente")) {
    fila.es_vigente = Boolean(datos.esVigente);
  }
  return fila;
}

/** Un nombre repetido vuelve como error del campo; una fila que RLS no devolvio, como permiso. */
function respuestaDeEscritura({ data, error }) {
  if (error) {
    const normalizado = normalizarError(error);
    if (normalizado.codigo === CODIGOS_DE_ERROR_DE_SUPABASE.UNICIDAD) {
      return {
        clinica: null,
        errores: { nombre: "Ya existe una clínica con este nombre." },
        error: null,
      };
    }
    return { clinica: null, errores: {}, error: normalizado };
  }
  if (!data) {
    return {
      clinica: null,
      errores: {},
      error: {
        ...construirError(CODIGOS_DE_ERROR_DE_SUPABASE.PERMISO_DENEGADO),
        mensaje: "No se pudo guardar la clínica. Revisa tus permisos.",
      },
    };
  }
  return { clinica: aClinica(data), errores: {}, error: null };
}

/**
 * El catalogo de clinicas, por nombre.
 *
 * @param {{ soloVigentes?: boolean }} [opciones]
 * @returns {Promise<{ clinicas: object[], error: object|null }>}
 */
export async function listarClinicas({ soloVigentes = false } = {}) {
  try {
    let consulta = obtenerSupabase().from("clinicas").select(COLUMNAS_DE_LA_CLINICA);
    if (soloVigentes) consulta = consulta.eq("es_vigente", true);
    const { data, error } = await consulta.order("nombre", { ascending: true });
    if (error) return { clinicas: [], error: normalizarError(error) };
    return { clinicas: (data ?? []).map(aClinica), error: null };
  } catch (error) {
    return { clinicas: [], error: normalizarError(error) };
  }
}

/**
 * Da de alta una clinica. La administradora o quien tiene jornadas.gestionar (00183).
 *
 * @param {{ nombre: string, salasDisponibles: number|string }} datos
 * @returns {Promise<{ clinica: object|null, errores: Record<string, string>, error: object|null }>}
 */
export async function crearClinica(datos = {}) {
  const errores = validarClinica(datos);
  if (Object.keys(errores).length > 0) return { clinica: null, errores, error: null };

  try {
    const respuesta = await obtenerSupabase()
      .from("clinicas")
      .insert(
        aColumnasDeLaClinica({ nombre: datos.nombre, salasDisponibles: datos.salasDisponibles }),
      )
      .select(COLUMNAS_DE_LA_CLINICA)
      .maybeSingle();
    return respuestaDeEscritura(respuesta);
  } catch (error) {
    return { clinica: null, errores: {}, error: normalizarError(error) };
  }
}

/**
 * Edita una clinica: nombre, salas o vigencia. Retirarla es solo de la administradora.
 *
 * @param {string} id
 * @param {{ nombre?: string, salasDisponibles?: number|string, esVigente?: boolean }} cambios
 * @returns {Promise<{ clinica: object|null, errores: Record<string, string>, error: object|null }>}
 */
export async function actualizarClinica(id, cambios = {}) {
  const sinNada = (mensaje) => ({
    clinica: null,
    errores: {},
    error: { ...construirError(CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO), mensaje },
  });
  if (!id) return sinNada("Hace falta el id de la clínica.");

  const errores = validarClinica(cambios, { completo: false });
  if (Object.keys(errores).length > 0) return { clinica: null, errores, error: null };

  const fila = aColumnasDeLaClinica(cambios);
  if (Object.keys(fila).length === 0) return sinNada("No hay cambios para guardar.");

  try {
    const respuesta = await obtenerSupabase()
      .from("clinicas")
      .update(fila)
      .eq("id", id)
      .select(COLUMNAS_DE_LA_CLINICA)
      .maybeSingle();
    return respuestaDeEscritura(respuesta);
  } catch (error) {
    return { clinica: null, errores: {}, error: normalizarError(error) };
  }
}

/**
 * Elimina una clinica: la base la borra si nunca tuvo citas y la retira si las tuvo
 * (fn_eliminar_clinica). Solo la administradora.
 *
 * @param {string} id
 * @returns {Promise<{ resultado: "eliminada"|"retirada"|null, error: object|null }>}
 */
export async function eliminarClinica(id) {
  if (!id) return { resultado: null, error: null };
  try {
    const { data, error } = await obtenerSupabase().rpc("fn_eliminar_clinica", {
      p_clinica_id: id,
    });
    if (error) return { resultado: null, error: normalizarError(error) };
    return { resultado: data ?? null, error: null };
  } catch (error) {
    return { resultado: null, error: normalizarError(error) };
  }
}
