import { useState, useCallback, useMemo, useEffect } from "react";

// ─── TIPOS ALINEADOS EXACTAMENTE CON LA MIGRACIÓN ───
// tipo_movimiento ENUM: 'ingreso', 'salida'
export const TIPO_MOVIMIENTO = {
  INGRESO: "ingreso",
  SALIDA: "salida",
};

// estado_movimiento ENUM: 'pendiente', 'aprobado', 'rechazado'
export const ESTADO_MOVIMIENTO = {
  PENDIENTE: "pendiente",
  APROBADO: "aprobado",
  RECHAZADO: "rechazado",
};

/**
 * Hook Kardex de Movimientos — Issue #161
 * Estructura y lógica alineada con migración movimientos_inventario:
 * - Solo movimientos APROBADOS afectan el saldo
 * - Rechazados y Pendientes se muestran pero NO modifican existencias
 * - Campos reales: created_at, fecha_aprobacion, lote_id, bodega_id
 */
export function useKardexMovimientos({ loteId = null, medicamentoId = null }) {
  const [movimientos, setMovimientos] = useState([]);
  const [cargando, setCargando] = useState(false);

  // Filtros según criterios de aceptación
  const [filtros, setFiltros] = useState({
    fechaDesde: "",
    fechaHasta: "",
    tipoMovimiento: "todos",
  });

  // ─── CALCULAR SALDO ACUMULADO ───
  // ✅ Solo movimientos APROBADOS modifican el saldo
  const movimientosConSaldo = useMemo(() => {
    let saldo = 0;
    return movimientos.map((mov) => {
      const esAprobado = mov.estado === ESTADO_MOVIMIENTO.APROBADO;

      if (esAprobado) {
        if (mov.tipo === TIPO_MOVIMIENTO.INGRESO) {
          saldo += mov.cantidad;
        } else if (mov.tipo === TIPO_MOVIMIENTO.SALIDA) {
          saldo -= mov.cantidad;
        }
      }

      return {
        ...mov,
        saldoAcumulado: saldo,
        afectaSaldo: esAprobado, // ✅ Para marcar visualmente en tabla
      };
    });
  }, [movimientos]);

  // ─── APLICAR FILTROS ───
  const movimientosFiltrados = useMemo(() => {
    let resultado = [...movimientosConSaldo];

    // 🔹 Filtro por rango de fechas (usa fecha de registro created_at)
    if (filtros.fechaDesde) {
      const desde = new Date(filtros.fechaDesde);
      resultado = resultado.filter((m) => new Date(m.created_at) >= desde);
    }
    if (filtros.fechaHasta) {
      const hasta = new Date(filtros.fechaHasta);
      hasta.setHours(23, 59, 59);
      resultado = resultado.filter((m) => new Date(m.created_at) <= hasta);
    }

    // 🔹 Filtro por tipo de movimiento
    if (filtros.tipoMovimiento && filtros.tipoMovimiento !== "todos") {
      resultado = resultado.filter((m) => m.tipo === filtros.tipoMovimiento);
    }

    return resultado;
  }, [movimientosConSaldo, filtros]);

  // ─── CARGAR MOVIMIENTOS ───
  const cargarMovimientos = useCallback(async () => {
    if (!loteId && !medicamentoId) {
      setMovimientos([]);
      return;
    }

    setCargando(true);
    try {
      // ✅ TODO: Reemplazar por llamada real a API cuando #159 esté lista
      // const respuesta = await listarMovimientos({ loteId, medicamentoId });
      // setMovimientos(respuesta.movimientos ?? []);

      // 📋 Estructura de prueba IDÉNTICA a la tabla real
      // Campos: id, tipo, cantidad, motivo, estado, created_at, fecha_aprobacion,
      //         registrado_por_nombre, aprobado_por_nombre, bodega_nombre
      setMovimientos([
        {
          id: "m1",
          tipo: TIPO_MOVIMIENTO.INGRESO,
          cantidad: 100,
          motivo: "Ingreso inicial de lote",
          estado: ESTADO_MOVIMIENTO.APROBADO,
          created_at: "2026-08-01T10:00:00Z",
          fecha_aprobacion: "2026-08-01T10:15:00Z",
          registrado_por_nombre: "Administradora Demo",
          aprobado_por_nombre: "Administradora Demo",
          bodega_nombre: "Central",
        },
        {
          id: "m2",
          tipo: TIPO_MOVIMIENTO.SALIDA,
          cantidad: 20,
          motivo: "Atención a paciente",
          estado: ESTADO_MOVIMIENTO.APROBADO,
          created_at: "2026-08-05T14:30:00Z",
          fecha_aprobacion: "2026-08-05T15:00:00Z",
          registrado_por_nombre: "Administradora Demo",
          aprobado_por_nombre: "Supervisor",
          bodega_nombre: "Central",
        },
        {
          id: "m3",
          tipo: TIPO_MOVIMIENTO.SALIDA,
          cantidad: 15,
          motivo: "Prueba rechazada — stock insuficiente",
          estado: ESTADO_MOVIMIENTO.RECHAZADO,
          created_at: "2026-08-10T09:15:00Z",
          fecha_aprobacion: null,
          registrado_por_nombre: "Administradora Demo",
          aprobado_por_nombre: "Supervisor",
          bodega_nombre: "Central",
        },
        {
          id: "m4",
          tipo: TIPO_MOVIMIENTO.INGRESO,
          cantidad: 50,
          motivo: "Entrega proveedor",
          estado: ESTADO_MOVIMIENTO.PENDIENTE,
          created_at: "2026-08-20T08:00:00Z",
          fecha_aprobacion: null,
          registrado_por_nombre: "Administradora Demo",
          aprobado_por_nombre: null,
          bodega_nombre: "Norte",
        },
      ]);
    } catch (err) {
      console.error("Error al cargar kardex:", err);
      setMovimientos([]);
    } finally {
      setCargando(false);
    }
  }, [loteId, medicamentoId]);

  // ─── RECARGAR CUANDO CAMBIA EL FILTRO ───
  useEffect(() => {
    cargarMovimientos();
  }, [loteId, medicamentoId, cargarMovimientos]);

  // ─── EXPORTAR ───
  const exportar = useCallback(() => {
    // TODO: Generar CSV desde movimientosFiltrados
    console.log("📋 Exportar kardex:", movimientosFiltrados);
  }, [movimientosFiltrados]);

  return {
    movimientos: movimientosFiltrados,
    cargando,
    filtros,
    setFiltros,
    recargar: cargarMovimientos,
    exportar,
    TIPO_MOVIMIENTO,
    ESTADO_MOVIMIENTO,
  };
}