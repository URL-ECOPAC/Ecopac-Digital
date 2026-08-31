import { obtenerSupabase } from "../api/cliente.js";
import { normalizarError } from "../api/errores-de-supabase.js";
import { esLoteEntregable } from "./lotes.validaciones.js";
import { ESTADOS_MOVIMIENTO, ORIGENES_DE_LOTE, TIPOS_DE_MOVIMIENTO } from "../enums.js";

/**
 * Consulta la lista de movimientos de inventario aplicando filtros opcionales.
 *
 * No hay filtro por jornada: un movimiento cuelga de una bodega (bodega_id), no de una
 * jornada (issue #491). El botiquin de una jornada es jornadas.botiquin_bodega_id (00036);
 * quien necesite "movimientos del botiquin de esta jornada" resuelve ese id primero y filtra
 * por bodega_id aqui.
 */
export async function listarMovimientos({ tipo, estado, bodega_id, fecha_inicio, fecha_fin } = {}) {
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
    // Lista vacia y no null: quien la consume la recorre, y un null aqui convertiria un error
    // de lectura en un TypeError lejos de donde ocurrio. Mismo criterio que obtenerCola()
    // (atenciones/api.js), que ante un error devuelve la forma vacia junto al error.
    return { datos: [], error: normalizarError(error) };
  }
}

/**
 * Registra un ingreso de medicamentos (compra o donación). Crea el lote si no existe.
 *
 * `origen` no viaja a movimientos_inventario, que no tiene esa columna: es `lotes.origen` del
 * lote que se crea. La procedencia de un lote que ya existia se reconstruye siguiendo lote_id
 * hasta donacion_detalle (packages/shared/donaciones/ingreso.api.js, issue #192) o hasta su
 * proveedor de compra.
 *
 * `proveedor_id` solo hace falta cuando hay que crear el lote, y entonces es obligatorio:
 * `lotes.proveedor_id` es NOT NULL sin DEFAULT (00020). Mismo caso que `origen` y
 * `cantidad_ingresada`. Hasta la issue #222 esta funcion insertaba el lote con tres columnas y
 * ninguna de esas tres, asi que **crear un lote nuevo fallaba siempre** con 23502 y se llevaba
 * por delante el ingreso de donaciones completo, que es el unico camino que llega aqui sin
 * lote_id. Es el mismo defecto que ya habia corregido `registrarGasto()` (issue #300) y por la
 * misma razon: las pruebas con doble de Supabase no lo ven porque el doble acepta cualquier
 * INSERT. Lo caza pruebas/e2e/inventario-validacion.e2e.test.js, contra la base real.
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
  proveedor_id,
  cantidad,
  motivo,
  usuarioId,
}) {
  try {
    if (!Object.values(ORIGENES_DE_LOTE).includes(origen)) {
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
          error: {
            mensaje: "Se requiere numero de lote y fecha de vencimiento para crear un nuevo lote.",
          },
        };
      }

      if (!proveedor_id) {
        return {
          datos: null,
          error: {
            mensaje: "Se requiere el proveedor de procedencia para crear un nuevo lote.",
          },
        };
      }

      const { data: nuevoLote, error: errorLote } = await supabase
        .from("lotes")
        .insert({
          medicamento_id,
          numero_lote,
          fecha_vencimiento,
          proveedor_id,
          origen,
          // La cantidad con la que nace el lote es la del ingreso que lo crea. No se confunde
          // con existencias.cantidad_disponible, que es lo que queda hoy y por bodega: esta
          // columna es el historico de cuanto entro (00047, issue #369).
          cantidad_ingresada: cantidad,
          // Un medico o un voluntario si pueden dar de alta el lote de su ingreso, pero la
          // politica de la 00107 les exige atribuirselo (registrado_por = auth.uid()) y que
          // nazca provisional. `confirmado` no se envia: su DEFAULT es FALSE y mandarlo desde
          // el cliente invitaria a mandarlo en TRUE. Lo pone en TRUE la aprobacion del ingreso,
          // dentro de fn_aplicar_ajuste_existencias.
          registrado_por: usuarioId,
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
        tipo: TIPOS_DE_MOVIMIENTO.INGRESO,
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
    return { datos: null, error: normalizarError(error) };
  }
}

/**
 * Registra una salida de medicamentos previa validación de disponibilidad y fecha de vencimiento.
 */
export async function registrarSalida({ bodega_id, lote_id, cantidad, motivo, usuarioId }) {
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
        tipo: TIPOS_DE_MOVIMIENTO.SALIDA,
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
    return { datos: null, error: normalizarError(error) };
  }
}

/**
 * Edita un movimiento existente únicamente si se encuentra en estado 'pendiente'
 * y la modificación es realizada por la misma persona que lo registró.
 *
 * Hasta la issue #625 esto era falso para todo el mundo menos la administradora: la politica de
 * UPDATE (00048/00086) solo admitia es_administrador() o tiene_permiso('inventario.aprobar'), asi
 * que el UPDATE de un medico o un voluntario no alcanzaba ninguna fila y PostgREST devolvia exito
 * sin haber cambiado nada. La 00106 puso la politica de acuerdo con lo que este comentario ya
 * prometia, de modo que las dos comprobaciones de aqui abajo dejaron de ser la unica barrera y
 * pasaron a ser lo que deben ser: un mensaje mejor que el de la base.
 *
 * Lo que esta funcion NO puede hacer, aunque le pasen esos campos, es aprobar: la politica exige
 * `estado = 'pendiente'` tambien en la fila nueva, y fn_proteger_decision_de_movimiento (00106)
 * rechaza que quien registro toque aprobado_por, aprobado_en, motivo_rechazo o
 * aprobacion_automatica. Aprobar y rechazar viven en validacion.api.js.
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

    if (mov.estado !== ESTADOS_MOVIMIENTO.PENDIENTE) {
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
    return { datos: null, error: normalizarError(error) };
  }
}

// AQUI ESTABA cancelarMovimiento(), BORRADA POR LA ISSUE #617
//
// Escribia el literal 'cancelado' en movimientos_inventario.estado, y el enum estado_movimiento
// solo tiene 'pendiente', 'aprobado' y 'rechazado' (00023). Postgres rechazaba el UPDATE con
// 22P02, asi que la operacion nunca pudo funcionar. No la llamaba nadie: era codigo muerto.
//
// Se borra en vez de agregar 'cancelado' al enum porque cancelar no es una operacion del dominio:
// ni docs/PERMISOS.md ni la bandeja de validacion (issue #158) la contemplan -- ahi la
// administradora aprueba o rechaza, y nada mas. Tampoco se mapea a RECHAZADO: rechazar es la
// decision de quien valida y cancelar seria la de quien registro, y hacerlas pasar por la misma
// falsearia la trazabilidad de aprobado_por.
//
// Si algun dia se necesita que quien registro pueda retirar su propio movimiento pendiente, es una
// funcionalidad a disenar entera: valor nuevo en el enum via migracion, politica RLS que lo
// permita -- la de UPDATE de hoy solo admite administrador o `inventario.aprobar` (00086) -- y su
// fila en la matriz de permisos.
