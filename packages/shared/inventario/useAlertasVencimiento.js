import { useState, useMemo, useCallback } from "react";
import { atenderAlerta } from "./alertas.api.js";

export const ESTADO_ALERTA = {
  POR_VENCER: "POR_VENCER",
  VENCIDA: "VENCIDA",
};

export function useAlertasVencimiento({ lotes = [], bodegas = [] }) {
  const [busqueda, setBusqueda] = useState("");
  const [filtroBodega, setFiltroBodega] = useState("todas");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [alertasAtendidas, setAlertasAtendidas] = useState([]);

  // ✅ Regla #597: Un lote que vence HOY (días = 0) TODAVÍA es válido y entregable
  const calcularDiasRestantes = useCallback((fechaVencimiento, fechaIngreso) => {
    if (!fechaVencimiento) return null;

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const vencimiento = new Date(fechaVencimiento);
    vencimiento.setHours(0, 0, 0, 0);

    // ✅ Validación según restricción de base: fecha_vencimiento >= fecha_ingreso
    if (fechaIngreso) {
      const ingreso = new Date(fechaIngreso);
      ingreso.setHours(0, 0, 0, 0);
      if (vencimiento < ingreso) return null; // Inválido según regla #597
    }

    const diferenciaMs = vencimiento - hoy;
    return Math.ceil(diferenciaMs / (1000 * 60 * 60 * 24));
  }, []);

  // 📋 Generar alertas: vencimiento dentro de 30 días o menos
  const alertas = useMemo(() => {
    const DIAS_ANTICIPACION = 30;

    return lotes
      .filter((lote) => {
        const diasRestantes = calcularDiasRestantes(
          lote.fechaVencimiento,
          lote.fechaIngreso || lote.fecha_ingreso
        );
        // ✅ Incluye: hoy (0 días) hasta 30 días → >30 días NO se muestra
        return diasRestantes !== null && diasRestantes <= DIAS_ANTICIPACION;
      })
      .map((lote) => {
        const diasRestantes = calcularDiasRestantes(
          lote.fechaVencimiento,
          lote.fechaIngreso || lote.fecha_ingreso
        );
        return {
          id: lote.id,
          medicamento: lote.medicamento?.nombre || "Desconocido",
          lote: lote.numeroLote || lote.lote,
          cantidad: lote.cantidad,
          fechaVencimiento: lote.fechaVencimiento,
          diasRestantes,
          // ✅ Hoy (0) = Por vencer | Mañana (-1) = Vencida
          estado: diasRestantes >= 0 ? ESTADO_ALERTA.POR_VENCER : ESTADO_ALERTA.VENCIDA,
          bodega: lote.bodega || "Central",
          categoria: lote.medicamento?.categoria || "General",
        };
      })
      .filter((alerta) => !alertasAtendidas.includes(alerta.id))
      .filter((alerta) => {
        const coincideBusqueda = busqueda === ""
          || alerta.medicamento.toLowerCase().includes(busqueda.toLowerCase())
          || alerta.lote.toLowerCase().includes(busqueda.toLowerCase());

        const coincideBodega = filtroBodega === "todas" || alerta.bodega === filtroBodega;
        const coincideCategoria = filtroCategoria === "todas" || alerta.categoria === filtroCategoria;

        return coincideBusqueda && coincideBodega && coincideCategoria;
      })
      // ✅ Orden: los que vencen antes aparecen primero
      .sort((a, b) => a.diasRestantes - b.diasRestantes);
  }, [
    lotes, busqueda, filtroBodega, filtroCategoria, alertasAtendidas, calcularDiasRestantes
  ]);

  // 📊 Secciones separadas
  const porVencer = useMemo(
    () => alertas.filter((a) => a.estado === ESTADO_ALERTA.POR_VENCER),
    [alertas]
  );
  const vencidas = useMemo(
    () => alertas.filter((a) => a.estado === ESTADO_ALERTA.VENCIDA),
    [alertas]
  );

  // 📈 Contador para indicador global
  const cantidadPendientes = alertas.length;

  // ✅ Atender alerta: exige acción obligatoria
  const marcarComoAtendida = useCallback(async (alertaId, accionTomada) => {
  if (!accionTomada || accionTomada.trim() === "") {
    throw new Error("Debe indicar la acción tomada");
  }
  await atenderAlerta(alertaId, { accionTomada });
  setAlertasAtendidas((prev) => [...prev, alertaId]);
}, []);
  // 🔄 Limpiar filtros
  const limpiarFiltros = useCallback(() => {
    setBusqueda("");
    setFiltroBodega("todas");
    setFiltroCategoria("todas");
  }, []);

    const categoriasDisponibles = useMemo(() => {
    if (!lotes || !Array.isArray(lotes)) return ["todas"];
    const cats = new Set();
    lotes.forEach((l) => {
      const cat = l.medicamento?.categoria || l.categoria;
      if (cat && typeof cat === "string" && cat.trim() !== "") {
        cats.add(cat.trim());
      }
    });
    return ["todas", ...Array.from(cats).sort()];
  }, [lotes]);

  return {
    alertas,
    porVencer,
    vencidas,
    cantidadPendientes,

    busqueda, setBusqueda,
    filtroBodega, setFiltroBodega,
    filtroCategoria, setFiltroCategoria,
    limpiarFiltros,

    bodegasDisponibles: ["todas", ...bodegas.map((b) => b.nombre || b)],
    categoriasDisponibles,

    marcarComoAtendida,
    calcularDiasRestantes,
    ESTADO_ALERTA,
  };
}