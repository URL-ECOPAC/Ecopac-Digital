// El sobrante del presupuesto de una jornada finalizada (00160).
//
// Por cada aporte, la base calcula que parte usaron los gastos pendientes y aprobados -primero
// las donaciones y los aportes externos, al final los fondos propios- y que parte sobra
// (sobrante_de_jornada). Liquidar es decidir, por aporte, si ese sobrante se devuelve a su origen o
// se traspasa a otra jornada del mismo proyecto (fn_liquidar_sobrante_de_jornada). Que la jornada
// este finalizada y sin gastos pendientes, y a donde se puede traspasar, lo decide la base.

import { obtenerSupabase } from "../api/cliente.js";
import { normalizarError } from "../api/errores-de-supabase.js";

/** Que se hace con el sobrante de un aporte: los dos valores que acepta la base. */
export const DESTINOS_DE_SOBRANTE = Object.freeze({
  DEVOLVER: "devolver",
  TRASPASAR: "traspasar",
});

function aNumero(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
}

/**
 * Lo usado y lo que sobra de cada aporte de una jornada.
 *
 * @param {string} jornadaId
 * @returns {Promise<{ sobrantes: { origenId: string, origen: string, monto: number,
 *   devuelto: number, usado: number, sobrante: number }[], error: object|null }>}
 */
export async function obtenerSobranteDeJornada(jornadaId) {
  if (!jornadaId) return { sobrantes: [], error: null };

  try {
    const { data, error } = await obtenerSupabase().rpc("sobrante_de_jornada", {
      p_jornada_id: jornadaId,
    });

    if (error) return { sobrantes: [], error: normalizarError(error) };
    return {
      sobrantes: (data ?? []).map((fila) => ({
        origenId: fila.origen_id,
        origen: fila.origen,
        monto: aNumero(fila.monto),
        devuelto: aNumero(fila.devuelto),
        usado: aNumero(fila.usado),
        sobrante: aNumero(fila.sobrante),
      })),
      error: null,
    };
  } catch (error) {
    return { sobrantes: [], error: normalizarError(error) };
  }
}

/**
 * Liquida el sobrante de una jornada: cada aporte elegido entrega todo lo que le sobra.
 *
 * @param {string} jornadaId
 * @param {{ origenId: string, destino: string, jornadaDestinoId?: string|null }[]} decisiones
 *   `destino` es uno de DESTINOS_DE_SOBRANTE; `jornadaDestinoId` solo al traspasar.
 * @returns {Promise<{ liquidados: number, error: object|null }>}
 */
export async function liquidarSobranteDeJornada(jornadaId, decisiones = []) {
  if (!jornadaId || decisiones.length === 0) return { liquidados: 0, error: null };

  try {
    const { data, error } = await obtenerSupabase().rpc("fn_liquidar_sobrante_de_jornada", {
      p_jornada_id: jornadaId,
      p_decisiones: decisiones.map((decision) => ({
        origen_id: decision.origenId,
        destino: decision.destino,
        ...(decision.destino === DESTINOS_DE_SOBRANTE.TRASPASAR
          ? { jornada_destino_id: decision.jornadaDestinoId }
          : {}),
      })),
    });

    if (error) return { liquidados: 0, error: normalizarError(error) };
    return { liquidados: aNumero(data), error: null };
  } catch (error) {
    return { liquidados: 0, error: normalizarError(error) };
  }
}
