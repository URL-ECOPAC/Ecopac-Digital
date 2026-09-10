import { obtenerSupabase } from "../api/cliente.js";
import { normalizarError } from "../api/errores-de-supabase.js";
import { esLoteEntregable } from "./lotes.validaciones.js";

const COLUMNAS_DEL_RENGLON = [
  "id",
  "medicamentoId:medicamento_id",
  "cantidadEntregada:cantidad_entregada",
  "dosis",
  "frecuencia",
  "duracion",
  "medicamento:medicamentos(nombre)",
  "lote:lotes(numeroLote:numero_lote, fechaVencimiento:fecha_vencimiento, existencias(cantidadDisponible:cantidad_disponible))",
  "receta:recetas!inner(id, folio, consulta:consultas!inner(atencionId:atencion_id))",
].join(", ");

/**
 * Traduce una fila de receta_detalle (con sus embebidos) al renglon que la pantalla de entrega
 * necesita. Se exporta aparte de obtenerDetalleDeEntrega() para poder probar la traduccion sin
 * tocar la base (issue #759).
 *
 * @param {object} fila
 */
export function aRenglonDeEntrega(fila) {
  const lote = fila.lote ?? {};
  const existenciaTotal = (lote.existencias ?? []).reduce(
    (total, existencia) => total + Number(existencia.cantidadDisponible ?? 0),
    0,
  );

  return {
    id: fila.id,
    medicamentoId: fila.medicamentoId,
    medicamento: fila.medicamento?.nombre ?? "Medicamento",
    dosis: fila.dosis,
    frecuencia: fila.frecuencia,
    duracion: fila.duracion,
    cantidad_recetada: fila.cantidadEntregada,
    existencias: existenciaTotal,
    fechaVencimiento: lote.fechaVencimiento ?? null,
    vencido: !esLoteEntregable({ fechaVencimiento: lote.fechaVencimiento }),
  };
}

/**
 * Renglones de la receta que corresponden a una atencion, para el puesto de entrega en campo
 * (issue #164 / #759).
 *
 * QUE ESTABA MAL ANTES. La version anterior, escrita directamente en el hook de la pantalla,
 * pedia columnas que no existen en el esquema: recetas.paciente_id y recetas.atencion_id (el
 * paciente y la atencion se llegan via consultas y expedientes, no son columnas propias de
 * recetas), lotes.vencimiento (la columna real es fecha_vencimiento) y lotes.cantidad_actual
 * (el stock vive en existencias.cantidad_disponible, particionado por lote y bodega, no es una
 * columna de lotes). La consulta fallaba siempre con PGRST108. El filtro de aqui abajo usa el
 * mismo criterio que ya corrige obtenerRecetas() (recetas.api.js, mismo issue): filtrar por el
 * alias que declara el select (receta.consulta.atencion_id), no por el nombre de la tabla.
 *
 * @param {string} atencionId UUID de la atencion.
 * @returns {Promise<{ detalle: object[], error: object|null }>}
 */
export async function obtenerDetalleDeEntrega(atencionId) {
  if (!atencionId) return { detalle: [], error: null };

  try {
    const { data, error } = await obtenerSupabase()
      .from("receta_detalle")
      .select(COLUMNAS_DEL_RENGLON)
      .eq("receta.consulta.atencion_id", atencionId);

    if (error) return { detalle: [], error: normalizarError(error) };
    return { detalle: (data ?? []).map(aRenglonDeEntrega), error: null };
  } catch (error) {
    return { detalle: [], error: normalizarError(error) };
  }
}
