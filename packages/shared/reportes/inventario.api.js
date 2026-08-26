import { obtenerSupabase } from "../api/cliente.js";
import { normalizarError } from "../api/errores-de-supabase.js";
import { esLoteEntregable } from "../inventario/lotes.validaciones.js";

export const ESTADOS_DE_VENCIMIENTO = {
  TODOS: "todos",
  VIGENTES: "vigentes",
  VENCIDOS: "vencidos",
};

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
  const vencido = !esLoteEntregable({ fechaVencimiento: lote.fechaVencimiento }, hoy);

  return {
    medicamentoId: lote.medicamentoId ?? null,
    medicamento: medicamento.nombre ?? null,
    concentracion: medicamento.concentracion ?? null,
    presentacion: medicamento.presentacion ?? null,
    marca: medicamento.marca ?? null,
    loteId: lote.id ?? null,
    numeroLote: lote.numeroLote ?? null,
    fechaVencimiento: lote.fechaVencimiento ?? null,
    bodegaId: fila.bodegaId ?? null,
    bodega: fila.bodega?.nombre ?? null,
    cantidad: Number(fila.cantidadDisponible ?? 0),
    vencido,
  };
}

function agrupar(renglones) {
  const porMedicamento = new Map();

  for (const renglon of renglones) {
    const clave = renglon.medicamentoId ?? renglon.loteId;
    if (!porMedicamento.has(clave)) {
      porMedicamento.set(clave, {
        medicamentoId: renglon.medicamentoId,
        medicamento: renglon.medicamento,
        concentracion: renglon.concentracion,
        presentacion: renglon.presentacion,
        marca: renglon.marca,
        disponible: 0,
        vencido: 0,
        lotes: [],
      });
    }

    const grupo = porMedicamento.get(clave);
    // El desglose conserva la fila tal cual: es una combinacion (lote, bodega), que es el grano
    // real de existencias y lo que el reporte tiene que poder mostrar.
    grupo.lotes.push({
      loteId: renglon.loteId,
      numeroLote: renglon.numeroLote,
      fechaVencimiento: renglon.fechaVencimiento,
      bodegaId: renglon.bodegaId,
      bodega: renglon.bodega,
      cantidad: renglon.cantidad,
      vencido: renglon.vencido,
    });

    // Las dos sumas van por separado a proposito: lo vencido no engrosa lo disponible.
    if (renglon.vencido) grupo.vencido += renglon.cantidad;
    else grupo.disponible += renglon.cantidad;
  }

  return [...porMedicamento.values()].sort((uno, otro) =>
    String(uno.medicamento ?? "").localeCompare(String(otro.medicamento ?? "")),
  );
}

function calcularTotales(medicamentos) {
  let unidadesDisponibles = 0;
  let unidadesVencidas = 0;
  let lotes = 0;

  for (const medicamento of medicamentos) {
    unidadesDisponibles += medicamento.disponible;
    unidadesVencidas += medicamento.vencido;
    lotes += medicamento.lotes.length;
  }

  return {
    unidadesDisponibles,
    unidadesVencidas,
    medicamentosDistintos: medicamentos.length,
    renglonesDeInventario: lotes,
  };
}

/**
 * Estado actual del inventario para reporte: existencia por medicamento, con el desglose de
 * cada combinacion de lote y bodega, y los totales.
 *
 * Consulta `existencias` con los embebidos hacia lotes, medicamentos y bodegas, y arma el
 * reporte aqui. No reusa fn_existencias_disponibles (00065) a proposito: esa funcion se apoya en
 * vista_lotes_disponibles, que excluye los lotes vencidos, y el criterio de aceptacion pide
 * justamente reportarlos por separado. Tampoco agrega en la base como si hace la #145, porque
 * este reporte necesita el desglose fila por fila, no solo el agregado: teniendolo, los totales
 * salen de sumarlo sin un viaje extra.
 *
 * Lo vencido nunca se suma a lo disponible: son dos acumuladores distintos, tanto por
 * medicamento como en los totales. Que un lote este vencido lo decide esLoteEntregable() de
 * inventario/lotes.validaciones.js, la misma funcion que usan las pantallas de despacho, para no
 * tener dos definiciones de "vencido".
 *
 * Las politicas RLS de la 00034 filtran solas: la consulta va contra las tablas, no contra una
 * funcion con privilegios propios.
 *
 * @param {object} [filtros]
 * @param {string} [filtros.bodega] UUID de bodega.
 * @param {string} [filtros.medicamento] UUID de medicamento.
 * @param {string} [filtros.estadoDeVencimiento] Uno de ESTADOS_DE_VENCIMIENTO; por defecto todos.
 * @param {Date} [hoy] Fecha de referencia; se inyecta en las pruebas.
 * @returns {Promise<{ reporte: object|null, error: object|null }>}
 */
export async function obtenerReporteDeInventario(
  { bodega, medicamento, estadoDeVencimiento = ESTADOS_DE_VENCIMIENTO.TODOS } = {},
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

    let renglones = (data ?? []).map((fila) => aRenglon(fila, hoy));

    // El estado de vencimiento se filtra aqui y no en la consulta porque es un dato derivado de
    // comparar la fecha contra hoy, no una columna que PostgREST pueda filtrar.
    if (estadoDeVencimiento === ESTADOS_DE_VENCIMIENTO.VIGENTES) {
      renglones = renglones.filter((renglon) => !renglon.vencido);
    } else if (estadoDeVencimiento === ESTADOS_DE_VENCIMIENTO.VENCIDOS) {
      renglones = renglones.filter((renglon) => renglon.vencido);
    }

    const medicamentos = agrupar(renglones);

    return {
      reporte: { medicamentos, totales: calcularTotales(medicamentos) },
      error: null,
    };
  } catch (error) {
    return { reporte: null, error: normalizarError(error) };
  }
}
