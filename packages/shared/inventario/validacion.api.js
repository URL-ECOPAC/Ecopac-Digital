import { obtenerSupabase } from "../api/cliente.js";
import { normalizarError } from "../api/errores-de-supabase.js";

/**
 * Aprueba un movimiento de inventario pendiente y actualiza las existencias del lote.
 */
export async function aprobarMovimiento(idMovimiento, { usuarioId, rolUsuario }) {
  try {
    if (rolUsuario !== "administrador") {
      return {
        datos: null,
        error: { mensaje: "Operacion exclusiva para el rol Administrador." },
      };
    }

    const supabase = obtenerSupabase();

    const { data: mov, error: errorMov } = await supabase
      .from("movimientos_inventario")
      .select("*, lote:lotes(*)")
      .eq("id", idMovimiento)
      .single();

    if (errorMov || !mov) {
      return { datos: null, error: { mensaje: "El movimiento especificado no existe." } };
    }

    if (mov.estado !== "pendiente_validacion" && mov.estado !== "pendiente") {
      return { datos: null, error: { mensaje: "El movimiento no está pendiente de aprobación." } };
    }

    // Regla de integridad: Un usuario no puede aprobar un movimiento registrado por él mismo
    if (mov.creado_por && mov.creado_por === usuarioId) {
      return {
        datos: null,
        error: { mensaje: "No puedes aprobar un movimiento registrado por ti mismo." },
      };
    }

    const lote = mov.lote;
    if (!lote) {
      return { datos: null, error: { mensaje: "El lote asociado al movimiento no existe." } };
    }

    // Si es una salida, validar stock suficiente antes de descontar
    if (mov.tipo === "salida") {
      if (lote.cantidad_disponible < mov.cantidad) {
        return {
          datos: null,
          error: { mensaje: "Stock insuficiente para aprobar esta salida." },
        };
      }
    }

    // Calcular nueva existencia oficial del lote
    const nuevaCantidad =
      mov.tipo === "ingreso"
        ? lote.cantidad_disponible + mov.cantidad
        : lote.cantidad_disponible - mov.cantidad;

    const { error: errorLote } = await supabase
      .from("lotes")
      .update({ cantidad_disponible: nuevaCantidad })
      .eq("id", lote.id);

    if (errorLote) throw errorLote;

    // Marcar el movimiento como aprobado
    const { data: movAprobado, error: errorUpdateMov } = await supabase
      .from("movimientos_inventario")
      .update({
        estado: "aprobado",
        aprobado_por: usuarioId,
        fecha_aprobacion: new Date().toISOString(),
      })
      .eq("id", idMovimiento)
      .select()
      .single();

    if (errorUpdateMov) throw errorUpdateMov;

    return { datos: movAprobado, error: null };
  } catch (error) {
    return normalizarError(error);
  }
}

/**
 * Rechaza un movimiento de inventario pendiente sin alterar existencias. Exige motivo.
 */
export async function rechazarMovimiento(idMovimiento, { motivo, usuarioId, rolUsuario }) {
  try {
    if (rolUsuario !== "administrador") {
      return {
        datos: null,
        error: { mensaje: "Operacion exclusiva para el rol Administrador." },
      };
    }

    if (!motivo || !motivo.trim()) {
      return {
        datos: null,
        error: { mensaje: "Se requiere un motivo explícito para rechazar el movimiento." },
      };
    }

    const supabase = obtenerSupabase();

    const { data: mov, error: errorMov } = await supabase
      .from("movimientos_inventario")
      .select("*")
      .eq("id", idMovimiento)
      .single();

    if (errorMov || !mov) {
      return { datos: null, error: { mensaje: "El movimiento especificado no existe." } };
    }

    if (mov.estado !== "pendiente_validacion" && mov.estado !== "pendiente") {
      return { datos: null, error: { mensaje: "El movimiento no está pendiente." } };
    }

    if (mov.creado_por && mov.creado_por === usuarioId) {
      return {
        datos: null,
        error: { mensaje: "No puedes rechazar un movimiento registrado por ti mismo." },
      };
    }

    const { data: movRechazado, error: errorUpdate } = await supabase
      .from("movimientos_inventario")
      .update({
        estado: "rechazado",
        motivo_rechazo: motivo,
        aprobado_por: usuarioId,
        fecha_aprobacion: new Date().toISOString(),
      })
      .eq("id", idMovimiento)
      .select()
      .single();

    if (errorUpdate) throw errorUpdate;

    return { datos: movRechazado, error: null };
  } catch (error) {
    return normalizarError(error);
  }
}

/**
 * Aprueba múltiples movimientos en lote, indicando cuáles fallaron y la razón.
 */
export async function aprobarMovimientosEnLote(idsMovimientos, contextoUsuario) {
  const aprobados = [];
  const fallidos = [];

  for (const id of idsMovimientos) {
    const res = await aprobarMovimiento(id, contextoUsuario);
    if (res.error) {
      fallidos.push({ id, motivo: res.error.mensaje });
    } else {
      aprobados.push(res.datos);
    }
  }

  return { datos: { aprobados, fallidos }, error: null };
}