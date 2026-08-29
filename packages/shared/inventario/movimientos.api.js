import { obtenerSupabase } from "../api/cliente.js";
import { normalizarError } from "../api/errores-de-supabase.js";
import { esLoteEntregable } from "./lotes.validaciones.js";

/**
 * Consulta la lista de movimientos de inventario aplicando filtros opcionales.
 *
 * No hay filtro por jornada: un movimiento cuelga de una bodega (bodega_id), no de una
 * jornada (issue #491). El botiquin de una jornada es jornadas.botiquin_bodega_id (00036);
 * quien necesite "movimientos del botiquin de esta jornada" resuelve ese id primero y filtra
 * por bodega_id aqui.
 */
export async function listarMovimientos({
  tipo,
  estado,
  bodega_id,
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
 *
 * `origen` solo valida la intencion de quien llama (compra/donacion): movimientos_inventario
 * no tiene esa columna, la procedencia se reconstruye siguiendo lote_id hasta donacion_detalle
 * (packages/shared/donaciones/ingreso.api.js, issue #192) o hasta un proveedor de compra.
 *
 * El ajuste de existencias no lo hace este cliente: lo hace tr_autoaprobar_movimiento_inventario
 * (00028/00047) si quien registra es administrador -el movimiento nace ya 'aprobado'-, o
 * tr_actualizar_existencias cuando alguien lo aprueba despues (validacion.api.js). Escribir
 * existencias.cantidad_disponible aqui lo duplicaria.
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
  usuarioId,
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

    if (!usuarioId) {
      return {
        datos: null,
        error: { mensaje: "Se requiere el usuario que registra el movimiento." },
      };
    }

    const supabase = obtenerSupabase();
    let idLoteFinal = lote_id;

    // Si no se proporciona un lote existente, se crea un lote nuevo. lotes no tiene columna
    // de cantidad desde la 00047 (issue #369): la cantidad vive en existencias, particionada
    // por (lote_id, bodega_id), y la crea/ajusta el trigger al aprobar el movimiento.
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
        })
        .select()
        .single();

      if (errorLote) throw errorLote;
      idLoteFinal = nuevoLote.id;
    }

    // Registrar el movimiento SIN enviar campo de estado (lo gestiona el trigger de la BD).
    // registrado_por es NOT NULL y sin default (00023): la politica RLS de INSERT para
    // medico/voluntario exige ademas que sea exactamente auth.uid() (00034).
    const { data, error } = await supabase
      .from("movimientos_inventario")
      .insert({
        tipo: "ingreso",
        bodega_id,
        lote_id: idLoteFinal,
        cantidad,
        motivo,
        registrado_por: usuarioId,
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
  usuarioId,
}) {
  try {
    if (!cantidad || cantidad <= 0) {
      return {
        datos: null,
        error: { mensaje: "La cantidad a retirar debe ser mayor a cero." },
      };
    }

    if (!usuarioId) {
      return {
        datos: null,
        error: { mensaje: "Se requiere el usuario que registra el movimiento." },
      };
    }

    const supabase = obtenerSupabase();

    // Validar lote existente y vencimiento. La cantidad disponible vive en existencias, no
    // en lotes (00047): se consulta aparte, filtrada por lote y bodega.
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

    const { data: existencia } = await supabase
      .from("existencias")
      .select("cantidad_disponible")
      .eq("lote_id", lote_id)
      .eq("bodega_id", bodega_id)
      .maybeSingle();

    // Sin fila de existencias para esa combinacion (lote, bodega) es lo mismo que stock 0,
    // mismo criterio que fn_aplicar_ajuste_existencias (00047).
    const disponible = existencia?.cantidad_disponible ?? 0;
    if (disponible < cantidad) {
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
        registrado_por: usuarioId,
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
 * Edita un movimiento existente únicamente si se encuentra en estado 'pendiente'
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

    if (mov.estado !== "pendiente") {
      return {
        datos: null,
        error: { mensaje: "Solo se pueden editar movimientos en estado pendiente." },
      };
    }

    if (mov.registrado_por && mov.registrado_por !== usuarioActualId) {
      return {
        datos: null,
        error: { mensaje: "Solo el usuario que registro el movimiento puede editarlo." },
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
