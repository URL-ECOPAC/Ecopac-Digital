// Consultas de Supabase del buzon de notificaciones (issue #755).
//
// Las notificaciones las escriben los triggers de la migracion 00138 -una por incidencia y por
// administrador activo-; la aplicacion solo las lee y las marca como leidas. RLS deja a cada
// perfil ver y tocar solo las suyas, y el GRANT de UPDATE es solo sobre leida_en: aqui no hay
// ninguna comprobacion de rol que duplique eso.
//
// Se filtra ademas por perfil_id aunque RLS ya lo haga: la consulta usa asi el indice
// idx_notificaciones_perfil_creada, y lo que pide la pantalla queda escrito en la consulta en vez
// de depender de que la politica siga siendo la que es.
//
// Todas devuelven un sobre y no lanzan, igual que el resto de *.api.js. La clave de cada sobre
// esta en su JSDoc: { notificaciones }, { cantidad }, { notificacion } o { actualizadas }.

import { obtenerSupabase } from "../api/cliente.js";
import { normalizarError } from "../api/errores-de-supabase.js";

const COLUMNAS_DE_LA_NOTIFICACION = [
  "id",
  "categoria",
  "titulo",
  "cuerpo",
  "enlace",
  "origenTabla:origen_tabla",
  "origenId:origen_id",
  "leidaEn:leida_en",
  "createdAt:created_at",
].join(", ");

// Un buzon no se lee entero: las 100 mas recientes cubren de sobra lo que una persona revisa, y
// el contador de no leidas (contarNoLeidas) no depende de este limite.
const LIMITE_DEL_BUZON = 100;

function aNotificacion(fila) {
  if (!fila) return null;
  return {
    id: fila.id,
    categoria: fila.categoria,
    titulo: fila.titulo,
    cuerpo: fila.cuerpo,
    enlace: fila.enlace,
    origenTabla: fila.origenTabla,
    origenId: fila.origenId,
    leidaEn: fila.leidaEn,
    leida: Boolean(fila.leidaEn),
    createdAt: fila.createdAt,
  };
}

/**
 * Notificaciones del perfil, la mas reciente primero (orden de llegada).
 *
 * @param {string} perfilId
 * @returns {Promise<{ notificaciones: object[], error: object|null }>}
 */
export async function listarNotificaciones(perfilId) {
  try {
    const { data, error } = await obtenerSupabase()
      .from("notificaciones")
      .select(COLUMNAS_DE_LA_NOTIFICACION)
      .eq("perfil_id", perfilId)
      .order("created_at", { ascending: false })
      .limit(LIMITE_DEL_BUZON);

    if (error) return { notificaciones: [], error: normalizarError(error) };
    return { notificaciones: (data ?? []).map(aNotificacion), error: null };
  } catch (error) {
    return { notificaciones: [], error: normalizarError(error) };
  }
}

/**
 * Cuantas notificaciones sin leer tiene el perfil. Es lo que pinta el contador de la cabecera, asi
 * que se pide solo el conteo (head: true), sin traer filas.
 *
 * @param {string} perfilId
 * @returns {Promise<{ cantidad: number, error: object|null }>}
 */
export async function contarNoLeidas(perfilId) {
  try {
    const { count, error } = await obtenerSupabase()
      .from("notificaciones")
      .select("id", { count: "exact", head: true })
      .eq("perfil_id", perfilId)
      .is("leida_en", null);

    if (error) return { cantidad: 0, error: normalizarError(error) };
    return { cantidad: count ?? 0, error: null };
  } catch (error) {
    return { cantidad: 0, error: normalizarError(error) };
  }
}

/**
 * Marca una notificacion como leida. Si ya lo estaba, conserva la fecha original: solo se escribe
 * sobre las que tienen leida_en en NULL.
 *
 * @param {string} idNotificacion
 * @returns {Promise<{ notificacion: object|null, error: object|null }>}
 */
export async function marcarLeida(idNotificacion) {
  try {
    const { data, error } = await obtenerSupabase()
      .from("notificaciones")
      .update({ leida_en: new Date().toISOString() })
      .eq("id", idNotificacion)
      .is("leida_en", null)
      .select(COLUMNAS_DE_LA_NOTIFICACION)
      .maybeSingle();

    if (error) return { notificacion: null, error: normalizarError(error) };
    return { notificacion: aNotificacion(data), error: null };
  } catch (error) {
    return { notificacion: null, error: normalizarError(error) };
  }
}

/**
 * Marca como leidas todas las notificaciones pendientes del perfil.
 *
 * @param {string} perfilId
 * @returns {Promise<{ actualizadas: number, error: object|null }>}
 */
export async function marcarTodasLeidas(perfilId) {
  try {
    const { data, error } = await obtenerSupabase()
      .from("notificaciones")
      .update({ leida_en: new Date().toISOString() })
      .eq("perfil_id", perfilId)
      .is("leida_en", null)
      .select("id");

    if (error) return { actualizadas: 0, error: normalizarError(error) };
    return { actualizadas: (data ?? []).length, error: null };
  } catch (error) {
    return { actualizadas: 0, error: normalizarError(error) };
  }
}
