// Consultas de Supabase del modulo de usuarios.
//
// packages/shared/api es la infraestructura del cliente; las consultas de cada modulo van en
// el api.js de su carpeta, tal como lo indica el encabezado de api/index.js. Este archivo es
// el unico lugar del monorepo que lee la tabla perfiles.

import { obtenerSupabase } from "../api/cliente.js";
import {
  CODIGOS_DE_ERROR_DE_SUPABASE,
  construirError,
  normalizarError,
} from "../api/errores-de-supabase.js";
import { ESTADOS_USUARIO } from "./campos.js";
import { validarPerfil } from "./validaciones.js";

// Las columnas se enumeran en lugar de pedir "*" para que una columna nueva en perfiles no
// empiece a viajar sola hasta el cliente. Aqui no va perfil_especialidad: quien la necesite
// la pide aparte y no la carga toda la aplicacion en cada arranque.
//
// fecha_ingreso se pide con alias en camelCase porque asi la declaran los descriptores que
// consumen las pantallas (COLUMNAS_USUARIO y CAMPOS_USUARIO). DataList busca el valor por el
// id de la columna, asi que devolverla en snake_case dejaba esa columna vacia sin avisar de
// nada. Es la misma convencion que sigue donaciones/proyectos.api.js.
const COLUMNAS_DEL_PERFIL =
  "id, nombres, apellidos, email, telefono, rol, activo, fechaIngreso:fecha_ingreso";

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

export const FUNCION_DE_INVITACION = "invitar-usuario";

const CAMPOS_EDITABLES = {
  nombres: "nombres",
  apellidos: "apellidos",
  telefono: "telefono",
  rol: "rol",
  fechaIngreso: "fecha_ingreso",
};

function aFiltroDeActivo(estado) {
  if (typeof estado === "boolean") return estado;
  const opcion = ESTADOS_USUARIO.find(({ clave }) => clave === estado);
  return opcion ? opcion.valor : null;
}

function aColumnasEditables(datos = {}) {
  const fila = {};
  for (const [campo, columna] of Object.entries(CAMPOS_EDITABLES)) {
    if (Object.prototype.hasOwnProperty.call(datos, campo)) fila[columna] = datos[campo];
  }
  return fila;
}

function escaparPatron(texto) {
  return texto.replace(/[%_,()]/g, " ").trim();
}

async function cambiarActivo(idUsuario, activo) {
  if (!idUsuario) return { perfil: null, error: null };

  try {
    const { data, error } = await obtenerSupabase()
      .from("perfiles")
      .update({ activo })
      .eq("id", idUsuario)
      .select(COLUMNAS_DEL_PERFIL)
      .maybeSingle();

    if (error) return { perfil: null, error: normalizarError(error) };
    return { perfil: data ?? null, error: null };
  } catch (error) {
    return { perfil: null, error: normalizarError(error) };
  }
}

export async function listarUsuarios({ busqueda, rol, estado } = {}) {
  try {
    let consulta = obtenerSupabase()
      .from("perfiles")
      .select(COLUMNAS_DEL_PERFIL)
      .order("apellidos", { ascending: true })
      .order("nombres", { ascending: true });

    if (rol) consulta = consulta.eq("rol", rol);

    const activo = aFiltroDeActivo(estado);
    if (activo !== null) consulta = consulta.eq("activo", activo);

    const texto = typeof busqueda === "string" ? escaparPatron(busqueda) : "";
    if (texto !== "") {
      const patron = `%${texto}%`;
      consulta = consulta.or(
        `nombres.ilike.${patron},apellidos.ilike.${patron},email.ilike.${patron}`,
      );
    }

    const { data, error } = await consulta;

    if (error) return { usuarios: [], error: normalizarError(error) };
    return { usuarios: data ?? [], error: null };
  } catch (error) {
    return { usuarios: [], error: normalizarError(error) };
  }
}

export async function crearUsuario(datos) {
  const errores = validarPerfil(datos ?? {});
  if (Object.keys(errores).length > 0) {
    return {
      usuario: null,
      errores,
      error: {
        ...construirError(CODIGOS_DE_ERROR_DE_SUPABASE.CHECK),
        mensaje: "Revisa los datos del formulario antes de invitar al usuario.",
      },
    };
  }

  const { nombres, apellidos, email, telefono, rol } = datos;

  try {
    const { data, error } = await obtenerSupabase().functions.invoke(FUNCION_DE_INVITACION, {
      body: { nombres, apellidos, email, telefono, rol },
    });

    if (error) return { usuario: null, errores: {}, error: normalizarError(error) };
    return { usuario: data ?? null, errores: {}, error: null };
  } catch (error) {
    return { usuario: null, errores: {}, error: normalizarError(error) };
  }
}

export async function actualizarUsuario(idUsuario, datos) {
  if (!idUsuario) return { perfil: null, errores: {}, error: null };

  const fila = aColumnasEditables(datos);
  if (Object.keys(fila).length === 0) return { perfil: null, errores: {}, error: null };

  const errores = validarPerfil({ ...datos, email: undefined });
  const relevantes = {};
  for (const campo of Object.keys(fila)) {
    const campoEnCamelCase = Object.keys(CAMPOS_EDITABLES).find(
      (clave) => CAMPOS_EDITABLES[clave] === campo,
    );
    if (errores[campoEnCamelCase]) relevantes[campoEnCamelCase] = errores[campoEnCamelCase];
  }

  if (Object.keys(relevantes).length > 0) {
    return {
      perfil: null,
      errores: relevantes,
      error: {
        ...construirError(CODIGOS_DE_ERROR_DE_SUPABASE.CHECK),
        mensaje: "Revisa los datos del formulario antes de guardar.",
      },
    };
  }

  try {
    const { data, error } = await obtenerSupabase()
      .from("perfiles")
      .update(fila)
      .eq("id", idUsuario)
      .select(COLUMNAS_DEL_PERFIL)
      .maybeSingle();

    if (error) return { perfil: null, errores: {}, error: normalizarError(error) };
    return { perfil: data ?? null, errores: {}, error: null };
  } catch (error) {
    return { perfil: null, errores: {}, error: normalizarError(error) };
  }
}

export function desactivarUsuario(idUsuario) {
  return cambiarActivo(idUsuario, false);
}

export function reactivarUsuario(idUsuario) {
  return cambiarActivo(idUsuario, true);
}
