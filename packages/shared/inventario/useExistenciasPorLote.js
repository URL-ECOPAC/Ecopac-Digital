// View model del listado de existencias lote a lote (pantalla movil de inventario).
//
// POR QUE EXISTE (issue #838). ExistenciasInventarioScreen.js hacia todo esto dentro del
// componente: las dos consultas, la suma de existencias por lote, el calculo del estado de
// vencimiento y las etiquetas. Es exactamente lo que docs/ARQUITECTURA-FRONTEND.md prohibe -- una
// app no calcula ni decide -- y ademas dejaba la pantalla sin filtros: no habia forma de ver solo
// una bodega, ni solo lo vencido, con una lista que en jornada tiene decenas de lotes.
//
// No reemplaza a useVistaExistencias.js, que agrupa POR MEDICAMENTO para la tabla expandible de
// la web. Este agrupa por LOTE, que es la unidad con la que se trabaja en campo: el lote es lo
// que se toma de la caja, lo que vence y lo que se da de baja.

import { useCallback, useEffect, useMemo, useState } from "react";

import { diasHastaVencimiento } from "../formato/fechas.js";
import { TIPOS_DE_FILTRO } from "../descriptores.js";
import { listarBodegas } from "./bodegas.api.js";
import { listarExistenciasDisponibles } from "./existencias.api.js";
import { listarLotes } from "./lotes.api.js";
import { ventanaDeAviso } from "./configuracionAlertas.validaciones.js";
import { useVentanaDeAvisoVencimiento } from "./useVentanaDeAvisoVencimiento.js";
import { useCambiosEnTiempoReal } from "../hooks/useCambiosEnTiempoReal.js";

// "Critico" es un nivel visual de urgencia dentro de "por vencer", no la regla de las alertas: por
// eso se queda fijo. La ventana de "por vencer" si sale de la configuracion (issue #899).
const DIAS_CRITICO = 7;

/**
 * Estado de un lote por su vencimiento y su existencia.
 *
 * Los valores son las claves de `statusColors` de @ecopac/ui-tokens, no textos: el color y la
 * etiqueta los resuelve StatusChip, igual que con cualquier otro estado del sistema.
 */
export const ESTADOS_DE_LOTE = Object.freeze({
  DISPONIBLE: "disponible",
  POR_VENCER: "por vencer",
  CRITICO: "critico",
  VENCIDO: "vencido",
  AGOTADO: "agotado",
});

/**
 * El estado de un lote. Un lote que vence HOY todavia se entrega (regla de la migracion 00044,
 * misma que aplica esLoteEntregable()).
 *
 * @param {number|null} diasRestantes
 * @param {number} cantidadDisponible
 * @param {number} [diasAviso] Ventana de los avisos de vencimiento (issue #899).
 * @returns {string} Uno de ESTADOS_DE_LOTE.
 */
export function estadoDeLote(diasRestantes, cantidadDisponible, diasAviso = ventanaDeAviso()) {
  if (diasRestantes !== null && diasRestantes < 0) return ESTADOS_DE_LOTE.VENCIDO;
  if (Number(cantidadDisponible ?? 0) <= 0) return ESTADOS_DE_LOTE.AGOTADO;
  if (diasRestantes !== null && diasRestantes <= DIAS_CRITICO) return ESTADOS_DE_LOTE.CRITICO;
  if (diasRestantes !== null && diasRestantes <= diasAviso) {
    return ESTADOS_DE_LOTE.POR_VENCER;
  }
  return ESTADOS_DE_LOTE.DISPONIBLE;
}

/** Filtros de la pantalla, declarados una sola vez para que las dos apps los dibujen igual. */
export const FILTROS_EXISTENCIAS_POR_LOTE = [
  {
    id: "busqueda",
    tipo: TIPOS_DE_FILTRO.BUSQUEDA,
    label: "Buscar",
    placeholder: "Medicamento o número de lote",
  },
  { id: "bodega", tipo: TIPOS_DE_FILTRO.SELECT, label: "Bodega", opcionesDesde: "bodegas" },
  {
    id: "estado",
    tipo: TIPOS_DE_FILTRO.SELECT,
    label: "Estado",
    opcionesDesde: "estadosDeLote",
  },
];

export const FILTROS_EXISTENCIAS_POR_LOTE_VACIOS = Object.freeze({
  busqueda: "",
  bodega: null,
  estado: null,
});

/**
 * Suma la existencia de cada lote, opcionalmente solo la de una bodega.
 *
 * Se exporta aparte del hook para poder probarla sin montar un componente: packages/shared corre
 * vitest sin DOM, mismo criterio que el resto de los hooks del monorepo.
 *
 * @param {object[]} existencias Filas de vista_lotes_disponibles.
 * @param {string|null} [bodegaId] Solo esta bodega; sin ella, todas.
 * @returns {Map<string, number>} loteId -> cantidad.
 */
export function sumarExistenciasPorLote(existencias = [], bodegaId = null) {
  const total = new Map();
  for (const fila of existencias) {
    if (bodegaId && fila.bodegaId !== bodegaId) continue;
    total.set(fila.loteId, (total.get(fila.loteId) ?? 0) + Number(fila.cantidadDisponible || 0));
  }
  return total;
}

