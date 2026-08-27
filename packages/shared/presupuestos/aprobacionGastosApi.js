/**
 * Normaliza los errores retornados por las operaciones.
 */
function normalizarError(error) {
  if (!error) return null;
  return {
    message: error.message || "Error al procesar la solicitud de gastos",
    details: error.details || null,
    code: error.code || "UNKNOWN_ERROR",
  };
}

/**
 * Obtiene la lista de gastos pendientes de aprobación ordenados por fecha.
 */
export async function listarGastosPendientes(client) {
  if (!client) {
    return { data: null, error: normalizarError(new Error("Cliente de Supabase no proporcionado")) };
  }

  try {
    const { data, error } = await client
      .from("gastos")
      .select("*")
      .eq("estado", "pendiente")
      .order("fecha", { ascending: true });

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error: normalizarError(error) };
  }
}

/**
 * Aprueba un gasto pendiente registrando el usuario y la fecha actual.
 * Al aprobar, actualiza los montos ejecutados en jornada y proyecto.
 */
export async function aprobarGasto({ gastoId, usuarioId }, client) {
  if (!gastoId || !usuarioId) {
    return {
      data: null,
      error: normalizarError(new Error("gastoId y usuarioId son requeridos")),
    };
  }

  if (!client) {
    return { data: null, error: normalizarError(new Error("Cliente de Supabase no proporcionado")) };
  }

  try {
    const timestamp = new Date().toISOString();

    const { data: gastoActualizado, error: errorGasto } = await client
      .from("gastos")
      .update({
        estado: "aprobado",
        aprobado_por: usuarioId,
        fecha_aprobacion: timestamp,
      })
      .eq("id", gastoId)
      .select()
      .single();

    if (errorGasto) throw errorGasto;

    if (gastoActualizado?.monto && typeof client.rpc === "function") {
      const { error: errorRpc } = await client.rpc(
        "actualizar_ejecutado_gastos",
        {
          p_gasto_id: gastoId,
          p_monto: gastoActualizado.monto,
          p_jornada_id: gastoActualizado.jornada_id || null,
          p_proyecto_id: gastoActualizado.proyecto_id || null,
        }
      );

      if (errorRpc && errorRpc.code !== "PGRST202") {
        console.warn("Advertencia al actualizar ejecutado:", errorRpc.message);
      }
    }

    return { data: gastoActualizado, error: null };
  } catch (error) {
    return { data: null, error: normalizarError(error) };
  }
}

/**
 * Rechaza un gasto pendiente exigiendo un motivo obligatorio.
 */
export async function rechazarGasto({ gastoId, usuarioId, motivo }, client) {
  if (!gastoId || !usuarioId) {
    return {
      data: null,
      error: normalizarError(new Error("gastoId y usuarioId son requeridos")),
    };
  }

  if (!motivo || !motivo.trim()) {
    return {
      data: null,
      error: normalizarError(new Error("El motivo de rechazo es obligatorio")),
    };
  }

  if (!client) {
    return { data: null, error: normalizarError(new Error("Cliente de Supabase no proporcionado")) };
  }

  try {
    const timestamp = new Date().toISOString();

    const { data, error } = await client
      .from("gastos")
      .update({
        estado: "rechazado",
        rechazado_por: usuarioId,
        motivo_rechazo: motivo.trim(),
        fecha_rechazo: timestamp,
      })
      .eq("id", gastoId)
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error: normalizarError(error) };
  }
}