import { obtenerSupabase } from "../api/cliente.js";
import {
  CODIGOS_DE_ERROR_DE_SUPABASE,
  construirError,
  normalizarError,
} from "../api/errores-de-supabase.js";

export const PORCENTAJE_AVANCE_MINIMO = 0;
export const PORCENTAJE_AVANCE_MAXIMO = 100;

const COLUMNAS_DEL_HITO = [
  "id",
  "proyectoId:proyecto_id",
  "nombre",
  "descripcion",
  "fechaPrevista:fecha_prevista",
  "fechaReal:fecha_real",
  "registradoPor:registrado_por",
  "createdAt:created_at",
  "updatedAt:updated_at",
].join(", ");

const COLUMNAS_DEL_SEGUIMIENTO = [
  "id",
  "proyectoId:proyecto_id",
  "nota",
  "porcentajeAnterior:porcentaje_anterior",
  "porcentajeNuevo:porcentaje_nuevo",
  "registradoPor:registrado_por",
  "createdAt:created_at",
].join(", ");

function aColumnasDelHito(datos = {}) {
  const mapa = {
    proyectoId: "proyecto_id",
    nombre: "nombre",
    descripcion: "descripcion",
    fechaPrevista: "fecha_prevista",
    fechaReal: "fecha_real",
  };

  const fila = {};
  for (const [campo, columna] of Object.entries(mapa)) {
    if (Object.prototype.hasOwnProperty.call(datos, campo)) fila[columna] = datos[campo];
  }
  return fila;
}

function errorDeRango() {
  return {
    ...construirError(CODIGOS_DE_ERROR_DE_SUPABASE.CHECK),
    mensaje: `El porcentaje de avance debe estar entre ${PORCENTAJE_AVANCE_MINIMO} y ${PORCENTAJE_AVANCE_MAXIMO}.`,
  };
}

/**
 * Un porcentaje de avance valido es un entero de 0 a 100.
 *
 * Entero y no decimal a proposito: el avance de un proyecto se reporta en puntos enteros, y
 * admitir decimales solo invita a discutir si 33.33 es mas honesto que 33.
 *
 * @param {unknown} porcentaje
 * @returns {boolean}
 */
export function esPorcentajeDeAvanceValido(porcentaje) {
  return (
    Number.isInteger(porcentaje) &&
    porcentaje >= PORCENTAJE_AVANCE_MINIMO &&
    porcentaje <= PORCENTAJE_AVANCE_MAXIMO
  );
}

/**
 * Crea un hito de un proyecto.
 *
 * Un hito nace pendiente: `fechaReal` en NULL es lo que lo marca como no cumplido, y es lo que
 * consultan `listarHitos({ soloPendientes: true })` y la advertencia de cierre.
 *
 * @param {string} proyectoId UUID del proyecto.
 * @param {{ nombre: string, descripcion?: string, fechaPrevista?: string }} datos
 * @returns {Promise<{ hito: object|null, error: object|null }>}
 */
export async function registrarHito(proyectoId, datos) {
  if (!proyectoId) return { hito: null, error: null };

  try {
    const { data, error } = await obtenerSupabase()
      .from("proyecto_hitos")
      .insert(aColumnasDelHito({ ...datos, proyectoId }))
      .select(COLUMNAS_DEL_HITO)
      .single();

    if (error) return { hito: null, error: normalizarError(error) };
    return { hito: data ?? null, error: null };
  } catch (error) {
    return { hito: null, error: normalizarError(error) };
  }
}

/**
 * Cambia los campos de un hito.
 *
 * Solo viajan las columnas que `aColumnasDelHito()` reconoce. Sin id, o sin ningun campo que
 * cambiar, no hace nada y devuelve `error: null`: no hay fallo, no habia nada que guardar.
 *
 * @param {string} id UUID del hito.
 * @param {{ nombre?: string, descripcion?: string, fechaPrevista?: string, fechaReal?: string|null }} datos
 * @returns {Promise<{ hito: object|null, error: object|null }>}
 */
