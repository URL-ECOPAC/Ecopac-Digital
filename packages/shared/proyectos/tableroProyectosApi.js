import { cambiarEstadoProyecto } from "./api.js";
import { transicionesDeProyectoDesde } from "./validaciones.js"; // O la exportación centralizada en index.js

/**
 * Normaliza los errores para respuestas uniformes.
 */
function normalizarError(error) {
  if (!error) return null;
  return {
    message: error.message || "Error al procesar la solicitud en el tablero",
    details: error.details || null,
    code: error.code || "UNKNOWN_ERROR",
  };
}

/**
 * Obtiene los proyectos agrupados por etapa con el conteo por columna.
 */
export async function obtenerProyectosTablero(client) {
  if (!client) {
    return { data: null, error: normalizarError(new Error("Cliente de Supabase no proporcionado")) };
  }

  try {
    const { data, error } = await client
      .from("proyectos")
      .select("*")
      .order("orden_columna", { ascending: true });

    if (error) throw error;

    const columnas = (data || []).reduce((acc, proyecto) => {
      const etapa = proyecto.etapa || "sin_etapa";
      if (!acc[etapa]) {
        acc[etapa] = {
          etapa,
          total: 0,
          proyectos: [],
        };
      }
      acc[etapa].proyectos.push(proyecto);
      acc[etapa].total += 1;
      return acc;
    }, {});

    return { data: columnas, error: null };
  } catch (error) {
    return { data: null, error: normalizarError(error) };
  }
}

/**
 * Mueve un proyecto a otra etapa delegando la validación en la primitiva cambiarEstadoProyecto.
 */
export async function moverProyectoAEtapa({ proyectoId, nuevaEtapa, usuarioRol }, client) {
  if (usuarioRol !== "Administrador") {
    return {
      data: null,
      error: normalizarError(new Error("Solo Administrador puede cambiar la etapa de un proyecto")),
    };
  }

  // Se delega a la primitiva que ya valida el trigger y transiciones permitidas
  const resultado = await cambiarEstadoProyecto({ id: proyectoId, nuevoEstado: nuevaEtapa }, client);
  return resultado;
}

/**
 * Reordena tarjetas dentro de una etapa actualizando `orden_columna`.
 */
export async function reordenarProyectosColumna({ ordenamiento, usuarioRol }, client) {
  if (usuarioRol !== "Administrador") {
    return {
      data: null,
      error: normalizarError(new Error("Solo Administrador puede reordenar proyectos")),
    };
  }

  if (!Array.isArray(ordenamiento) || ordenamiento.length === 0) {
    return {
      data: null,
      error: normalizarError(new Error("Se requiere una lista de ordenamiento válida")),
    };
  }

  if (!client) {
    return { data: null, error: normalizarError(new Error("Cliente de Supabase no proporcionado")) };
  }

  try {
    for (const item of ordenamiento) {
      const { error } = await client
        .from("proyectos")
        .update({ orden_columna: item.orden_columna })
        .eq("id", item.id);

      if (error) throw error;
    }

    return { data: { exito: true }, error: null };
  } catch (error) {
    return { data: null, error: normalizarError(error) };
  }
}

/**
 * Retorna las transiciones permitidas para guiar el UI del tablero.
 */
export function obtenerTransicionesPermitidas(estadoActual) {
  return transicionesDeProyectoDesde(estadoActual);
}