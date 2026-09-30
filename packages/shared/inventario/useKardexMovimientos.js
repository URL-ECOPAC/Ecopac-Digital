import { useState, useCallback, useMemo, useEffect } from "react";

import { aFechaLocal } from "../formato/fechas.js";
import { listarMovimientos } from "./movimientos.api.js";
import { useCambiosEnTiempoReal } from "../hooks/useCambiosEnTiempoReal.js";

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
 * Nombre completo de un perfil embebido, o null si RLS no dejo verlo (ver listarMovimientos()).
 *
 * @param {object} perfil
 * @returns {null|string}
 */
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
 *
 * @returns {object[]}
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
 * Filtra movimientos cuyo created_at cae en [fechaDesde, fechaHasta] (ambos "AAAA-MM-DD",
 * inclusive, en hora local). Pura y exportada aparte del hook por la misma razon que
 * filasDeKardex(): sin esto, fechaDesde/fechaHasta -lo que manda un <input type="date">- se leian
 * con `new Date(cadena)`, que interpreta "AAAA-MM-DD" como medianoche UTC y corre el rango un dia
 * en Guatemala (UTC-6, issue #725).
 *
 * @param {object[]} movimientos
 * @param {string} [fechaDesde]
 * @param {string} [fechaHasta]
 * @returns {object[]}
 */
export function filtrarPorRangoDeFecha(movimientos, fechaDesde, fechaHasta) {
  let resultado = movimientos;

  if (fechaDesde) {
    const desde = aFechaLocal(fechaDesde);
    resultado = resultado.filter((m) => aFechaLocal(m.created_at) >= desde);
  }

  if (fechaHasta) {
    const hasta = aFechaLocal(fechaHasta);
    const finDelDia = new Date(
      hasta.getFullYear(),
      hasta.getMonth(),
      hasta.getDate(),
      23,
      59,
      59,
      999,
    );
    resultado = resultado.filter((m) => aFechaLocal(m.created_at) <= finDelDia);
  }

  return resultado;
}

/**
 * Totales del kardex para el PDF. Solo cuentan los movimientos aprobados, igual que el saldo.
 * Pura y exportada aparte del hook para probarla sin montar React.
 *
 * @param {object[]} movimientos Filas del hook, con `afectaSaldo` y `saldoAcumulado`.
 * @returns {{ movimientos: number, ingresos: number, salidas: number, saldo: number }}
 */
export function resumenDeKardex(movimientos) {
  const aprobados = movimientos.filter((mov) => mov.afectaSaldo);
  const sumar = (tipo) =>
    aprobados.filter((mov) => mov.tipo === tipo).reduce((total, mov) => total + mov.cantidad, 0);

  return {
    movimientos: movimientos.length,
    ingresos: sumar(TIPO_MOVIMIENTO.INGRESO),
    salidas: sumar(TIPO_MOVIMIENTO.SALIDA),
    saldo: movimientos.length ? movimientos[movimientos.length - 1].saldoAcumulado : 0,
  };
}

/**
 * Movimientos del mas antiguo al mas reciente, por created_at. No muta el arreglo recibido.
 *
 * @param {Array<{ created_at?: string }>} movimientos
 * @returns {Array<object>}
 */
export function ordenarMovimientosPorFecha(movimientos = []) {
  const tiempo = (mov) => aFechaLocal(mov.created_at)?.getTime() ?? 0;
  return [...movimientos].sort((uno, otro) => tiempo(uno) - tiempo(otro));
}

/**
 * Movimientos del kardex en orden cronologico, cada uno con el saldo que queda despues de el.
 * Solo los APROBADOS mueven el saldo; pendientes y rechazados se muestran sin tocarlo.
 *
 * Del mas antiguo al mas reciente, como se lee un kardex. listarMovimientos() los devuelve del mas
 * reciente al mas antiguo, y acumular en ese orden restaba la salida antes de sumar el ingreso: un
 * lote que entro con 200 y salio con 200 mostraba -200 y despues 0.
 *
 * @param {Array<{ created_at: string, estado: string, tipo: string, cantidad: number }>} movimientos
 * @returns {Array<object>} Cada movimiento con `saldoAcumulado` y `afectaSaldo`.
 */
export function conSaldoAcumulado(movimientos = []) {
  let saldo = 0;
  return ordenarMovimientosPorFecha(movimientos).map((mov) => {
    const esAprobado = mov.estado === ESTADO_MOVIMIENTO.APROBADO;
    if (esAprobado) {
      if (mov.tipo === TIPO_MOVIMIENTO.INGRESO) saldo += mov.cantidad;
      else if (mov.tipo === TIPO_MOVIMIENTO.SALIDA) saldo -= mov.cantidad;
    }
    return { ...mov, saldoAcumulado: saldo, afectaSaldo: esAprobado };
  });
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
 *
 * @param {object} opciones
 * @param {string|null} [opciones.loteId]
 * @param {string|null} [opciones.medicamentoId]
 * @returns {object} Con: movimientos (object[]), cargando, error, filtros, setFiltros, recargar, TIPO_MOVIMIENTO y ESTADO_MOVIMIENTO.
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

  const movimientosConSaldo = useMemo(() => conSaldoAcumulado(movimientos), [movimientos]);

  // ─── APLICAR FILTROS ───
  const movimientosFiltrados = useMemo(() => {
    // Los filtros son dias de calendario LOCALES ("AAAA-MM-DD") y created_at es un instante.
    // filtrarPorRangoDeFecha() es la version pura y probada de lo que la #840 habia arreglado
    // aqui dentro: misma correccion, un solo sitio donde vive (#849).
    let resultado = filtrarPorRangoDeFecha(
      movimientosConSaldo,
      filtros.fechaDesde,
      filtros.fechaHasta,
    );

    if (filtros.tipoMovimiento && filtros.tipoMovimiento !== "todos") {
      resultado = resultado.filter((m) => m.tipo === filtros.tipoMovimiento);
    }

    return resultado;
  }, [movimientosConSaldo, filtros]);

  useEffect(() => {
    cargarMovimientos();
  }, [loteId, medicamentoId, cargarMovimientos]);

  // Se recarga sola cuando cambian estas tablas (00163).
  useCambiosEnTiempoReal(["movimientos_inventario"], cargarMovimientos);

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