export async function actualizarHito(id, datos) {
  if (!id) return { hito: null, error: null };

  const fila = aColumnasDelHito(datos);
  if (Object.keys(fila).length === 0) return { hito: null, error: null };

  try {
    const { data, error } = await obtenerSupabase()
      .from("proyecto_hitos")
      .update(fila)
      .eq("id", id)
      .select(COLUMNAS_DEL_HITO)
      .maybeSingle();

    if (error) return { hito: null, error: normalizarError(error) };
    return { hito: data ?? null, error: null };
  } catch (error) {
    return { hito: null, error: normalizarError(error) };
  }
}

/**
 * Marca un hito como cumplido poniendole `fechaReal`.
 *
 * Sin fecha explicita usa hoy. Se admite pasarla porque un hito se suele anotar dias despues de
 * que ocurrio, y la fecha que importa es la del hecho, no la de la captura.
 *
 * @param {string} id UUID del hito.
 * @param {string} [fechaReal] Fecha en formato YYYY-MM-DD. Por omision, hoy.
 * @returns {Promise<{ hito: object|null, error: object|null }>}
 */
export function marcarHitoCumplido(id, fechaReal) {
  return actualizarHito(id, { fechaReal: fechaReal ?? new Date().toISOString().slice(0, 10) });
}

/**
 * Deshace el cumplimiento de un hito: vuelve a dejar `fechaReal` en NULL.
 *
 * Para corregir un hito que se marco cumplido por error, o que hubo que reabrir.
 *
 * @param {string} id UUID del hito.
 * @returns {Promise<{ hito: object|null, error: object|null }>}
 */
export function reabrirHito(id) {
  return actualizarHito(id, { fechaReal: null });
}

/**
 * Hitos de un proyecto, ordenados por fecha prevista de la mas proxima a la mas lejana.
 *
 * `soloPendientes` deja los que no tienen `fechaReal`, que es como esta tabla representa "sin
 * cumplir".
 *
 * @param {string} proyectoId UUID del proyecto.
 * @param {{ soloPendientes?: boolean }} [opciones]
 * @returns {Promise<{ hitos: object[], error: object|null }>}
 */
export async function listarHitos(proyectoId, { soloPendientes = false } = {}) {
  if (!proyectoId) return { hitos: [], error: null };

  try {
    let consulta = obtenerSupabase()
      .from("proyecto_hitos")
      .select(COLUMNAS_DEL_HITO)
      .eq("proyecto_id", proyectoId)
      .order("fecha_prevista", { ascending: true });

    if (soloPendientes) consulta = consulta.is("fecha_real", null);

    const { data, error } = await consulta;

    if (error) return { hitos: [], error: normalizarError(error) };
    return { hitos: data ?? [], error: null };
  } catch (error) {
    return { hitos: [], error: normalizarError(error) };
  }
}

/**
 * Fija el porcentaje de avance de un proyecto.
 *
 * No hay que anotar el cambio en la bitacora a mano: el trigger `trg_proyectos_avance_seguimiento`
 * (`00053`) inserta la entrada en `proyecto_seguimiento` con el porcentaje anterior, el nuevo y
 * quien lo hizo. El rastro lo deja la base, no el cliente, para que no dependa de que alguien se
 * acuerde.
 *
 * @param {string} proyectoId UUID del proyecto.
 * @param {number} porcentaje Entero de 0 a 100. Fuera de rango se rechaza sin salir a la red.
 * @returns {Promise<{ proyecto: object|null, error: object|null }>}
 */
export async function actualizarAvance(proyectoId, porcentaje) {
  if (!proyectoId) return { proyecto: null, error: null };

  if (!esPorcentajeDeAvanceValido(porcentaje)) {
    return { proyecto: null, error: errorDeRango() };
  }

  try {
    const { data, error } = await obtenerSupabase()
      .from("proyectos")
      .update({ porcentaje_avance: porcentaje })
      .eq("id", proyectoId)
      .select("id, porcentajeAvance:porcentaje_avance")
      .maybeSingle();

    if (error) return { proyecto: null, error: normalizarError(error) };
    return { proyecto: data ?? null, error: null };
  } catch (error) {
    return { proyecto: null, error: normalizarError(error) };
  }
}

