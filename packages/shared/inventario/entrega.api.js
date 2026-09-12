import { obtenerSupabase } from "../api/cliente.js";
import { normalizarError } from "../api/errores-de-supabase.js";
import { ESTADOS_RECETA } from "../enums.js";

// recetas no tiene paciente_id ni atencion_id (00019): el paciente se alcanza por
// recetas -> consultas -> expedientes -> pacientes, y el punto de entrada por atencion es
// consultas.atencion_id (00018). numero_ficha vive en expedientes, no en pacientes (00009).
// "consultas" va sin alias en el select a proposito: el filtro de abajo (.eq("consultas.
// atencion_id", ...)) tiene que nombrar la misma relacion que el select, y !inner es lo que
// hace que ese filtro excluya filas de recetas (sin !inner solo filtraria el embed anidado).
const COLUMNAS_DE_LA_ENTREGA = [
  "id",
  "folio",
  "consultas!inner(atencionId:atencion_id, " +
    "expediente:expedientes(numeroFicha:numero_ficha, paciente:pacientes(nombres, apellidos)))",
  "detalle:receta_detalle(id, medicamentoId:medicamento_id, loteId:lote_id, " +
    "bodegaId:bodega_id, dosis, frecuencia, duracion, " +
    "cantidadEntregada:cantidad_entregada, cantidadAjustada:cantidad_ajustada, " +
    "medicamento:medicamentos(nombre), " +
    "lote:lotes(numeroLote:numero_lote, fechaVencimiento:fecha_vencimiento))",
].join(", ");

function aRecetaParaEntrega(fila) {
  const expediente = fila.consultas?.expediente ?? {};
  const paciente = expediente.paciente ?? {};

  return {
    id: fila.id,
    folio: fila.folio,
    pacienteNombre: [paciente.nombres, paciente.apellidos].filter(Boolean).join(" ") || null,
    numeroFicha: expediente.numeroFicha ?? null,
  };
}

function aDetalleParaEntrega(renglon, disponiblePorLote) {
  return {
    id: renglon.id,
    medicamentoId: renglon.medicamentoId,
    medicamento: renglon.medicamento?.nombre ?? "Medicamento desconocido",
    loteId: renglon.loteId ?? null,
    bodegaId: renglon.bodegaId ?? null,
    numeroLote: renglon.lote?.numeroLote ?? null,
    fechaVencimiento: renglon.lote?.fechaVencimiento ?? null,
    dosis: renglon.dosis,
    frecuencia: renglon.frecuencia,
    duracion: renglon.duracion,
    cantidadEntregada: renglon.cantidadEntregada,
    // NULL mientras nadie la corrija (fn_ajustar_entrega_receta, 00125, issue #764): en ese
    // caso cantidadEntregada sigue siendo la cifra vigente, ver cantidadRealEntregada() abajo.
    cantidadAjustada: renglon.cantidadAjustada ?? null,
    // Sin lote no hay fila de existencias que consultar: null (indeterminado), nunca 0, para
    // no leerse como "agotado" cuando en realidad es "no se eligio lote a esta receta" (00019,
    // receta_detalle.lote_id es nullable).
    cantidadDisponible: renglon.loteId ? (disponiblePorLote.get(renglon.loteId) ?? 0) : null,
  };
}

/**
 * Existencia disponible de cada lote, sumada entre bodegas.
 *
 * Mismo criterio que fn_generar_receta calcula inline en el servidor (00112):
 * SUM(cantidad_disponible) FROM existencias WHERE lote_id = ... — aqui hace falta para varios
 * lotes a la vez, uno por renglon de la receta.
 *
 * @param {string[]} loteIds
 * @returns {Promise<{ disponiblePorLote: Map<string, number>, error: object|null }>}
 */
