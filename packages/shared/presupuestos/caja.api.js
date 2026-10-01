// La caja (00168): donde queda el sobrante de una jornada que no vuelve a una donacion -el de
// fondos propios, un aporte externo o sin clasificar-, y de donde sale un aporte con origen caja.
// Nadie la escribe desde aqui: entra al liquidar el sobrante y sale al registrar el aporte.

import { obtenerSupabase } from "../api/cliente.js";
import { normalizarError } from "../api/errores-de-supabase.js";

const COLUMNAS_DEL_MOVIMIENTO = [
  "id",
  "tipo",
  "monto",
  "descripcion",
  "jornadaId:jornada_id",
  "jornada:jornadas(nombre)",
  "createdAt:created_at",
  "registradoPorPerfil:nombres_de_perfiles!movimientos_de_caja_registrado_por_fkey(nombres, apellidos)",
].join(", ");

/** Tipos de movimiento de la caja (chk_movimientos_de_caja_tipo, 00168). */
export const TIPOS_DE_MOVIMIENTO_DE_CAJA = Object.freeze({
  ENTRADA: "entrada",
  SALIDA: "salida",
});

/**
 * Un movimiento de la caja, listo para la lista: la salida va en negativo en `importe`.
 *
 * @param {object} fila Fila de movimientos_de_caja con su jornada embebida.
 * @returns {object}
 */
export function aMovimientoDeCaja(fila) {
  const { registradoPorPerfil, jornada, ...resto } = fila;
  const monto = Number(fila.monto) || 0;
  const esEntrada = fila.tipo === TIPOS_DE_MOVIMIENTO_DE_CAJA.ENTRADA;
  return {
    ...resto,
    monto,
    importe: esEntrada ? monto : -monto,
    tipoEtiqueta: esEntrada ? "Entrada" : "Salida",
    jornadaNombre: jornada?.nombre ?? null,
    registradoPorNombre:
      [registradoPorPerfil?.nombres, registradoPorPerfil?.apellidos].filter(Boolean).join(" ") ||
      null,
  };
}

/**
 * Lo que hay en la caja (saldo_de_caja, 00168).
 *
 * @returns {Promise<{ saldo: number|null, error: object|null }>} `saldo` en null si el rol no ve
 *   los aportes.
 */
export async function obtenerSaldoDeCaja() {
  try {
    const { data, error } = await obtenerSupabase().rpc("saldo_de_caja");
    if (error) return { saldo: null, error: normalizarError(error) };
    return { saldo: data === null || data === undefined ? null : Number(data), error: null };
  } catch (error) {
    return { saldo: null, error: normalizarError(error) };
  }
}

/**
 * Los movimientos de la caja, del mas reciente al mas antiguo.
 *
 * @returns {Promise<{ movimientos: object[], error: object|null }>}
 */
export async function listarMovimientosDeCaja() {
  try {
    const { data, error } = await obtenerSupabase()
      .from("movimientos_de_caja")
      .select(COLUMNAS_DEL_MOVIMIENTO)
      .order("created_at", { ascending: false });

    if (error) return { movimientos: [], error: normalizarError(error) };
    return { movimientos: (data ?? []).map(aMovimientoDeCaja), error: null };
  } catch (error) {
    return { movimientos: [], error: normalizarError(error) };
  }
}
