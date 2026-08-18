// Consultas de Supabase del modulo de usuarios.
//
// packages/shared/api es la infraestructura del cliente; las consultas de cada modulo van en
// el api.js de su carpeta, tal como lo indica el encabezado de api/index.js. Este archivo es
// el unico lugar del monorepo que lee la tabla perfiles.

import { obtenerSupabase } from "../api/cliente.js";
import { normalizarError } from "../api/errores-de-supabase.js";

// Las columnas se enumeran en lugar de pedir "*" para que una columna nueva en perfiles no
// empiece a viajar sola hasta el cliente. Aqui no va perfil_especialidad: quien la necesite
// la pide aparte y no la carga toda la aplicacion en cada arranque.
const COLUMNAS_DEL_PERFIL = "id, nombres, apellidos, email, telefono, rol, activo, fecha_ingreso";

/**
 * Lee el perfil de un usuario autenticado.
 *
 * Devuelve `{ perfil, error }` en vez de lanzar, igual que supabase-js: quien lo consume es
 * un hook que tiene que reflejar el fallo en pantalla, no reventar el render.
 *
 * `perfil` llega en `null` sin error cuando la fila no existe o cuando RLS no deja verla.
 * Son casos distintos para la base de datos pero el mismo para el cliente: no hay perfil con
 * el que trabajar. Quien llama decide que hacer con eso.
 *
 * @param {string} idUsuario UUID de auth.users, que es tambien la llave de perfiles.
 * @returns {Promise<{ perfil: object|null, error: object|null }>}
 */
export async function obtenerPerfil(idUsuario) {
  if (!idUsuario) {
    return { perfil: null, error: null };
  }

  try {
    const { data, error } = await obtenerSupabase()
      .from("perfiles")
      .select(COLUMNAS_DEL_PERFIL)
      .eq("id", idUsuario)
      .maybeSingle();

    if (error) {
      return { perfil: null, error: normalizarError(error) };
    }

    return { perfil: data ?? null, error: null };
  } catch (error) {
    // Un fallo de red no llega por el campo error sino como excepcion del fetch.
    return { perfil: null, error: normalizarError(error) };
  }
}
