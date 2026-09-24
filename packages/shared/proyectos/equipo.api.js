// Consultas del equipo de un proyecto (tabla proyecto_personal, migracion 00146).
//
// Entidad propia dentro del modulo de proyectos, con su propio archivo por el mismo motivo que
// avance.api.js: lo que escribe no es la tabla proyectos. No es el cuadro de turnos de una jornada
// (jornada_personal, jornadas/api.js): aquel lleva horario y rol clinico; este es la gente que
// sostiene el proyecto, este o no en el turno de alguna de sus jornadas.
//
// Todas las funciones devuelven `{ ..., error }` en vez de lanzar, igual que el resto del modulo.
//
// Quien lee y quien escribe lo decide RLS, no este archivo (docs/PERMISOS.md): leen quienes ven el
// proyecto, escribe la administradora o quien tenga proyectos.gestionar.

import { obtenerSupabase } from "../api/cliente.js";
import { normalizarError } from "../api/errores-de-supabase.js";
import { vacioANull } from "./normalizacion.js";

export const ETIQUETA_PERSONA_SIN_NOMBRE = "Nombre no disponible";

// Al INSERTAR el perfil viaja embebido; al LEER no, porque perfiles solo la lee el administrador y
// cada quien la suya (00038), y quien no es administrador recibiria a los demas sin nombre. La
// lectura pasa por equipo_de_proyecto() (00146), una funcion DEFINER que devuelve solo nombres.
const COLUMNAS_DEL_EQUIPO = [
  "id",
  "proyectoId:proyecto_id",
  "perfilId:perfil_id",
  "rolEnProyecto:rol_en_proyecto",
  "createdAt:created_at",
  "perfil:perfiles(nombres, apellidos)",
].join(", ");

function aNombre(perfil) {
  return [perfil?.nombres, perfil?.apellidos].filter(Boolean).join(" ").trim();
}

/** Aplana el perfil embebido a `nombre`, listo para pintar. */
function aMiembro(fila) {
  if (!fila) return null;
  const { perfil, ...resto } = fila;
  return { ...resto, nombre: aNombre(perfil) || ETIQUETA_PERSONA_SIN_NOMBRE };
}

/** Una fila de equipo_de_proyecto() (snake_case, nombres planos) a la forma de aMiembro(). */
function deFilaDeLaFuncion(fila) {
  return {
    id: fila.id,
    proyectoId: fila.proyecto_id,
    perfilId: fila.perfil_id,
    rolEnProyecto: fila.rol_en_proyecto,
    createdAt: fila.created_at,
    nombre: aNombre(fila) || ETIQUETA_PERSONA_SIN_NOMBRE,
  };
}

/**
 * Equipo de un proyecto, en el orden en que se fue armando.
 *
 * @param {string} proyectoId UUID del proyecto.
 * @returns {Promise<{ equipo: object[], error: object|null }>}
 */
export async function listarEquipoDelProyecto(proyectoId) {
  if (!proyectoId) return { equipo: [], error: null };

  try {
    const { data, error } = await obtenerSupabase().rpc("equipo_de_proyecto", {
      p_proyecto_id: proyectoId,
    });

    if (error) return { equipo: [], error: normalizarError(error) };
    // Siempre un arreglo: una lista vacia se dibuja sola, un null obliga a comprobarlo cada vez.
    return { equipo: (data ?? []).map(deFilaDeLaFuncion), error: null };
  } catch (error) {
    return { equipo: [], error: normalizarError(error) };
  }
}

/**
 * Agrega a una persona al equipo de un proyecto.
 *
 * Una persona figura una sola vez por proyecto (UNIQUE en la tabla): repetirla llega como
 * violacion de unicidad ya normalizada, no como un fallo generico.
 *
 * @param {string} proyectoId UUID del proyecto.
 * @param {{ perfilId: string, rolEnProyecto?: string }} datos `rolEnProyecto` es opcional; vacio
 *   se guarda como NULL.
 * @returns {Promise<{ asignacion: object|null, error: object|null }>}
 */
export async function asignarPersonalAProyecto(proyectoId, { perfilId, rolEnProyecto } = {}) {
  if (!proyectoId || !perfilId) return { asignacion: null, error: null };

  try {
    const { data, error } = await obtenerSupabase()
      .from("proyecto_personal")
      .insert({
        proyecto_id: proyectoId,
        perfil_id: perfilId,
        rol_en_proyecto:
          typeof rolEnProyecto === "string" ? vacioANull(rolEnProyecto.trim()) : null,
      })
      .select(COLUMNAS_DEL_EQUIPO)
      .single();

    if (error) return { asignacion: null, error: normalizarError(error) };
    return { asignacion: aMiembro(data), error: null };
  } catch (error) {
    return { asignacion: null, error: normalizarError(error) };
  }
}

/**
 * Quita a una persona del equipo de un proyecto.
 *
 * Un DELETE que RLS no deja pasar no falla: borra cero filas. Por eso se pide la fila de vuelta y
 * `desasignado` solo es true si de verdad se borro algo; sin eso, quien no puede desasignar veria
 * un "listo" que no ocurrio.
 *
 * @param {string} proyectoId UUID del proyecto.
 * @param {string} perfilId UUID del perfil a quitar.
 * @returns {Promise<{ desasignado: boolean, error: object|null }>}
 */
export async function desasignarPersonalDeProyecto(proyectoId, perfilId) {
  if (!proyectoId || !perfilId) return { desasignado: false, error: null };

  try {
    const { data, error } = await obtenerSupabase()
      .from("proyecto_personal")
      .delete()
      .eq("proyecto_id", proyectoId)
      .eq("perfil_id", perfilId)
      .select("id");

    if (error) return { desasignado: false, error: normalizarError(error) };
    return { desasignado: (data ?? []).length > 0, error: null };
  } catch (error) {
    return { desasignado: false, error: normalizarError(error) };
  }
}
