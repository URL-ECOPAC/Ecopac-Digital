import { obtenerSupabase } from "../api/cliente.js";
import { normalizarError } from "../api/errores-de-supabase.js";
import { esAdministrador } from "../usuarios/roles.js";
import { ESTADOS_MOVIMIENTO, TIPOS_DE_MOVIMIENTO } from "../enums.js";

/**
 * Aprueba un movimiento de inventario pendiente.
 *
 * El ajuste de existencias.cantidad_disponible no lo hace este cliente: lo hace
 * tr_actualizar_existencias (BEFORE UPDATE, 00047) al ver que estado paso a 'aprobado'.
 * Escribirlo aqui lo duplicaria -el trigger no sabe que el cliente ya ajusto, asi que
 * ajustaria una segunda vez.
 *
 * Sin la restriccion "no puedes aprobar lo que tu mismo registraste": la 00048 (issue #410)
 * la quito a proposito de la politica RLS, porque la 00028 ya deja nacer aprobado cualquier
 * movimiento que registre un administrador (auto-aprobacion, sin excepcion) y mantenerla solo
 * en el UPDATE manual era una restriccion a medias. La trazabilidad sigue viva en
 * registrado_por/aprobado_por/aprobado_en y en eventos_auditoria (00026).
 */
export async function aprobarMovimiento(idMovimiento, { usuarioId, rolUsuario }) {
  try {
    if (!esAdministrador(rolUsuario)) {
      return {
        datos: null,
        error: { mensaje: "Operacion exclusiva para el rol Administrador." },
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

    if (mov.estado !== ESTADOS_MOVIMIENTO.PENDIENTE) {
      return { datos: null, error: { mensaje: "El movimiento no está pendiente de aprobación." } };
    }

    // Si es una salida, validar existencia suficiente antes de aprobar. Es una validacion de
    // experiencia de usuario: la garantia real la da fn_aplicar_ajuste_existencias (00047), que
    // vuelve a comprobarlo y rechaza la aprobacion si no alcanza.
    if (mov.tipo === TIPOS_DE_MOVIMIENTO.SALIDA) {
      const { data: existencia } = await supabase
        .from("existencias")
        .select("cantidad_disponible")
        .eq("lote_id", mov.lote_id)
        .eq("bodega_id", mov.bodega_id)
        .maybeSingle();

      const disponible = existencia?.cantidad_disponible ?? 0;
      if (disponible < mov.cantidad) {
        return {
          datos: null,
          error: { mensaje: "Stock insuficiente para aprobar esta salida." },
        };
      }
    }

    // Marcar el movimiento como aprobado; el trigger ajusta existencias.
    const { data: movAprobado, error: errorUpdateMov } = await supabase
      .from("movimientos_inventario")
      .update({
        estado: ESTADOS_MOVIMIENTO.APROBADO,
        aprobado_por: usuarioId,
        aprobado_en: new Date().toISOString(),
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
 *
 * motivo_rechazo (00084) es la columna que faltaba; sin ella esta operacion fallaba siempre
 * con 42703 (issue #491, mismo defecto que #490 en gastos).
 */
export async function rechazarMovimiento(idMovimiento, { motivo, usuarioId, rolUsuario }) {
  try {
    if (!esAdministrador(rolUsuario)) {
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

    if (mov.estado !== ESTADOS_MOVIMIENTO.PENDIENTE) {
      return { datos: null, error: { mensaje: "El movimiento no está pendiente." } };
    }

    const { data: movRechazado, error: errorUpdate } = await supabase
      .from("movimientos_inventario")
      .update({
        estado: ESTADOS_MOVIMIENTO.RECHAZADO,
        motivo_rechazo: motivo.trim(),
        aprobado_por: usuarioId,
        aprobado_en: new Date().toISOString(),
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
