import { obtenerSupabase } from "../api/cliente.js";
import { normalizarError } from "../api/errores-de-supabase.js";
import { esLoteEntregable } from "./lotes.validaciones.js";

/**
 * Consulta la lista de movimientos de inventario aplicando filtros opcionales.
 */
export async function listarMovimientos({
  tipo,
  estado,
  bodega_id,
  jornada_id,
  fecha_inicio,
  fecha_fin,
} = {}) {
  try {
    const supabase = obtenerSupabase();
    let query = supabase.from("movimientos_inventario").select(`
      *,
      lote:lotes(*, medicamento:medicamentos(*)),
      bodega:bodegas(*)
    `);

    if (tipo) query = query.eq("tipo", tipo);
    if (estado) query = query.eq("estado", estado);
    if (bodega_id) query = query.eq("bodega_id", bodega_id);
    if (jornada_id) query = query.eq("jornada_id", jornada_id);
    if (fecha_inicio) query = query.gte("created_at", fecha_inicio);
    if (fecha_fin) query = query.lte("created_at", fecha_fin);

    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) throw error;

    return { datos: data || [], error: null };
  } catch (error) {
    return normalizarError(error);
  }
}

/**
 * Registra un ingreso de medicamentos (compra o donación). Crea el lote si no existe.
 */
export async function registrarIngreso({
  origen,
  bodega_id,
  medicamento_id,
  lote_id,
  numero_lote,
  fecha_vencimiento,
  cantidad,
  motivo,
  jornada_id,
}) {
  try {
    if (!["compra", "donacion"].includes(origen)) {
      return {
        datos: null,
        error: { mensaje: "El origen del ingreso debe ser 'compra' o 'donacion'." },
      };
    }

    if (!cantidad || cantidad <= 0) {
      return {
        datos: null,
        error: { mensaje: "La cantidad ingresada debe ser mayor a cero." },
      };
    }

    const supabase = obtenerSupabase();
    let idLoteFinal = lote_id;

    // Si no se proporciona un lote existente, se crea un lote nuevo
    if (!idLoteFinal) {
      if (!numero_lote || !fecha_vencimiento) {
        return {
          datos: null,
          error: { mensaje: "Se requiere numero de lote y fecha de vencimiento para crear un nuevo lote." },
        };
      }

      const { data: nuevoLote, error: errorLote } = await supabase
        .from("lotes")
        .insert({
          medicamento_id,
          numero_lote,
          fecha_vencimiento,
          cantidad_disponible: 0,
        })
        .select()
        .single();

      if (errorLote) throw errorLote;
      idLoteFinal = nuevoLote.id;
    }

    // Registrar el movimiento SIN enviar campo de estado (lo gestiona el trigger de la BD)
    const { data, error } = await supabase
      .from("movimientos_inventario")
      .insert({
        tipo: "ingreso",
        origen,
        bodega_id,
        lote_id: idLoteFinal,
        cantidad,
        motivo,
        jornada_id,
      })
      .select()
      .single();

    if (error) throw error;
    return { datos: data, error: null };
  } catch (error) {
    return normalizarError(error);
  }
}

/**
 * Registra una salida de medicamentos previa validación de disponibilidad y fecha de vencimiento.
 */
export async function registrarSalida({
  bodega_id,
  lote_id,
  cantidad,
  motivo,
  jornada_id,
}) {
  try {
    if (!cantidad || cantidad <= 0) {
      return {
        datos: null,
        error: { mensaje: "La cantidad a retirar debe ser mayor a cero." },
      };
    }

    const supabase = obtenerSupabase();

    // Validar lote existente, disponibilidad y vencimiento
    const { data: lote, error: errorLote } = await supabase
      .from("lotes")
      .select("*")
      .eq("id", lote_id)
      .single();

    if (errorLote || !lote) {
      return { datos: null, error: { mensaje: "El lote especificado no existe." } };
    }

    if (!esLoteEntregable(lote)) {
      return {
        datos: null,
        error: { mensaje: "No se puede registrar salida de un lote vencido." },
      };
    }

    if (lote.cantidad_disponible < cantidad) {
      return {
        datos: null,
        error: { mensaje: "La cantidad solicitada supera la existencia disponible del lote." },
      };
    }

    // Registrar la salida SIN enviar el estado
    const { data, error } = await supabase
      .from("movimientos_inventario")
      .insert({
        tipo: "salida",
        bodega_id,
        lote_id,
        cantidad,
        motivo,
        jornada_id,
      })
      .select()
      .single();

    if (error) throw error;
    return { datos: data, error: null };
  } catch (error) {
    return normalizarError(error);
  }
}

/**
 * Edita un movimiento existente únicamente si se encuentra en estado 'pendiente_validacion'
 * y la modificación es realizada por la misma persona que lo registró.
 */
export async function editarMovimiento(idMovimiento, datosNuevos, usuarioActualId) {
  try {
    const supabase = obtenerSupabase();

    const { data: mov, error: errorConsultar } = await supabase
      .from("movimientos_inventario")
      .select("*")
      .eq("id", idMovimiento)
      .single();

    if (errorConsultar || !mov) {
      return { datos: null, error: { mensaje: "El movimiento no existe." } };
    }

    if (mov.estado !== "pendiente_validacion" && mov.estado !== "pendiente") {
      return {
        datos: null,
        error: { mensaje: "Solo se pueden editar movimientos en estado pendiente." },
      };
    }

    if (mov.creado_por && mov.creado_por !== usuarioActualId) {
      return {
        datos: null,
        error: { mensaje: "Solo el usuario que creo el movimiento puede editarlo." },
      };
    }

    const { data, error } = await supabase
      .from("movimientos_inventario")
      .update(datosNuevos)
      .eq("id", idMovimiento)
      .select()
      .single();

    if (error) throw error;
    return { datos: data, error: null };
  } catch (error) {
    return normalizarError(error);
  }
}

/**
 * Cancela un movimiento en estado pendiente.
 */
export async function cancelarMovimiento(idMovimiento, usuarioActualId) {
  return editarMovimiento(idMovimiento, { estado: "cancelado" }, usuarioActualId);
}