// Reporte de medicamentos proximos a vencer, con horizonte configurable (issue #204, RF-33).
//
// Misma tabla y mismos embebidos que obtenerReporteDeInventario (reportes/inventario.api.js):
// se consulta `existencias`, no una vista que ya excluya lo vencido, porque este reporte
// necesita justamente poder mostrar lo vencido (RF-19: darlo de baja). A diferencia de ese
// reporte, aqui no se agrupa por medicamento -- el criterio de aceptacion pide un renglon por
// combinacion de lote y bodega, con su propio dia de vencimiento.
//
// ESTADOS_DE_VENCIMIENTO se reusa de inventario.api.js en vez de inventar un flag nuevo: es el
// mismo concepto (vigente/vencido/todos) que ya resuelve ese reporte.
//
// Las politicas RLS de la 00034 sobre `existencias` filtran solas lo que cada rol puede ver, el
// mismo criterio que documenta reportes/permisos.js para obtenerReporteDeInventario: no se
// agrega aqui un guard de rol que esta issue no pidio.

import { obtenerSupabase } from "../api/cliente.js";
import { normalizarError } from "../api/errores-de-supabase.js";
import { diasHastaVencimiento } from "../formato/fechas.js";
import { ESTADOS_DE_VENCIMIENTO } from "./inventario.api.js";

export { ESTADOS_DE_VENCIMIENTO };

/** Horizonte por defecto cuando la pantalla todavia no eligio uno: la alerta operativa a un mes (RF-33). */
export const HORIZONTE_POR_DEFECTO_EN_DIAS = 30;

const COLUMNAS_DEL_REPORTE = [
  "id",
  "cantidadDisponible:cantidad_disponible",
  "bodegaId:bodega_id",
  "bodega:bodegas!inner(nombre)",
  "lote:lotes!inner(id, numeroLote:numero_lote, fechaVencimiento:fecha_vencimiento, medicamentoId:medicamento_id, medicamento:medicamentos!inner(nombre, concentracion, presentacion, marca))",
].join(", ");

function aRenglon(fila, hoy) {
  const lote = fila.lote ?? {};
  const medicamento = lote.medicamento ?? {};
  const fechaVencimiento = lote.fechaVencimiento ?? null;

  return {
    medicamentoId: lote.medicamentoId ?? null,
    medicamento: medicamento.nombre ?? null,
    concentracion: medicamento.concentracion ?? null,
    presentacion: medicamento.presentacion ?? null,
    marca: medicamento.marca ?? null,
    loteId: lote.id ?? null,
    numeroLote: lote.numeroLote ?? null,
    fechaVencimiento,
    bodegaId: fila.bodegaId ?? null,
    bodega: fila.bodega?.nombre ?? null,
    cantidad: Number(fila.cantidadDisponible ?? 0),
    diasRestantes: diasHastaVencimiento(fechaVencimiento, hoy),
  };
}

/** Filtro sobre diasRestantes segun el estado pedido; horizonteDias solo limita lo vigente. */
function perteneceAlReporte(diasRestantes, horizonteDias, estadoDeVencimiento) {
  if (diasRestantes === null) return false;

  if (estadoDeVencimiento === ESTADOS_DE_VENCIMIENTO.VENCIDOS) return diasRestantes < 0;
  if (estadoDeVencimiento === ESTADOS_DE_VENCIMIENTO.VIGENTES) {
    return diasRestantes >= 0 && diasRestantes <= horizonteDias;
  }
  // TODOS: lo vencido no tiene piso, lo vigente se limita igual que arriba al horizonte.
  return diasRestantes <= horizonteDias;
}

/**
 * Medicamentos proximos a vencer (o ya vencidos), con horizonte configurable.
 *
 * Un renglon por combinacion de lote y bodega -- el mismo grano que `existencias` -- con el
 * medicamento, la cantidad disponible, la fecha de vencimiento y los dias restantes ya
 * calculados (negativo si ya vencio). El resultado sale ordenado por dias restantes ascendente,
 * igual criterio que listarAlertas() en inventario/alertas.api.js: lo mas urgente primero.
 *
 * @param {object} [filtros]
 * @param {number} [filtros.horizonteDias] Dias hacia adelante a considerar "proximo a vencer".
 * @param {string} [filtros.bodega] UUID de bodega.
 * @param {string} [filtros.medicamento] UUID de medicamento.
 * @param {string} [filtros.estadoDeVencimiento] Uno de ESTADOS_DE_VENCIMIENTO; por defecto VIGENTES.
 * @param {Date} [hoy] Fecha de referencia; se inyecta en las pruebas.
 * @returns {Promise<{ reporte: { renglones: object[], totalUnidadesEnRiesgo: number }|null, error: object|null }>}
 */
export async function obtenerReporteDeVencimientos(
  {
    horizonteDias = HORIZONTE_POR_DEFECTO_EN_DIAS,
    bodega,
    medicamento,
    estadoDeVencimiento = ESTADOS_DE_VENCIMIENTO.VIGENTES,
  } = {},
  hoy = new Date(),
) {
  try {
    let consulta = obtenerSupabase().from("existencias").select(COLUMNAS_DEL_REPORTE);

    if (bodega) consulta = consulta.eq("bodega_id", bodega);
    // El filtro por medicamento viaja al embebido de lotes, que va con !inner justamente para
    // que filtre la consulta en vez de solo vaciar el objeto anidado.
    if (medicamento) consulta = consulta.eq("lotes.medicamento_id", medicamento);

    const { data, error } = await consulta;

    if (error) return { reporte: null, error: normalizarError(error) };

    const renglones = (data ?? [])
      .map((fila) => aRenglon(fila, hoy))
      .filter((renglon) =>
        perteneceAlReporte(renglon.diasRestantes, horizonteDias, estadoDeVencimiento),
      );

    renglones.sort((a, b) => a.diasRestantes - b.diasRestantes);

    const totalUnidadesEnRiesgo = renglones.reduce((suma, renglon) => suma + renglon.cantidad, 0);

    return { reporte: { renglones, totalUnidadesEnRiesgo }, error: null };
  } catch (error) {
    return { reporte: null, error: normalizarError(error) };
  }
}
