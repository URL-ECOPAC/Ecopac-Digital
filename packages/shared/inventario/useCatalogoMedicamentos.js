// Stock de la app movil: los lotes con existencia disponible, por bodega (issue #840, G5).
//
// QUE CAMBIO
//
// Los filtros eran dos filas de chips con desplazamiento horizontal, bodega y categoria, que se
// cortaban en el borde del telefono. La de categorias era una lista escrita aqui -Medicamentos,
// Biologicos, Insumos, EPP...- que no existe en el esquema: ningun lote ni medicamento tiene
// categoria, asi que todo contaba como "Medicamentos" y elegir cualquier otra dejaba la lista
// vacia. La de bodegas comparaba nombres por subcadena ("Sur" coincidia con "Bodega Surena").
//
// Ahora son los filtros de la web: un descriptor (FILTROS_STOCK) que FilterBar dibuja en su panel
// colapsable, busqueda por medicamento o lote y bodega por id. Sin categorias hasta que el
// esquema tenga una.

import { useCallback, useMemo, useState } from "react";

import { TIPOS_DE_FILTRO } from "../descriptores.js";
import { diasHastaVencimiento } from "../formato/fechas.js";
import { filtrarOpcionesPorTexto } from "../formato/opciones.js";

/** Con cuantos dias de anticipacion un lote cuenta como "por vencer" en esta pantalla. */
export const DIAS_AVISO_VENCIMIENTO_STOCK = 30;

export const FILTROS_STOCK = Object.freeze([
  {
    id: "busqueda",
    label: "Buscar",
    tipo: TIPOS_DE_FILTRO.BUSQUEDA,
    placeholder: "Medicamento o número de lote",
  },
  { id: "bodega", label: "Bodega", tipo: TIPOS_DE_FILTRO.SELECT, opcionesDesde: "bodegas" },
]);

export const FILTROS_STOCK_VACIOS = Object.freeze({ busqueda: "", bodega: "" });

/**
 * Una fila de listarExistenciasDisponibles() (vista_lotes_disponibles) lista para la tarjeta. La
 * vista ya excluye lo vencido y lo agotado (00047): lo que se puede marcar es lo que vence pronto.
 *
 * @param {object} fila
 * @param {Date} [hoy]
 */
export function filaDeStock(fila, hoy = new Date()) {
  const diasRestantes = diasHastaVencimiento(fila.fechaVencimiento, hoy);

  return {
    id: `${fila.loteId}:${fila.bodegaId}`,
    loteId: fila.loteId,
    medicamentoId: fila.medicamentoId,
    nombre: fila.medicamentoNombre,
    numeroLote: fila.numeroLote,
    bodegaId: fila.bodegaId,
    bodega: fila.bodega,
    fechaVencimiento: fila.fechaVencimiento,
    diasRestantes,
    cantidadDisponible: fila.cantidadDisponible,
    porVencer:
      diasRestantes !== null && diasRestantes >= 0 && diasRestantes <= DIAS_AVISO_VENCIMIENTO_STOCK,
  };
}

/**
 * Las filas que pasan los filtros. La busqueda ignora mayusculas y acentos, y cada palabra tiene
 * que aparecer en el medicamento o en el numero de lote.
 *
 * @param {ReturnType<typeof filaDeStock>[]} filas
 * @param {typeof FILTROS_STOCK_VACIOS} filtros
 */
export function filtrarStock(filas = [], filtros = FILTROS_STOCK_VACIOS) {
  const deLaBodega = filtros.bodega
    ? filas.filter((fila) => fila.bodegaId === filtros.bodega)
    : filas;

  return filtrarOpcionesPorTexto(
    deLaBodega.map((fila) => ({ value: fila, label: `${fila.nombre} ${fila.numeroLote ?? ""}` })),
    filtros.busqueda ?? "",
  ).map((opcion) => opcion.value);
}

/**
 * Cuantos medicamentos distintos hay en un juego de filas: la vista devuelve un renglon por
 * lote y bodega, asi que dos lotes del mismo medicamento son dos filas y un solo producto.
 *
 * @param {ReturnType<typeof filaDeStock>[]} filas
 */
export function contarProductos(filas = []) {
  return new Set(filas.map((fila) => fila.medicamentoId).filter(Boolean)).size;
}

/**
 * @param {{ inventarioInicial?: object[], bodegas?: { id: string, nombre: string }[] }} [opciones]
 *   `inventarioInicial`: filas de listarExistenciasDisponibles().
 */
export function useCatalogoMedicamentos({ inventarioInicial = [], bodegas = [] } = {}) {
  const [filtros, setFiltros] = useState(FILTROS_STOCK_VACIOS);

  const filas = useMemo(
    () => inventarioInicial.map((fila) => filaDeStock(fila)),
    [inventarioInicial],
  );
  const inventarioFiltrado = useMemo(() => filtrarStock(filas, filtros), [filas, filtros]);

  const setFiltro = useCallback((id, valor) => {
    setFiltros((anteriores) => ({ ...anteriores, [id]: valor ?? "" }));
  }, []);

  const limpiarFiltros = useCallback(() => setFiltros(FILTROS_STOCK_VACIOS), []);

  const catalogos = useMemo(
    () => ({ bodegas: bodegas.map((bodega) => ({ value: bodega.id, label: bodega.nombre })) }),
    [bodegas],
  );

  return {
    filtros,
    setFiltro,
    limpiarFiltros,
    hayFiltros: Object.values(filtros).some((valor) => valor !== ""),
    catalogos,
    inventarioFiltrado,
    total: filas.length,
    totalProductos: contarProductos(inventarioFiltrado),
    totalPorVencer: inventarioFiltrado.filter((fila) => fila.porVencer).length,
  };
}
