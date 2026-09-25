import { useState, useMemo, useCallback } from "react";

import { diasHastaVencimiento } from "../formato/fechas.js";

// ─── Estados de vencimiento ───
// REGLAS ALINEADAS CON MIGRACIÓN #597:
// • Vence HOY → SÍ es entregable → DISPONIBLE
// • Vence ANTES de hoy → VENCIDO
// • Vence dentro de ≤30 días → PRÓXIMO A VENCER
export const ESTADO_EXISTENCIA = {
  DISPONIBLE: "Disponible",
  POR_VENCER: "Próximo a vencer",
  VENCIDO: "Vencido",
  SIN_STOCK: "Sin existencia",
};

// ─── Umbrales ───
const DIAS_AVISO_VENCIMIENTO = 30; // días antes = "Próximo a vencer"

/**
 * Dias que faltan para que venza un lote, en calendario local (issue #694).
 *
 * @param {string|null} fechaCaducidad Fecha `AAAA-MM-DD`.
 * @returns {number|null} Positivo: dias por delante. `0`: vence hoy y **sigue siendo valido**.
 *   Negativo: ya vencio. `null` sin fecha.
 */
export function calcularDiasRestantes(fechaCaducidad) {
  // issue #694: calculaba con new Date(fechaCaducidad), que interpreta una cadena AAAA-MM-DD
  // como medianoche UTC. En Guatemala (UTC-6) eso adelanta un dia cualquier fecha de
  // vencimiento, y un lote que vence hoy salia VENCIDO. diasHastaVencimiento() (formato/fechas.js)
  // ya resuelve esto comparando dia de calendario, no instante.
  return diasHastaVencimiento(fechaCaducidad);
}

/**
 * Estado de una existencia segun las mismas reglas que la base: `vista_lotes_disponibles`
 * (`fecha_vencimiento >= CURRENT_DATE`), `fn_aplicar_ajuste_existencias` (rechaza solo si ya vencio)
 * y `esLoteEntregable()`.
 *
 * @param {string|null} fechaCaducidad Fecha `AAAA-MM-DD`.
 * @param {number|string|null} stockDisponible Cantidad disponible.
 * @returns {string} Un valor de `ESTADO_EXISTENCIA`: sin stock, vencido, por vencer o disponible.
 */
export function calcularEstadoVencimiento(fechaCaducidad, stockDisponible) {
  const stock = Number(stockDisponible ?? 0);
  if (stock <= 0) return ESTADO_EXISTENCIA.SIN_STOCK;

  const diasRestantes = calcularDiasRestantes(fechaCaducidad);
  if (diasRestantes === null) return ESTADO_EXISTENCIA.DISPONIBLE;

  // === REGLAS ALINEADAS CON #597 ===
  if (diasRestantes < 0) return ESTADO_EXISTENCIA.VENCIDO; // ya venció
  if (diasRestantes === 0) return ESTADO_EXISTENCIA.DISPONIBLE; // vence HOY → válido
  if (diasRestantes <= DIAS_AVISO_VENCIMIENTO) return ESTADO_EXISTENCIA.POR_VENCER;
  return ESTADO_EXISTENCIA.DISPONIBLE;
}

// ─── Hook principal ───
/**
 * Vista de existencias agrupada por medicamento, con filtros por texto, bodega y estado.
 *
 * @param {object} opciones
 * @param {object[]} [opciones.existencias] Existencias ya cargadas.
 * @param {object[]} [opciones.bodegas] Bodegas para el filtro.
 * @returns {object} `{ medicamentos, columnas, bodegasDisponibles, busqueda, filtroBodega,
 *   filtroEstado, ocultarSinExistencia, limpiarFiltros, ... }`, cada filtro con su setter.
 */
