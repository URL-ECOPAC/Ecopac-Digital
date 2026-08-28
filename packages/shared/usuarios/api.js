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
// empiece a viajar sola hasta el cliente. Aqui no va perfil_especialidad: la comparten
// obtenerPerfil(), cambiarActivo() y actualizarUsuario(), y ninguna de las tres necesita las
// especialidades. listarUsuarios() si las necesita (issue #175, criterio 3): las pide en su
// propio select(), aparte de esta constante, para no cambiarles el retorno a las otras tres.
//
// fecha_ingreso se pide con alias en camelCase porque asi la declaran los descriptores que
// consumen las pantallas (COLUMNAS_USUARIO y CAMPOS_USUARIO). DataList busca el valor por el
// id de la columna, asi que devolverla en snake_case dejaba esa columna vacia sin avisar de
// nada. Es la misma convencion que sigue donaciones/proyectos.api.js.
const COLUMNAS_DEL_PERFIL =
  "id, nombres, apellidos, email, telefono, rol, activo, fechaIngreso:fecha_ingreso";

// Especialidades embebidas para listarUsuarios() (issue #175, criterio 3): perfil_especialidad
// no tiene columna id, solo la pareja (perfil_id, nombre_especialidad), asi que no hay mas que
// pedir. Requiere la politica RLS de la migracion 00058; sin ella, cada perfil llega con
// especialidades: [] para cualquiera, incluida la administradora.
const ESPECIALIDADES_DEL_PERFIL = "especialidades:perfil_especialidad(nombre_especialidad)";

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

/**
 * Ids de perfil con una especialidad dada.
 *
 * Dos consultas encadenadas (perfil_especialidad -> perfiles) en vez de un embed filtrado, mismo
 * patron y mismo motivo que idsPorPrincipioActivo() en inventario/medicamentos.api.js: un embed
 * con `!inner` para filtrar tambien recorta que filas del embed se devuelven, y listarUsuarios()
 * necesita el arreglo COMPLETO de especialidades de cada perfil (criterio 3) al mismo tiempo que
 * filtra por una sola (criterio 1). Lanza en vez de devolver `{ error }`, igual que su modelo:
 * el try/catch de listarUsuarios() la atrapa y normaliza el error ahi.
 */
async function idsDePerfilPorEspecialidad(especialidad) {
  const { data, error } = await obtenerSupabase()
    .from("perfil_especialidad")
    .select("perfil_id")
    .eq("nombre_especialidad", especialidad);

  if (error) throw error;
  return (data ?? []).map((fila) => fila.perfil_id);
}

/**
 * Lista el personal, opcionalmente filtrado.
 *
 * `rol` acepta cualquiera de los cinco valores de ROLES (roles.js): esta funcion no restringe
 * cuales, la columna `rol` de perfiles ya los admite todos (issue #175, criterio 5). Quien SI
 * restringe cuantas filas llegan es RLS: la politica de perfiles (00038) solo deja ver todo el
 * personal a la administradora; cualquier otro perfil autenticado solo se ve a si mismo, sin
 * error (RLS filtra filas, no avisa). No es un limite de esta funcion: es la politica de
 * perfiles funcionando como esta escrita.
 *
 * `especialidad` filtra por una sola especialidad a la vez (FILTROS_USUARIO la declara
 * `TIPOS_DE_FILTRO.SELECT`, no MULTI_SELECT): primero resuelve que perfiles la tienen
 * (idsDePerfilPorEspecialidad()), despues acota la consulta principal con `.in("id", ids)`. Si
 * ningun perfil tiene esa especialidad, corta ahi devolviendo lista vacia sin tocar `perfiles`
 * (mismo guard que medicamentos.api.js con `idsDePrincipioActivo`).
 *
 * Cada perfil devuelto trae `especialidades` como arreglo de strings (issue #175, criterio 3),
 * nunca de objetos: es la forma que espera el render `chips` de DataList (ver
 * CAMPOS_FICHA_VOLUNTARIO.especialidades en columnas.js). Requiere la politica RLS de la
 * migracion 00058: sin ella, el embed llega vacio para cualquiera, incluida la administradora.
 *
 * `limite` y `pagina` acotan el resultado con `.range()` y piden el total con `count: "exact"`
 * (issue #105, criterio 4: la lista pagina y no carga todos los perfiles de una vez). Ambos son
 * opcionales: sin ellos la funcion se comporta como antes y devuelve todo, para no romper a
 * quien ya la llamaba. `total` es la cantidad de filas que cumplen los filtros, sin paginar, y
 * es lo que necesita la pantalla para saber cuantas paginas hay.
 *
 * @param {{ busqueda?: string, rol?: string, estado?: string|boolean, especialidad?: string,
 *   limite?: number, pagina?: number }} [filtros]
 * @returns {Promise<{ usuarios: object[], total: number, error: object|null }>}
 */