/**
 * Arma las filas de la pantalla a partir de los lotes y sus existencias, y aplica los filtros.
 *
 * Filtrar aqui y no en el servidor es deliberado: el estado de vencimiento no es una columna, se
 * calcula del dia de hoy, y la busqueda cruza dos campos de dos tablas distintas. La lista
 * completa de lotes cabe de sobra en memoria (es el catalogo de una ONG, no un almacen).
 *
 * @param {object[]} lotes
 * @param {object[]} existencias
 * @param {{ busqueda?: string, bodega?: string|null, estado?: string|null }} [filtros]
 * @param {number} [diasAviso]
 * @returns {object[]}
 */
export function armarFilasDeExistencias(
  lotes = [],
  existencias = [],
  filtros = {},
  diasAviso = ventanaDeAviso(),
) {
  const porLote = sumarExistenciasPorLote(existencias, filtros.bodega ?? null);
  const termino = (filtros.busqueda ?? "").trim().toLowerCase();

  // Con una bodega elegida, un lote que no tiene ninguna fila en esa bodega no esta ahi: no es
  // "cero existencias", es que no pertenece a esa lista.
  const lotesDeLaBodega = filtros.bodega ? lotes.filter((lote) => porLote.has(lote.id)) : lotes;

  return lotesDeLaBodega
    .map((lote) => {
      const cantidadDisponible = porLote.get(lote.id) ?? 0;
      const diasRestantes = diasHastaVencimiento(lote.fechaVencimiento);

      return {
        id: lote.id,
        loteId: lote.id,
        medicamento: lote.medicamento || "Medicamento sin nombre",
        numeroLote: lote.numeroLote,
        fechaVencimiento: lote.fechaVencimiento,
        cantidadDisponible,
        diasRestantes,
        estado: estadoDeLote(diasRestantes, cantidadDisponible, diasAviso),
      };
    })
    .filter((fila) => {
      if (termino) {
        const coincide = [fila.medicamento, fila.numeroLote].some((campo) =>
          String(campo ?? "")
            .toLowerCase()
            .includes(termino),
        );
        if (!coincide) return false;
      }
      if (filtros.estado && fila.estado !== filtros.estado) return false;
      return true;
    })
    .sort((uno, otro) => (uno.diasRestantes ?? Infinity) - (otro.diasRestantes ?? Infinity));
}

/**
 * Existencias lote a lote, con busqueda, bodega y estado de vencimiento.
 *
 * @param {{ estadosDeLote?: object[] }} [opciones] Etiquetas de estado, para el selector. Las
 *   pone quien llama porque salen de @ecopac/ui-tokens, que shared no importa para texto de
 *   estado -- el mismo reparto que ya usan las columnas con `etiquetasDesde`.
 *
 * @returns {object} Con: filas, total, totalSinFiltrar, filtros, setFiltro, limpiarFiltros, hayFiltros, cargando, error, recargar, catalogos.
 */
export function useExistenciasPorLote({ estadosDeLote = [] } = {}) {
  const { diasAviso } = useVentanaDeAvisoVencimiento();
  const [lotes, setLotes] = useState([]);
  const [existencias, setExistencias] = useState([]);
  const [bodegas, setBodegas] = useState([]);
  const [filtros, setFiltros] = useState(FILTROS_EXISTENCIAS_POR_LOTE_VACIOS);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);

    const [respuestaLotes, respuestaExistencias, respuestaBodegas] = await Promise.all([
      listarLotes(),
      listarExistenciasDisponibles(),
      listarBodegas(),
    ]);

    setLotes(respuestaLotes.lotes ?? []);
    setExistencias(respuestaExistencias.existencias ?? []);
    setBodegas(respuestaBodegas.bodegas ?? []);
    // La bodega es para un filtro: si su catalogo falla, la pantalla sigue sirviendo sin el, y
    // tapar la lista entera con un error por eso seria peor.
    setError(respuestaLotes.error ?? respuestaExistencias.error ?? null);
    setCargando(false);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const setFiltro = useCallback((id, valor) => {
    setFiltros((anteriores) => ({ ...anteriores, [id]: valor }));
  }, []);

  const limpiarFiltros = useCallback(() => setFiltros(FILTROS_EXISTENCIAS_POR_LOTE_VACIOS), []);

  const filas = useMemo(
    () => armarFilasDeExistencias(lotes, existencias, filtros, diasAviso),
    [lotes, existencias, filtros, diasAviso],
  );

  const hayFiltros = Object.keys(FILTROS_EXISTENCIAS_POR_LOTE_VACIOS).some(
    (clave) => Boolean(filtros[clave]) !== Boolean(FILTROS_EXISTENCIAS_POR_LOTE_VACIOS[clave]),
  );

  // Se recarga sola cuando cambian estas tablas (00163).
  useCambiosEnTiempoReal(["existencias", "lotes"], cargar);

  return {
    filas,
    total: filas.length,
    totalSinFiltrar: lotes.length,
    filtros,
    setFiltro,
    limpiarFiltros,
    hayFiltros,
    cargando,
    error,
    recargar: cargar,
    catalogos: {
      bodegas: bodegas.map((bodega) => ({ value: bodega.id, label: bodega.nombre })),
      estadosDeLote,
    },
  };
}