export function useVistaExistencias({ existencias = [], bodegas = [] }) {
  // Filtros
  const [busqueda, setBusqueda] = useState("");
  const [filtroBodega, setFiltroBodega] = useState("todas");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [ocultarSinExistencia, setOcultarSinExistencia] = useState(false);
  const [filasExpandidas, setFilasExpandidas] = useState(new Set());

  // ─── Enriquecer cada lote con su estado ───
  const existenciasEnriquecidas = useMemo(() => {
    return existencias.map((item) => ({
      ...item,
      diasRestantes: calcularDiasRestantes(item.fechaCaducidad),
      estado: calcularEstadoVencimiento(item.fechaCaducidad, item.stockTotal),
    }));
  }, [existencias]);

  // ─── Aplicar filtros ───
  const existenciasFiltradas = useMemo(() => {
    let resultado = [...existenciasEnriquecidas];

    if (busqueda.trim()) {
      const t = busqueda.toLowerCase();
      resultado = resultado.filter(
        (item) =>
          item.nombre?.toLowerCase().includes(t) ||
          item.codigo?.toLowerCase().includes(t) ||
          item.lote?.toLowerCase().includes(t),
      );
    }

    if (filtroBodega && filtroBodega !== "todas") {
      resultado = resultado.filter((item) => item.bodega === filtroBodega);
    }

    if (filtroEstado && filtroEstado !== "todos") {
      resultado = resultado.filter((item) => item.estado === filtroEstado);
    }

    if (ocultarSinExistencia) {
      resultado = resultado.filter((item) => item.estado !== ESTADO_EXISTENCIA.SIN_STOCK);
    }

    return resultado;
  }, [existenciasEnriquecidas, busqueda, filtroBodega, filtroEstado, ocultarSinExistencia]);

  // ─── Agrupar por medicamento ───
  const medicamentosAgrupados = useMemo(() => {
    const mapa = new Map();

    existenciasFiltradas.forEach((item) => {
      const clave = `${item.nombre}-${item.concentracion}-${item.presentacion}-${item.marca}`;
      if (!mapa.has(clave)) {
        mapa.set(clave, {
          ...item,
          stockTotal: 0,
          fechaVencimientoMasProxima: null,
          diasRestantesMinimo: null,
          lotes: [],
        });
      }
      const grupo = mapa.get(clave);
      grupo.stockTotal += Number(item.stockTotal || 0);
      grupo.lotes.push(item);

      // Tomar la fecha más próxima = menor cantidad de días restantes
      if (
        grupo.diasRestantesMinimo === null ||
        (item.diasRestantes !== null && item.diasRestantes < grupo.diasRestantesMinimo)
      ) {
        grupo.diasRestantesMinimo = item.diasRestantes;
        grupo.fechaVencimientoMasProxima = item.fechaCaducidad;
      }
    });

    // Recalcular estado del grupo según su vencimiento más próximo
    return Array.from(mapa.values()).map((grupo) => ({
      ...grupo,
      estado: calcularEstadoVencimiento(grupo.fechaVencimientoMasProxima, grupo.stockTotal),
    }));
  }, [existenciasFiltradas]);

  // ─── Manejadores de expansión ───
  const toggleExpandir = useCallback((clave) => {
    setFilasExpandidas((prev) => {
      const s = new Set(prev);
      s.has(clave) ? s.delete(clave) : s.add(clave);
      return s;
    });
  }, []);

  const limpiarFiltros = useCallback(() => {
    setBusqueda("");
    setFiltroBodega("todas");
    setFiltroEstado("todos");
    setOcultarSinExistencia(false);
    setFilasExpandidas(new Set());
  }, []);

  // ─── Descriptores de columnas ───
  const columnas = [
    { clave: "nombre", etiqueta: "Medicamento", ordenable: true },
    { clave: "concentracion", etiqueta: "Concentración", ordenable: true },
    { clave: "presentacion", etiqueta: "Presentación", ordenable: true },
    { clave: "marca", etiqueta: "Marca", ordenable: true },
    { clave: "stockTotal", etiqueta: "Disponible", ordenable: true, alineacion: "derecha" },
    { clave: "fechaVencimientoMasProxima", etiqueta: "Próximo venc.", ordenable: true },
    { clave: "estado", etiqueta: "Estado", ordenable: false },
  ];

  return {
    medicamentos: medicamentosAgrupados,
    columnas,
    bodegasDisponibles: bodegas,

    busqueda,
    setBusqueda,
    filtroBodega,
    setFiltroBodega,
    filtroEstado,
    setFiltroEstado,
    ocultarSinExistencia,
    setOcultarSinExistencia,
    limpiarFiltros,

    filasExpandidas,
    toggleExpandir,

    estadosDisponibles: Object.values(ESTADO_EXISTENCIA),
    ESTADO_EXISTENCIA,
    calcularDiasRestantes, // expuesto para uso en UI (mostrar "0 días" = vence hoy)
  };
}