export async function listarUsuarios({
  busqueda,
  rol,
  estado,
  especialidad,
  limite,
  pagina = 1,
} = {}) {
  try {
    let idsFiltrados = null;
    if (especialidad) {
      idsFiltrados = await idsDePerfilPorEspecialidad(especialidad);
      if (idsFiltrados.length === 0) return { usuarios: [], total: 0, error: null };
    }

    const pagina_ = Math.max(1, Number(pagina) || 1);
    const porPagina = limite === undefined || limite === null ? null : Math.max(1, Number(limite));

    let consulta = obtenerSupabase()
      .from("perfiles")
      .select(
        `${COLUMNAS_DEL_PERFIL}, ${ESPECIALIDADES_DEL_PERFIL}`,
        porPagina === null ? undefined : { count: "exact" },
      )
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

    if (idsFiltrados) consulta = consulta.in("id", idsFiltrados);

    if (porPagina !== null) {
      const desde = (pagina_ - 1) * porPagina;
      consulta = consulta.range(desde, desde + porPagina - 1);
    }

    const { data, error, count } = await consulta;

    if (error) return { usuarios: [], total: 0, error: normalizarError(error) };

    const usuarios = (data ?? []).map((fila) => ({
      ...fila,
      especialidades: (fila.especialidades ?? []).map((item) => item.nombre_especialidad),
    }));

    return { usuarios, total: count ?? usuarios.length, error: null };
  } catch (error) {
    return { usuarios: [], total: 0, error: normalizarError(error) };
  }
}

/**
 * Cuenta en cuantas jornadas participo cada perfil de la lista que se le pase.
 *
 * Una sola consulta a jornada_personal para todos los perfiles de la pagina, y el conteo se
 * hace aqui. Es a proposito: obtenerJornadasDePersona() de jornadas/api.js resuelve una persona
 * a la vez, y llamarla por fila seria el N+1 que fn_atenciones_de_persona_por_jornada (00059) se
 * escribio justamente para evitar.
 *
 * Devuelve un objeto plano `{ [perfilId]: numero }`. Un perfil sin jornadas no aparece en el
 * resultado: quien lo consume le asigna cero, igual que hace obtenerJornadasDePersona() con las
 * jornadas ausentes.
 *
 * @param {string[]} perfilIds UUIDs de los perfiles a contar.
 * @returns {Promise<{ conteos: object, error: object|null }>}
 */
export async function contarJornadasPorPerfil(perfilIds = []) {
  if (!Array.isArray(perfilIds) || perfilIds.length === 0) {
    return { conteos: {}, error: null };
  }

  try {
    const { data, error } = await obtenerSupabase()
      .from("jornada_personal")
      .select("perfil_id")
      .in("perfil_id", perfilIds);

    if (error) return { conteos: {}, error: normalizarError(error) };

    const conteos = {};
    for (const fila of data ?? []) {
      conteos[fila.perfil_id] = (conteos[fila.perfil_id] ?? 0) + 1;
    }

    return { conteos, error: null };
  } catch (error) {
    return { conteos: {}, error: normalizarError(error) };
  }
}

/**
 * Catalogo de especialidades para poblar el filtro `especialidad` de FILTROS_USUARIO (issue
 * #175, criterio 2).
 *
 * perfil_especialidad no tiene una tabla catalogo aparte (nombre_especialidad es texto libre,
 * ver migracion 00002): este catalogo es literalmente el conjunto de especialidades ya
 * asignadas a algun perfil, sin deduplicar en SQL (PostgREST no expone DISTINCT) sino en JS con
 * un Set. No filtra por perfiles.activo: una especialidad de un perfil desactivado sigue
 * apareciendo, para no esconder una opcion que podria volver a hacer falta si ese perfil se
 * reactiva.
 *
 * Requiere la politica RLS de la migracion 00058: para cualquiera que no sea administrador, el
 * catalogo solo refleja sus propias especialidades, no las de todo el personal (mismo limite
 * que listarUsuarios(), ver su comentario arriba).
 *
 * @returns {Promise<{ especialidades: Array<{ etiqueta: string, valor: string }>, error: object|null }>}
 */
