// Consultas de Supabase de los proyectos sociales.
//
// packages/shared/api es la infraestructura del cliente; las consultas de cada modulo van en su
// carpeta, como indica el encabezado de api/index.js. Este archivo es el unico lugar del
// monorepo que lee y escribe la tabla proyectos.
//
// El archivo se llama proyectos.api.js y no api.js porque packages/shared/donaciones/ lo van a
// escribir nueve issues repartidas entre cinco personas (donantes, donaciones, su historial,
// proyectos, su avance, el kanban y los descriptores). Un api.js unico seria un iman de
// conflictos.
//
// Todas las funciones devuelven `{ dato, error }` en vez de lanzar, igual que supabase-js: quien
// las consume es un hook que tiene que reflejar el fallo en pantalla, no reventar el render.
//
// NOTA OPERATIVA: la tabla tiene RLS activo desde la migracion 00030 y sus politicas son la
// issue #90, todavia sin escribir. Hasta que aterrice, estas consultas devuelven cero filas y
// las escrituras fallan con permiso denegado. El codigo es correcto; lo que falta es la politica.

import { obtenerSupabase } from "../api/cliente.js";
import {
  CODIGOS_DE_ERROR_DE_SUPABASE,
  construirError,
  normalizarError,
} from "../api/errores-de-supabase.js";
import { ESTADOS_PROYECTO, validarCambioDeEstadoProyecto } from "./validaciones.js";

// Las columnas se enumeran en lugar de pedir "*" para que una columna nueva en proyectos no
// empiece a viajar sola hasta el cliente.
//
// Se piden con alias en camelCase porque asi son los ids de los descriptores que consumen las
// pantallas (ver COLUMNAS_PACIENTE y COLUMNAS_USUARIO): si la API devolviera snake_case, cada
// pantalla tendria que renombrar los campos a mano y la columna se dibujaria vacia si se
// olvidara.
const COLUMNAS_DEL_PROYECTO = [
  "id",
  "nombre",
  "descripcion",
  "fechaInicio:fecha_inicio",
  "fechaFin:fecha_fin",
  "responsableId:responsable_id",
  "estado",
  "porcentajeAvance:porcentaje_avance",
  "ordenColumna:orden_columna",
  "createdAt:created_at",
  "updatedAt:updated_at",
].join(", ");

/** Traduce del camelCase de las pantallas al snake_case de la tabla, omitiendo lo no enviado. */
function aColumnasDeTabla(datos = {}) {
  const mapa = {
    nombre: "nombre",
    descripcion: "descripcion",
    fechaInicio: "fecha_inicio",
    fechaFin: "fecha_fin",
    responsableId: "responsable_id",
    estado: "estado",
    porcentajeAvance: "porcentaje_avance",
    ordenColumna: "orden_columna",
  };

  const fila = {};
  for (const [campo, columna] of Object.entries(mapa)) {
    // Solo se envia lo que venga en el objeto: un update parcial no debe borrar lo que no toca.
    if (Object.prototype.hasOwnProperty.call(datos, campo)) fila[columna] = datos[campo];
  }
  return fila;
}

/**
 * Crea un proyecto.
 *
 * @param {object} datos Campos en camelCase. `nombre` es el unico obligatorio en la tabla.
 * @returns {Promise<{ proyecto: object|null, error: object|null }>}
 */
export async function crearProyecto(datos) {
  try {
    const { data, error } = await obtenerSupabase()
      .from("proyectos")
      .insert(aColumnasDeTabla(datos))
      .select(COLUMNAS_DEL_PROYECTO)
      .single();

    if (error) return { proyecto: null, error: normalizarError(error) };
    return { proyecto: data ?? null, error: null };
  } catch (error) {
    // Un fallo de red no llega por el campo error sino como excepcion del fetch.
    return { proyecto: null, error: normalizarError(error) };
  }
}

/**
 * Lee un proyecto por su id.
 *
 * `proyecto` llega en null sin error cuando la fila no existe o cuando RLS no deja verla. Son
 * casos distintos para la base de datos pero el mismo para el cliente: no hay proyecto con el
 * que trabajar.
 */
export async function obtenerProyecto(id) {
  if (!id) return { proyecto: null, error: null };

  try {
    const { data, error } = await obtenerSupabase()
      .from("proyectos")
      .select(COLUMNAS_DEL_PROYECTO)
      .eq("id", id)
      .maybeSingle();

    if (error) return { proyecto: null, error: normalizarError(error) };
    return { proyecto: data ?? null, error: null };
  } catch (error) {
    return { proyecto: null, error: normalizarError(error) };
  }
}

/**
 * Lista los proyectos, opcionalmente filtrados.
 *
 * Los dos filtros son los que pide el criterio de aceptacion de la issue #194. Un filtro
 * ausente o nulo no se aplica, para que la pantalla pueda pasar su estado de filtros tal cual
 * sin ir limpiando claves vacias.
 *
 * @param {{ estado?: string, responsableId?: string }} [filtros]
 * @returns {Promise<{ proyectos: object[], error: object|null }>}
 */
