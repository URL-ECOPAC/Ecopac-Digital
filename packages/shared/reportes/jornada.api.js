// Reporte de resultados de una jornada (issue #489).
//
// Desde la 00148 lo agrega la base (fn_reporte_jornada, SECURITY DEFINER) y aqui solo se llama.
// Hasta ahi esta funcion leia consultas, consulta_diagnostico, recetas y receta_detalle fila por
// fila y contaba en JS, y por eso los roles consultivos no podian tenerlo: la 00054 (issue #407)
// les retiro esas tablas, porque agregar filas clinicas crudas en el cliente es exponerselas
// aunque al final solo se muestren totales. La funcion de la base devuelve solo los totales y los
// nombres de quienes atendieron, nunca una fila de paciente.

import { obtenerSupabase } from "../api/cliente.js";
import { normalizarError } from "../api/errores-de-supabase.js";

// La guarda se declara en permisos.js, como las de impacto y pacientes (issue #693). Aqui se
// reexporta el mismo binding para no romper lo que ya la importa desde este archivo: reexportar
// es seguro, declararla dos veces no -- el barril la recibiria por dos estrellas y ESM la
// excluiria del namespace por ambigua, que es el bug #365.
export { puedeVerReporteJornada } from "./permisos.js";
import { puedeVerReporteJornada } from "./permisos.js";

/**
 * Reporte de resultados de una jornada: cuanto se atendio, de que y con que.
 *
 * Comprueba el rol antes de consultar, para no gastar la llamada y para dar un mensaje claro en
 * vez de una lista vacia. Esa guarda es comodidad de la interfaz, no seguridad: quien deniega de
 * verdad es la guarda de fn_reporte_jornada() en la base.
 *
 * Desde la 00148 la base lo entrega ya agregado (fn_reporte_jornada): hasta ahi esta funcion leia
 * consultas, diagnosticos y recetas fila por fila y los contaba aqui, y por eso un rol consultivo
 * no podia tenerlo. `personal_participante` trae ademas el `nombre` de quien atendio, que un rol
 * consultivo no puede leer de perfiles.
 *
 * @param {{ jornadaId: string, rol: string }} params
 * @returns {Promise<{ datos: object|null, error: object|null }>} `datos` trae `jornada`,
 *   `resumen` (total de consultas y pacientes unicos), y los rankings de diagnosticos,
 *   medicamentos y personal participante, cada uno ordenado de mayor a menor.
 */
export async function obtenerReporteJornada({ jornadaId, rol } = {}) {
  if (!jornadaId) {
    return {
      datos: null,
      error: { codigo: "CAMPO_REQUERIDO", mensaje: "El ID de la jornada es obligatorio." },
    };
  }

  if (!puedeVerReporteJornada(rol)) {
    return {
      datos: null,
      error: {
        codigo: "SIN_PERMISO",
        mensaje: "No tienes acceso al reporte de resultados de la jornada.",
      },
    };
  }

  try {
    const { data, error } = await obtenerSupabase().rpc("fn_reporte_jornada", {
      p_jornada_id: jornadaId,
    });

    if (error) return { datos: null, error: normalizarError(error) };
    if (!data) {
      return {
        datos: null,
        error: { codigo: "SIN_RESULTADOS", mensaje: "No se encontro la jornada." },
      };
    }

    return { datos: data, error: null };
  } catch (error) {
    return { datos: null, error: normalizarError(error) };
  }
}
