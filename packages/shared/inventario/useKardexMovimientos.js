import { useState, useCallback, useMemo, useEffect } from "react";

import { listarMovimientos } from "./movimientos.api.js";

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

/** Nombre completo de un perfil embebido, o null si RLS no dejo verlo (ver listarMovimientos()). */
export function nombreDe(perfil) {
  if (!perfil) return null;
  return [perfil.nombres, perfil.apellidos].filter(Boolean).join(" ") || null;
}

/**
 * Filtra las filas de listarMovimientos() por medicamento y las deja listas para la pantalla.
 *
 * Pura y exportada aparte del hook para poder probarla sin montar React (packages/shared corre
 * vitest en environment "node", sin DOM): es la unica forma de comprobar, sin datos inventados
 * de por medio, que esta pantalla arma sus filas a partir de lo que listarMovimientos() devuelve
 * de verdad.
 *
 * @param {object[]} datos Filas de listarMovimientos().
 * @param {string|null} medicamentoId medicamento_id no es filtro de listarMovimientos() -vive en
 *   lotes, no en movimientos_inventario-, asi que se aplica aqui sobre el lote embebido.
 */
export function filasDeKardex(datos, medicamentoId) {
  const filas = medicamentoId
    ? datos.filter((mov) => mov.lote?.medicamento_id === medicamentoId)
    : datos;

  return filas.map((mov) => ({
    ...mov,
    registrado_por_nombre: nombreDe(mov.registradoPor),
    aprobado_por_nombre: nombreDe(mov.aprobadoPor),
    bodega_nombre: mov.bodega?.nombre ?? null,
  }));
}

/**
 * Hook Kardex de Movimientos (issue #161, reconectado por la #687).
 *
 * Hasta la #687 este hook devolvia cuatro movimientos escritos a mano con un TODO que esperaba
 * a la issue #159 -- ya resuelta hace tiempo, en movimientos.api.js. Ahora llama a
 * listarMovimientos() de verdad.
 *
 * `medicamentoId` no es un filtro que listarMovimientos() entienda (medicamento_id vive en
 * lotes, no en movimientos_inventario): se aplica aqui sobre el lote embebido de cada fila. Solo
 * movimientos APROBADOS afectan el saldo; rechazados y pendientes se muestran pero no lo tocan.
 */
export function useKardexMovimientos({ loteId = null, medicamentoId = null }) {
  const [movimientos, setMovimientos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  // Filtros según criterios de aceptación
  const [filtros, setFiltros] = useState({
    fechaDesde: "",
    fechaHasta: "",
    tipoMovimiento: "todos",
  });

  const cargarMovimientos = useCallback(async () => {
    if (!loteId && !medicamentoId) {
      setMovimientos([]);
      setError(null);
      return;
    }

    setCargando(true);
    setError(null);

    const { datos, error: errorDeConsulta } = await listarMovimientos({
      lote_id: loteId || undefined,
    });

    if (errorDeConsulta) {
      setMovimientos([]);
      setError(errorDeConsulta);
      setCargando(false);
      return;
    }

    setMovimientos(filasDeKardex(datos, medicamentoId));
    setCargando(false);
  }, [loteId, medicamentoId]);

  // ─── CALCULAR SALDO ACUMULADO ───
  // Solo movimientos APROBADOS modifican el saldo
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
        afectaSaldo: esAprobado,
      };
    });
  }, [movimientos]);

  // ─── APLICAR FILTROS ───
  const movimientosFiltrados = useMemo(() => {
    let resultado = [...movimientosConSaldo];

    if (filtros.fechaDesde) {
      const desde = new Date(filtros.fechaDesde);
      resultado = resultado.filter((m) => new Date(m.created_at) >= desde);
    }
    if (filtros.fechaHasta) {
      const hasta = new Date(filtros.fechaHasta);
      hasta.setHours(23, 59, 59);
      resultado = resultado.filter((m) => new Date(m.created_at) <= hasta);
    }

    if (filtros.tipoMovimiento && filtros.tipoMovimiento !== "todos") {
      resultado = resultado.filter((m) => m.tipo === filtros.tipoMovimiento);
    }

    return resultado;
  }, [movimientosConSaldo, filtros]);

  useEffect(() => {
    cargarMovimientos();
  }, [loteId, medicamentoId, cargarMovimientos]);

  return {
    movimientos: movimientosFiltrados,
    cargando,
    error,
    filtros,
    setFiltros,
    recargar: cargarMovimientos,
    TIPO_MOVIMIENTO,
    ESTADO_MOVIMIENTO,
  };
}