export async function listarProyectos({ estado, responsableId } = {}) {
  try {
    let consulta = obtenerSupabase()
      .from("proyectos")
      .select(COLUMNAS_DEL_PROYECTO)
      // Por fecha de inicio y no por created_at: a quien planifica le importa cuando arranca el
      // proyecto, no cuando alguien lo capturo. Los sin fecha quedan al final.
      .order("fecha_inicio", { ascending: true, nullsFirst: false })
      .order("nombre", { ascending: true });

    if (estado) consulta = consulta.eq("estado", estado);
    if (responsableId) consulta = consulta.eq("responsable_id", responsableId);

    const { data, error } = await consulta;

    if (error) return { proyectos: [], error: normalizarError(error) };
    // Siempre un arreglo: una lista vacia se dibuja sola, un null obliga a comprobarlo cada vez.
    return { proyectos: data ?? [], error: null };
  } catch (error) {
    return { proyectos: [], error: normalizarError(error) };
  }
}

/**
 * Actualiza los datos de un proyecto.
 *
 * No cambia el estado aunque se le pase: para eso esta cambiarEstadoProyecto(), que valida la
 * transicion. Dejar que un update generico moviera el estado permitiria saltarse esa validacion
 * sin querer.
 */
export async function actualizarProyecto(id, datos) {
  // El estado se quita a proposito: moverlo es tarea de cambiarEstadoProyecto(), que valida la
  // transicion. Se borra de una copia en vez de desestructurarlo para no dejar una variable sin
  // usar, que el linter marca con razon.
  const sinEstado = { ...(datos ?? {}) };
  delete sinEstado.estado;
  const fila = aColumnasDeTabla(sinEstado);

  if (Object.keys(fila).length === 0) {
    return { proyecto: null, error: null };
  }

  try {
    const { data, error } = await obtenerSupabase()
      .from("proyectos")
      .update(fila)
      .eq("id", id)
      .select(COLUMNAS_DEL_PROYECTO)
      .maybeSingle();

    if (error) return { proyecto: null, error: normalizarError(error) };
    return { proyecto: data ?? null, error: null };
  } catch (error) {
    return { proyecto: null, error: normalizarError(error) };
  }
}

/**
 * Cambia el estado de un proyecto validando que la transicion sea legal.
 *
 * Es la primitiva de transicion del modulo: el tablero kanban de la issue #307 se construye
 * encima de esta funcion en vez de repetir la tabla de transiciones, que terminaria
 * desincronizada del trigger.
 *
 * Primero se lee el estado actual para poder decir que transiciones si son posibles. El trigger
 * tr_validar_transicion_estado_proyecto (migracion 00029) vuelve a comprobarlo en el servidor:
 * esta validacion es para dar un mensaje util, no para sustituirlo.
 */
export async function cambiarEstadoProyecto(id, nuevoEstado) {
  const { proyecto, error: errorDeLectura } = await obtenerProyecto(id);
  if (errorDeLectura) return { proyecto: null, error: errorDeLectura };

  if (!proyecto) {
    return {
      proyecto: null,
      error: construirError(CODIGOS_DE_ERROR_DE_SUPABASE.SIN_RESULTADOS, "proyecto no encontrado"),
    };
  }

  const errores = validarCambioDeEstadoProyecto(proyecto.estado, nuevoEstado);
  if (errores.estado) {
    // Se reusa la clasificacion CHECK: es la misma clase de problema que levantaria el trigger,
    // asi que quien lo atrape no tiene que distinguir si lo rechazo el cliente o el servidor.
    return {
      proyecto: null,
      error: { ...construirError(CODIGOS_DE_ERROR_DE_SUPABASE.CHECK), mensaje: errores.estado },
    };
  }

  try {
    const { data, error } = await obtenerSupabase()
      .from("proyectos")
      .update({ estado: nuevoEstado })
      .eq("id", id)
      .select(COLUMNAS_DEL_PROYECTO)
      .maybeSingle();

    if (error) return { proyecto: null, error: normalizarError(error) };
    return { proyecto: data ?? null, error: null };
  } catch (error) {
    return { proyecto: null, error: normalizarError(error) };
  }
}

/** Cierra un proyecto: lo pasa a finalizado, si viene de en curso. */
export function cerrarProyecto(id) {
  return cambiarEstadoProyecto(id, ESTADOS_PROYECTO.FINALIZADO);
}

/**
 * Asocia una jornada a un proyecto, o la desasocia si `proyectoId` es null.
 *
 * El vinculo vive en jornadas.proyecto_id (migracion 00012) y no en una tabla intermedia: una
 * jornada pertenece a un solo proyecto.
 */
export async function asociarJornadaAProyecto(jornadaId, proyectoId) {
  if (!jornadaId) return { jornada: null, error: null };

  try {
    const { data, error } = await obtenerSupabase()
      .from("jornadas")
      .update({ proyecto_id: proyectoId ?? null })
      .eq("id", jornadaId)
      .select("id, proyectoId:proyecto_id")
      .maybeSingle();

    if (error) return { jornada: null, error: normalizarError(error) };
    return { jornada: data ?? null, error: null };
  } catch (error) {
    return { jornada: null, error: normalizarError(error) };
  }
}

/** Jornadas asociadas a un proyecto. Util para la ficha del proyecto. */
export async function listarJornadasDelProyecto(proyectoId) {
  if (!proyectoId) return { jornadas: [], error: null };

  try {
    const { data, error } = await obtenerSupabase()
      .from("jornadas")
      .select("id, nombre, fecha, estado")
      .eq("proyecto_id", proyectoId)
      .order("fecha", { ascending: true });

    if (error) return { jornadas: [], error: normalizarError(error) };
    return { jornadas: data ?? [], error: null };
  } catch (error) {
    return { jornadas: [], error: normalizarError(error) };
  }
}
