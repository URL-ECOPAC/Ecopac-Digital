import { obtenerSupabase } from "../api/cliente.js";
import {
  CODIGOS_DE_ERROR_DE_SUPABASE,
  construirError,
  normalizarError,
} from "../api/errores-de-supabase.js";

export const PORCENTAJE_AVANCE_MINIMO = 0;
export const PORCENTAJE_AVANCE_MAXIMO = 100;

const COLUMNAS_DEL_HITO = [
  "id",
  "proyectoId:proyecto_id",
  "nombre",
  "descripcion",
  "fechaPrevista:fecha_prevista",
  "fechaReal:fecha_real",
  "registradoPor:registrado_por",
  "createdAt:created_at",
  "updatedAt:updated_at",
].join(", ");

const COLUMNAS_DEL_SEGUIMIENTO = [
  "id",
  "proyectoId:proyecto_id",
  "nota",
  "porcentajeAnterior:porcentaje_anterior",
  "porcentajeNuevo:porcentaje_nuevo",
  "registradoPor:registrado_por",
  "createdAt:created_at",
].join(", ");

function aColumnasDelHito(datos = {}) {
  const mapa = {
    proyectoId: "proyecto_id",
    nombre: "nombre",
    descripcion: "descripcion",
    fechaPrevista: "fecha_prevista",
    fechaReal: "fecha_real",
  };

  const fila = {};
  for (const [campo, columna] of Object.entries(mapa)) {
    if (Object.prototype.hasOwnProperty.call(datos, campo)) fila[columna] = datos[campo];
  }
  return fila;
}

function errorDeRango() {
  return {
    ...construirError(CODIGOS_DE_ERROR_DE_SUPABASE.CHECK),
    mensaje: `El porcentaje de avance debe estar entre ${PORCENTAJE_AVANCE_MINIMO} y ${PORCENTAJE_AVANCE_MAXIMO}.`,
  };
}

export function esPorcentajeDeAvanceValido(porcentaje) {
  return (
    Number.isInteger(porcentaje) &&
    porcentaje >= PORCENTAJE_AVANCE_MINIMO &&
    porcentaje <= PORCENTAJE_AVANCE_MAXIMO
  );
}

export async function registrarHito(proyectoId, datos) {
  if (!proyectoId) return { hito: null, error: null };

  try {
    const { data, error } = await obtenerSupabase()
      .from("proyecto_hitos")
      .insert(aColumnasDelHito({ ...datos, proyectoId }))
      .select(COLUMNAS_DEL_HITO)
      .single();

    if (error) return { hito: null, error: normalizarError(error) };
    return { hito: data ?? null, error: null };
  } catch (error) {
    return { hito: null, error: normalizarError(error) };
  }
}

export async function actualizarHito(id, datos) {
  if (!id) return { hito: null, error: null };

  const fila = aColumnasDelHito(datos);
  if (Object.keys(fila).length === 0) return { hito: null, error: null };

  try {
    const { data, error } = await obtenerSupabase()
      .from("proyecto_hitos")
      .update(fila)
      .eq("id", id)
      .select(COLUMNAS_DEL_HITO)
      .maybeSingle();

    if (error) return { hito: null, error: normalizarError(error) };
    return { hito: data ?? null, error: null };
  } catch (error) {
    return { hito: null, error: normalizarError(error) };
  }
}

export function marcarHitoCumplido(id, fechaReal) {
  return actualizarHito(id, { fechaReal: fechaReal ?? new Date().toISOString().slice(0, 10) });
}

export function reabrirHito(id) {
  return actualizarHito(id, { fechaReal: null });
}

export async function listarHitos(proyectoId, { soloPendientes = false } = {}) {
  if (!proyectoId) return { hitos: [], error: null };

  try {
    let consulta = obtenerSupabase()
      .from("proyecto_hitos")
      .select(COLUMNAS_DEL_HITO)
      .eq("proyecto_id", proyectoId)
      .order("fecha_prevista", { ascending: true });

    if (soloPendientes) consulta = consulta.is("fecha_real", null);

    const { data, error } = await consulta;

    if (error) return { hitos: [], error: normalizarError(error) };
    return { hitos: data ?? [], error: null };
  } catch (error) {
    return { hitos: [], error: normalizarError(error) };
  }
}

export async function actualizarAvance(proyectoId, porcentaje) {
  if (!proyectoId) return { proyecto: null, error: null };

  if (!esPorcentajeDeAvanceValido(porcentaje)) {
    return { proyecto: null, error: errorDeRango() };
  }

  try {
    const { data, error } = await obtenerSupabase()
      .from("proyectos")
      .update({ porcentaje_avance: porcentaje })
      .eq("id", proyectoId)
      .select("id, porcentajeAvance:porcentaje_avance")
      .maybeSingle();

    if (error) return { proyecto: null, error: normalizarError(error) };
    return { proyecto: data ?? null, error: null };
  } catch (error) {
    return { proyecto: null, error: normalizarError(error) };
  }
}

export async function registrarNota(proyectoId, nota) {
  if (!proyectoId) return { entrada: null, error: null };

  const texto = typeof nota === "string" ? nota.trim() : "";
  if (texto === "") {
    return {
      entrada: null,
      error: {
        ...construirError(CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO),
        mensaje: "La nota de seguimiento no puede ir vacia.",
      },
    };
  }

  try {
    const { data, error } = await obtenerSupabase()
      .from("proyecto_seguimiento")
      .insert({ proyecto_id: proyectoId, nota: texto })
      .select(COLUMNAS_DEL_SEGUIMIENTO)
      .single();

    if (error) return { entrada: null, error: normalizarError(error) };
    return { entrada: data ?? null, error: null };
  } catch (error) {
    return { entrada: null, error: normalizarError(error) };
  }
}

export async function listarSeguimiento(proyectoId) {
  if (!proyectoId) return { bitacora: [], error: null };

  try {
    const { data, error } = await obtenerSupabase()
      .from("proyecto_seguimiento")
      .select(COLUMNAS_DEL_SEGUIMIENTO)
      .eq("proyecto_id", proyectoId)
      .order("created_at", { ascending: false });

    if (error) return { bitacora: [], error: normalizarError(error) };
    return { bitacora: data ?? [], error: null };
  } catch (error) {
    return { bitacora: [], error: normalizarError(error) };
  }
}

export async function obtenerAdvertenciaDeCierre(proyectoId) {
  const { hitos, error } = await listarHitos(proyectoId, { soloPendientes: true });

  if (error) return { advertencia: null, error };

  if (hitos.length === 0) return { advertencia: null, error: null };

  return {
    advertencia: {
      hitosPendientes: hitos,
      cantidad: hitos.length,
      mensaje:
        hitos.length === 1
          ? "El proyecto tiene 1 hito sin cumplir. Puedes cerrarlo de todas formas."
          : `El proyecto tiene ${hitos.length} hitos sin cumplir. Puedes cerrarlo de todas formas.`,
    },
    error: null,
  };
}