export async function listarCatalogoEspecialidades() {
  try {
    const { data, error } = await obtenerSupabase()
      .from("perfil_especialidad")
      .select("nombre_especialidad");

    if (error) return { especialidades: [], error: normalizarError(error) };

    const nombres = [...new Set((data ?? []).map((fila) => fila.nombre_especialidad))].sort(
      (a, b) => a.localeCompare(b),
    );

    return {
      especialidades: nombres.map((nombre) => ({ valor: nombre, etiqueta: nombre })),
      error: null,
    };
  } catch (error) {
    return { especialidades: [], error: normalizarError(error) };
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

/**
 * Inicia sesión utilizando email y contraseña con Supabase Auth.
 *
 * @param {string} email Correo electrónico del usuario.
 * @param {string} contrasena Contraseña del usuario.
 * @returns {Promise<{ sesion: object|null, usuario: object|null, error: object|null, erroresDeCampo: object }>}
 */

export async function iniciarSesion(email, contrasena) {
  const erroresDeCampo = {};

  if (!email?.trim()) {
    erroresDeCampo.email = "El correo electrónico es obligatorio.";
  }
  if (!contrasena) {
    erroresDeCampo.contrasena = "La contraseña es obligatoria.";
  }

  if (Object.keys(erroresDeCampo).length > 0) {
    return {
      sesion: null,
      usuario: null,
      error: { mensaje: "Por favor llena los campos requeridos." },
      erroresDeCampo,
    };
  }

  try {
    const { data, error } = await obtenerSupabase().auth.signInWithPassword({
      email,
      password: contrasena,
    });

    if (error) {
      // Mensaje genérico por seguridad (criterio del issue #100)
      return {
        sesion: null,
        usuario: null,
        error: { mensaje: "Credenciales inválidas. Verifica tus datos." },
        erroresDeCampo: {},
      };
    }

    return {
      sesion: data.session,
      usuario: data.user,
      error: null,
      erroresDeCampo: {},
    };
  } catch (error) {
    return {
      sesion: null,
      usuario: null,
      error: normalizarError(error),
      erroresDeCampo: {},
    };
  }
}

/**
 * Cierra la sesión activa en Supabase Auth.
 */
export async function cerrarSesion() {
  try {
    const { error } = await obtenerSupabase().auth.signOut();
    if (error) return { error: normalizarError(error) };
    return { error: null };
  } catch (error) {
    return { error: normalizarError(error) };
  }
}

/**
 * Comprueba que una contraseña sea la actual de la sesión, sin cerrarla.
 *
 * Supabase no tiene un endpoint dedicado para "verificar la contraseña actual": la unica forma
 * de confirmar que alguien la conoce es volver a autenticarse con ella. Un
 * signInWithPassword() que falla no toca la sesion existente (GoTrue no guarda nada ni emite
 * evento si hay error); uno que tiene exito SI reemplaza los tokens de la sesion activa y
 * dispara un SIGNED_IN, pero como es el mismo usuario eso solo hace que useSesion() vuelva a
 * leer su propio perfil (issue #102, verificacion A del plan) - no cierra sesion, no cambia de
 * usuario, no parpadea la pantalla.
 *
 * A proposito NO se llama a usuarios/api.js#iniciarSesion() de este mismo archivo para esto:
 * esa funcion es la copia divergente que no revisa perfil.activo (bug conocido, ver
 * docs/PERMISOS.md), y reusarla aqui heredaria ese hueco justo en el punto donde se confirma
 * una contrasena.
 *
 * @param {string} email Correo del perfil de la sesion actual (perfiles.email es citext).
 * @param {string} contrasenaActual
 * @returns {Promise<{ valida: boolean, error: object|null }>}
 */
export async function reverificarContrasena(email, contrasenaActual) {
  if (!email || !contrasenaActual) {
    return { valida: false, error: null };
  }

  try {
    const { error } = await obtenerSupabase().auth.signInWithPassword({
      email,
      password: contrasenaActual,
    });

    if (error) return { valida: false, error: normalizarError(error) };
    return { valida: true, error: null };
  } catch (error) {
    return { valida: false, error: normalizarError(error) };
  }
}

/**
 * Especialidades de un solo perfil.
 *
 * obtenerPerfil() las excluye a proposito (ver su comentario, mas arriba en este archivo:
 * las comparte con cambiarActivo() y actualizarUsuario(), que no las necesitan) y
 * listarUsuarios() las trae embebidas pero para un listado paginado completo, no para un
 * perfil suelto. Hace falta esta funcion aparte para la pantalla de perfil propio (issue #102).
 *
 * Requiere la politica RLS de la migracion 00058 (administrador o el propio perfil); es de
 * solo lectura, no hay escritura de especialidades todavia (issue #405). Una lista vacia no es
 * un error: puede ser que el perfil no tenga ninguna, o que RLS haya filtrado la fila sin
 * avisar (RLS filtra filas, no las anuncia, mismo criterio que el resto del modulo) - las dos
 * cosas se ven igual desde aqui y a quien llama no le hace falta distinguirlas.
 *
 * @param {string} idUsuario UUID de perfiles.id.
 * @returns {Promise<{ especialidades: string[], error: object|null }>}
 */
export async function obtenerEspecialidadesDePerfil(idUsuario) {
  if (!idUsuario) return { especialidades: [], error: null };

  try {
    const { data, error } = await obtenerSupabase()
      .from("perfil_especialidad")
      .select("nombre_especialidad")
      .eq("perfil_id", idUsuario);

    if (error) return { especialidades: [], error: normalizarError(error) };

    return {
      especialidades: (data ?? []).map((fila) => fila.nombre_especialidad),
      error: null,
    };
  } catch (error) {
    return { especialidades: [], error: normalizarError(error) };
  }
}