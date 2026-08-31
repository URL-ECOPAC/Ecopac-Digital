import { obtenerSupabase } from "../api/cliente.js";
import {
  construirError,
  normalizarError,
  CODIGOS_DE_ERROR_DE_SUPABASE,
} from "../api/errores-de-supabase.js";

/**
 * Obtiene la lista de gastos pendientes de aprobación ordenados por fecha.
 */
export async function listarGastosPendientes() {
  try {
    const { data, error } = await obtenerSupabase()
      .from("gastos")
      .select("*")
      .eq("estado", "pendiente")
      .order("fecha", { ascending: true });

    if (error) throw error;
    return { gastos: data || [], error: null };
  } catch (error) {
    return { gastos: [], error: normalizarError(error) };
  }
}

/**
 * Aprueba un gasto pendiente registrando el usuario y la fecha actual.
 *
 * El ejecutado de la jornada/proyecto no se materializa aqui: presupuesto_de_jornada(),
 * presupuesto_de_proyecto() y presupuesto_del_sistema() (00040) lo calculan en vivo sumando
 * gastos aprobados en el momento de consultarlo.
 */
export async function aprobarGasto({ gastoId, usuarioId }) {
  if (!gastoId || !usuarioId) {
    return {
      gasto: null,
      error: construirError(
        CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO,
        "gastoId y usuarioId son requeridos",
      ),
    };
  }

  try {
    const timestamp = new Date().toISOString();

    const { data, error } = await obtenerSupabase()
      .from("gastos")
      .update({
        estado: "aprobado",
        aprobado_por: usuarioId,
        aprobado_en: timestamp,
      })
      .eq("id", gastoId)
      .select()
      .single();

    if (error) throw error;
    return { gasto: data, error: null };
  } catch (error) {
    return { gasto: null, error: normalizarError(error) };
  }
}

/**
 * Rechaza un gasto pendiente exigiendo un motivo obligatorio.
 *
 * Reutiliza aprobado_por/aprobado_en para la auditoria de la decision, igual que
 * movimientos_inventario (00023): no hay rechazado_por ni fecha_rechazo. motivo_rechazo
 * (00071) es la unica columna nueva.
 */
export async function rechazarGasto({ gastoId, usuarioId, motivo }) {
  if (!gastoId || !usuarioId) {
    return {
      gasto: null,
      error: construirError(
        CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO,
        "gastoId y usuarioId son requeridos",
      ),
    };
  }

  if (!motivo || !motivo.trim()) {
    return {
      gasto: null,
      error: construirError(
        CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO,
        "El motivo de rechazo es obligatorio",
      ),
    };
  }

  try {
    const timestamp = new Date().toISOString();

    const { data, error } = await obtenerSupabase()
      .from("gastos")
      .update({
        estado: "rechazado",
        aprobado_por: usuarioId,
        aprobado_en: timestamp,
        motivo_rechazo: motivo.trim(),
      })
      .eq("id", gastoId)
      .select()
      .single();

    if (error) throw error;
    return { gasto: data, error: null };
  } catch (error) {
    return { gasto: null, error: normalizarError(error) };
  }
}