async function obtenerDisponiblePorLote(loteIds) {
  const idsUnicos = [...new Set(loteIds.filter(Boolean))];
  if (idsUnicos.length === 0) return { disponiblePorLote: new Map(), error: null };

  try {
    const { data, error } = await obtenerSupabase()
      .from("existencias")
      .select("loteId:lote_id, cantidadDisponible:cantidad_disponible")
      .in("lote_id", idsUnicos);

    if (error) return { disponiblePorLote: new Map(), error: normalizarError(error) };

    const disponiblePorLote = new Map();
    for (const fila of data ?? []) {
      const acumulado = disponiblePorLote.get(fila.loteId) ?? 0;
      disponiblePorLote.set(fila.loteId, acumulado + Number(fila.cantidadDisponible ?? 0));
    }
    return { disponiblePorLote, error: null };
  } catch (error) {
    return { disponiblePorLote: new Map(), error: normalizarError(error) };
  }
}

/**
 * Receta emitida de una atencion, con su detalle y la existencia disponible de cada lote, para
 * la pantalla de entrega de medicamentos (issue #749).
 *
 * Llega al paciente por el camino real: recetas -> consultas (atencion_id) -> expedientes
 * (numero_ficha) -> pacientes. La cantidad disponible sale de `existencias`, nunca de
 * `lotes.cantidad_ingresada` (eso es lo que entro, no lo que queda).
 *
 * `error: null` con `receta: null` es un resultado valido (no hay receta emitida para esa
 * atencion, o RLS no le da acceso a quien consulta — las politicas de SELECT de `consultas`/
 * `recetas`/`receta_detalle`, 00033, solo alcanzan a medico y administrador). Es un estado
 * vacio, no un error: quien consuma esto no debe mostrar ErrorState en ese caso.
 *
 * @param {string} atencionId
 * @returns {Promise<{ receta: object|null, detalles: object[], error: object|null }>}
 */
export async function obtenerRecetaPorAtencion(atencionId) {
  if (!atencionId) return { receta: null, detalles: [], error: null };

  try {
    const { data, error } = await obtenerSupabase()
      .from("recetas")
      .select(COLUMNAS_DE_LA_ENTREGA)
      .eq("consultas.atencion_id", atencionId)
      .eq("estado", ESTADOS_RECETA.EMITIDA)
      .order("created_at", { ascending: false });

    if (error) return { receta: null, detalles: [], error: normalizarError(error) };

    const fila = (data ?? [])[0];
    if (!fila) return { receta: null, detalles: [], error: null };

    const renglones = fila.detalle ?? [];
    const { disponiblePorLote, error: errorExistencias } = await obtenerDisponiblePorLote(
      renglones.map((renglon) => renglon.loteId),
    );
    if (errorExistencias) return { receta: null, detalles: [], error: errorExistencias };

    return {
      receta: aRecetaParaEntrega(fila),
      detalles: renglones.map((renglon) => aDetalleParaEntrega(renglon, disponiblePorLote)),
      error: null,
    };
  } catch (error) {
    return { receta: null, detalles: [], error: normalizarError(error) };
  }
}

/**
 * Corrige la cantidad realmente entregada de un renglon de receta (issue #764), sin volver a
 * descontar el inventario por el total: fn_ajustar_entrega_receta (migracion 00125) calcula la
 * diferencia contra el ultimo valor confirmado y registra un movimiento solo por esa diferencia.
 *
 * No reescribe cantidadEntregada en el cliente ni en la base: el renglon devuelto por
 * obtenerRecetaPorAtencion() sigue trayendo cantidadAjustada aparte, que quien consuma esto
 * tiene que preferir sobre cantidadEntregada cuando no sea null (ver cantidadRealEntregada() en
 * useEntregaMedicamentos.js).
 *
 * @param {string} recetaDetalleId
 * @param {number} cantidadReal
 * @returns {Promise<{ error: object|null }>}
 */
export async function ajustarEntregaReceta(recetaDetalleId, cantidadReal) {
  try {
    const { error } = await obtenerSupabase().rpc("fn_ajustar_entrega_receta", {
      p_receta_detalle_id: recetaDetalleId,
      p_cantidad_real: cantidadReal,
    });

    if (error) return { error: normalizarError(error) };
    return { error: null };
  } catch (error) {
    return { error: normalizarError(error) };
  }
}