/**
 * Anota una nota escrita a mano en la bitacora del proyecto.
 *
 * Es la otra mitad de `proyecto_seguimiento`: las entradas de cambio de porcentaje las pone el
 * trigger de `actualizarAvance()`, estas las escribe una persona.
 *
 * Una nota vacia o solo con espacios se rechaza aqui, antes de salir a la red. La base tambien lo
 * impide (`chk_proyecto_seguimiento_contenido`), pero el mensaje de aqui dice que hacer.
 *
 * @param {string} proyectoId UUID del proyecto.
 * @param {string} nota Texto de la nota. Se guarda recortado.
 * @returns {Promise<{ entrada: object|null, error: object|null }>}
 */
export async function registrarNota(proyectoId, nota) {
  if (!proyectoId) return { entrada: null, error: null };

  const texto = typeof nota === "string" ? nota.trim() : "";
  if (texto === "") {
    return {
      entrada: null,
      error: {
        ...construirError(CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO),
        mensaje: "La nota de seguimiento no puede ir vacia.",
      },
    };
  }

  try {
    const { data, error } = await obtenerSupabase()
      .from("proyecto_seguimiento")
      .insert({ proyecto_id: proyectoId, nota: texto })
      .select(COLUMNAS_DEL_SEGUIMIENTO)
      .single();

    if (error) return { entrada: null, error: normalizarError(error) };
    return { entrada: data ?? null, error: null };
  } catch (error) {
    return { entrada: null, error: normalizarError(error) };
  }
}

/**
 * Bitacora completa del proyecto, de lo mas reciente a lo mas antiguo.
 *
 * Mezcla las dos clases de entrada: las notas escritas a mano y los cambios de porcentaje que
 * anoto el trigger. Se distinguen por sus campos -una nota trae `nota`, un cambio trae
 * `porcentajeAnterior` y `porcentajeNuevo`-, y por eso van en la misma tabla y en el mismo orden
 * cronologico: la bitacora se lee como una sola historia.
 *
 * @param {string} proyectoId UUID del proyecto.
 * @returns {Promise<{ bitacora: object[], error: object|null }>}
 */
export async function listarSeguimiento(proyectoId) {
  if (!proyectoId) return { bitacora: [], error: null };

  try {
    const { data, error } = await obtenerSupabase()
      .from("proyecto_seguimiento")
      .select(COLUMNAS_DEL_SEGUIMIENTO)
      .eq("proyecto_id", proyectoId)
      .order("created_at", { ascending: false });

    if (error) return { bitacora: [], error: normalizarError(error) };
    return { bitacora: data ?? [], error: null };
  } catch (error) {
    return { bitacora: [], error: normalizarError(error) };
  }
}

/**
 * Advierte de los hitos sin cumplir antes de cerrar un proyecto.
 *
 * Advierte, no bloquea: el mensaje dice explicitamente que se puede cerrar de todas formas. Un
 * proyecto real se cierra a veces con hitos sin cumplir, y la decision es de quien lo dirige; lo
 * que no puede pasar es que se cierre sin que nadie se entere de que quedaban pendientes.
 *
 * Sin hitos pendientes devuelve `advertencia: null`, que es la senal de "no hay nada que decir".
 *
 * @param {string} proyectoId UUID del proyecto.
 * @returns {Promise<{ advertencia: { hitosPendientes: object[], cantidad: number, mensaje: string }|null, error: object|null }>}
 */
export async function obtenerAdvertenciaDeCierre(proyectoId) {
  const { hitos, error } = await listarHitos(proyectoId, { soloPendientes: true });

  if (error) return { advertencia: null, error };

  if (hitos.length === 0) return { advertencia: null, error: null };

  return {
    advertencia: {
      hitosPendientes: hitos,
      cantidad: hitos.length,
      mensaje:
        hitos.length === 1
          ? "El proyecto tiene 1 hito sin cumplir. Puedes cerrarlo de todas formas."
          : `El proyecto tiene ${hitos.length} hitos sin cumplir. Puedes cerrarlo de todas formas.`,
    },
    error: null,
  };
}
