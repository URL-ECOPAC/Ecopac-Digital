// Consultas de la configuracion de los avisos de vencimiento (configuracion_alertas_caducidad,
// migracion 00162, issue #899).
//
// La tabla tiene una sola fila. La leen todos los roles con sesion activa -las listas de
// inventario marcan "por vencer" con la misma ventana- y la cambia la administracion o quien
// tenga el permiso fino inventario.configurar_alertas: la politica de UPDATE de la 00162 es quien
// lo impide de verdad. guardarConfiguracionAlertas() lo comprueba antes solo para no hacer el
// viaje, igual que atenderAlerta() (alertas.api.js).
//
// Las dos funciones devuelven { configuracion, error }.

import { obtenerSupabase } from "../api/cliente.js";
import {
  CODIGOS_DE_ERROR_DE_SUPABASE,
  construirError,
  normalizarError,
} from "../api/errores-de-supabase.js";
import { puedeConfigurarAlertasVencimiento } from "./permisos.js";
import { normalizarUmbrales, validarUmbrales } from "./configuracionAlertas.validaciones.js";

const COLUMNAS_DE_LA_CONFIGURACION = [
  "id",
  "umbralesDias:umbrales_dias",
  "actualizadoPor:actualizado_por",
  "updatedAt:updated_at",
  "actualizadoPorPerfil:perfiles!configuracion_alertas_caducidad_actualizado_por_fkey(nombres, apellidos)",
].join(", ");

function aConfiguracion(fila) {
  if (!fila) return null;
  return {
    id: fila.id,
    umbralesDias: normalizarUmbrales(fila.umbralesDias ?? []),
    actualizadoPor: fila.actualizadoPor ?? null,
    actualizadoPorNombre: fila.actualizadoPorPerfil
      ? `${fila.actualizadoPorPerfil.nombres} ${fila.actualizadoPorPerfil.apellidos}`.trim()
      : null,
    updatedAt: fila.updatedAt ?? null,
  };
}

/**
 * La configuracion vigente.
 *
 * @returns {Promise<{ configuracion: object|null, error: object|null }>}
 */
export async function obtenerConfiguracionAlertas() {
  try {
    const { data, error } = await obtenerSupabase()
      .from("configuracion_alertas_caducidad")
      .select(COLUMNAS_DE_LA_CONFIGURACION)
      .single();

    if (error) return { configuracion: null, error: normalizarError(error) };
    return { configuracion: aConfiguracion(data), error: null };
  } catch (error) {
    return { configuracion: null, error: normalizarError(error) };
  }
}

/**
 * Guarda las antelaciones. El aviso del dia del vencimiento no viaja: la base lo da siempre.
 *
 * Si la politica no deja actualizar la fila, PostgREST no devuelve error sino cero filas; por eso
 * se pide la fila de vuelta con .single(), que en ese caso si falla, en vez de dar por guardado lo
 * que no se guardo.
 *
 * @param {string} id
 * @param {{ umbralesDias: (number|string)[], rolUsuario: string }} datos
 * @returns {Promise<{ configuracion: object|null, error: object|null }>}
 */
export async function guardarConfiguracionAlertas(id, { umbralesDias, rolUsuario } = {}) {
  if (!puedeConfigurarAlertasVencimiento(rolUsuario)) {
    return {
      configuracion: null,
      error: construirError(
        CODIGOS_DE_ERROR_DE_SUPABASE.PERMISO_DENEGADO,
        "Solo administración puede configurar los avisos de vencimiento.",
      ),
    };
  }

  const errores = validarUmbrales(umbralesDias);
  if (errores) {
    const primero = errores.general ?? Object.values(errores.porRenglon)[0];
    return {
      configuracion: null,
      error: construirError(CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO, primero),
    };
  }

  try {
    const { data, error } = await obtenerSupabase()
      .from("configuracion_alertas_caducidad")
      .update({ umbrales_dias: normalizarUmbrales(umbralesDias) })
      .eq("id", id)
      .select(COLUMNAS_DE_LA_CONFIGURACION)
      .single();

    if (error) return { configuracion: null, error: normalizarError(error) };
    return { configuracion: aConfiguracion(data), error: null };
  } catch (error) {
    return { configuracion: null, error: normalizarError(error) };
  }
}
