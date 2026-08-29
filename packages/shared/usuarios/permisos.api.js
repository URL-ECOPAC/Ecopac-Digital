// Consultas y escrituras de Supabase para el catalogo de permisos y las excepciones puntuales
// por usuario (permisos, rol_permiso, usuario_permiso de la migracion 00003).
//
// Complementa a usuarios/api.js (que es el unico lugar que lee la tabla perfiles), sin
// duplicarlo: aqui se reutiliza obtenerPerfil() para saber el rol de un usuario y para el
// fallo cerrado descrito abajo.

import { obtenerSupabase } from "../api/cliente.js";
import {
  CODIGOS_DE_ERROR_DE_SUPABASE,
  construirError,
  normalizarError,
} from "../api/errores-de-supabase.js";
import { obtenerPerfil } from "./api.js";

const COLUMNAS_DEL_PERMISO = "id, clave, modulo, descripcion";

/** Origen de un permiso efectivo: heredado del rol, o excepcion individual sobre ese rol. */
export const ORIGEN_PERMISO = Object.freeze({
  ROL: "rol",
  INDIVIDUAL: "individual",
});

/**
 * Claves de permisos finos que hoy gobiernan de verdad alguna politica RLS (docs/PERMISOS.md,
 * seccion "Los permisos finos"). Los nueve del catalogo estan conectados desde la issue #409:
 * jornadas.gestionar (00039), presupuestos.registrar y presupuestos.aprobar (00052), y
 * pacientes.editar, inventario.aprobar, donaciones.registrar, proyectos.gestionar,
 * usuarios.gestionar_permisos y reportes.exportar (00086).
 *
 * Se declara la lista de los que SI funcionan, no la de los inertes: si el catalogo crece con
 * un permiso nuevo que todavia no gobierna ninguna politica, alcanza con no agregarlo aca (un
 * solo lugar), en vez de mantener una lista de excepciones que crece al reves.
 */
const PERMISOS_QUE_GOBIERNAN_UNA_POLITICA = new Set([
  "jornadas.gestionar",
  "presupuestos.registrar",
  "presupuestos.aprobar",
  "pacientes.editar",
  "inventario.aprobar",
  "donaciones.registrar",
  "proyectos.gestionar",
  "usuarios.gestionar_permisos",
  "reportes.exportar",
]);

/** Si conceder o revocar este permiso cambia de verdad lo que el servidor permite hoy. */
export function permisoGobiernaAlgunaPolitica(clave) {
  return PERMISOS_QUE_GOBIERNAN_UNA_POLITICA.has(clave);
}

/**
 * Agrupa una lista plana de permisos por su columna `modulo`, preservando el orden en que
 * llegaron (la consulta ya los trae ordenados por modulo y clave).
 */
function agruparPorModulo(permisos) {
  const porModulo = new Map();

  for (const permiso of permisos) {
    if (!porModulo.has(permiso.modulo)) porModulo.set(permiso.modulo, []);
    porModulo.get(permiso.modulo).push(permiso);
  }

  return Array.from(porModulo, ([modulo, permisos]) => ({ modulo, permisos }));
}

/**
 * Catalogo completo de permisos, agrupado por modulo.
 *
 * Lectura abierta a cualquier autenticado (politica "Autenticados leen permisos" de la
 * migracion 00038): es un catalogo de referencia sin datos personales, igual que
 * departamentos/municipios, asi que esta funcion no comprueba el rol de quien llama. Quien
 * decide eso es el servidor, no shared.
 *
 * @returns {Promise<{ modulos: Array<{ modulo: string, permisos: object[] }>, error: object|null }>}
 */
export async function listarCatalogoPermisos() {
  try {
    const { data, error } = await obtenerSupabase()
      .from("permisos")
      .select(COLUMNAS_DEL_PERMISO)
      .order("modulo", { ascending: true })
      .order("clave", { ascending: true });

    if (error) return { modulos: [], error: normalizarError(error) };
    return { modulos: agruparPorModulo(data ?? []), error: null };
  } catch (error) {
    return { modulos: [], error: normalizarError(error) };
  }
}

/**
 * Permisos efectivos de un usuario, agrupados por modulo, con el origen de cada uno.
 *
 * Combina tres consultas -catalogo, rol_permiso del rol del usuario objetivo y
 * usuario_permiso del usuario objetivo- porque no existe una vista ni un RPC que ya lo haga
 * para un `perfil_id` arbitrario: tiene_permiso() (migracion 00004) solo evalua a auth.uid(),
 * el usuario de la sesion actual.
 *
 * Falla cerrado si no se puede confirmar el perfil objetivo: obtenerPerfil() devuelve `null`
 * tanto si la fila no existe como si RLS la esconde (no distingue los dos casos, ver su propio
 * comentario en usuarios/api.js), y en cualquiera de los dos no hay rol que combinar. Sin este
 * chequeo, un no-administrador pidiendo los permisos de un tercero recibiria un perfil vacio
 * sin error (RLS filtra filas en SELECT, no lanza) y esta funcion calcularia una lista de
 * permisos "por defecto" sobre nadie, que se podria confundir con los permisos reales de esa
 * persona. Mismo criterio que evaluarPerfilDeSesion() en api/sesion.js.
 *
 * @param {string} idUsuario UUID de perfiles.id.
 * @returns {Promise<{ modulos: Array<{ modulo: string, permisos: object[] }>, error: object|null }>}
 */
export async function obtenerPermisosEfectivos(idUsuario) {
  if (!idUsuario) return { modulos: [], error: null };

  const { perfil, error: errorDePerfil } = await obtenerPerfil(idUsuario);
  if (errorDePerfil) return { modulos: [], error: errorDePerfil };

  if (!perfil) {
    return { modulos: [], error: construirError(CODIGOS_DE_ERROR_DE_SUPABASE.PERMISO_DENEGADO) };
  }

  try {
    const cliente = obtenerSupabase();

    const [
      { data: permisos, error: errorDePermisos },
      { data: delRol, error: errorDelRol },
      { data: delUsuario, error: errorDelUsuario },
    ] = await Promise.all([
      cliente
        .from("permisos")
        .select(COLUMNAS_DEL_PERMISO)
        .order("modulo", { ascending: true })
        .order("clave", { ascending: true }),
      cliente.from("rol_permiso").select("permiso_id").eq("rol", perfil.rol),
      cliente.from("usuario_permiso").select("permiso_id, concedido").eq("perfil_id", idUsuario),
    ]);

    const error = errorDePermisos ?? errorDelRol ?? errorDelUsuario;
    if (error) return { modulos: [], error: normalizarError(error) };

    const idsDelRol = new Set((delRol ?? []).map((fila) => fila.permiso_id));
    const excepciones = new Map(
      (delUsuario ?? []).map((fila) => [fila.permiso_id, fila.concedido]),
    );

    const combinados = (permisos ?? []).map((permiso) => {
      const excepcion = excepciones.get(permiso.id);
      const tieneExcepcion = excepcion !== undefined;

      return {
        ...permiso,
        concedido: tieneExcepcion ? excepcion : idsDelRol.has(permiso.id),
        origen: tieneExcepcion ? ORIGEN_PERMISO.INDIVIDUAL : ORIGEN_PERMISO.ROL,
      };
    });

    return { modulos: agruparPorModulo(combinados), error: null };
  } catch (error) {
    return { modulos: [], error: normalizarError(error) };
  }
}

/** Id de la sesion actual, o null si no hay una. Solo para el campo informativo otorgado_por. */
async function idDeSesionActual() {
  const { data } = await obtenerSupabase().auth.getSession();
  return data?.session?.user?.id ?? null;
}

/** Resuelve el id de un permiso a partir de su clave (ej. 'jornadas.gestionar'). */
async function obtenerIdDePermiso(clave) {
  const { data, error } = await obtenerSupabase()
    .from("permisos")
    .select("id")
    .eq("clave", clave)
    .maybeSingle();

  if (error) return { id: null, error: normalizarError(error) };
  if (!data) return { id: null, error: construirError(CODIGOS_DE_ERROR_DE_SUPABASE.SIN_RESULTADOS) };
  return { id: data.id, error: null };
}

/**
 * Concede o revoca un permiso puntual sobre el rol base de un usuario.
 *
 * Es un upsert sobre la llave compuesta (perfil_id, permiso_id) de usuario_permiso: conceder
 * algo que el rol ya da, o revocar algo que el usuario no tenia por ningun lado, son
 * operaciones validas e idempotentes, no casos de error. otorgado_por sale de la sesion actual
 * solo como dato informativo para la auditoria (columna sin DEFAULT en la migracion 00003); la
 * autorizacion real la decide RLS (00038), no esta funcion.
 *
 * @param {string} idUsuario UUID de perfiles.id.
 * @param {string} clave Clave del permiso (permisos.clave).
 * @param {boolean} concedido
 * @param {{ motivo?: string }} [opciones]
 * @returns {Promise<{ error: object|null }>}
 */
async function escribirExcepcion(idUsuario, clave, concedido, { motivo } = {}) {
  if (!idUsuario || !clave) return { error: null };

  const { id: permisoId, error: errorDePermiso } = await obtenerIdDePermiso(clave);
  if (errorDePermiso) return { error: errorDePermiso };

  const otorgadoPor = await idDeSesionActual();

  try {
    const { error } = await obtenerSupabase()
      .from("usuario_permiso")
      .upsert(
        {
          perfil_id: idUsuario,
          permiso_id: permisoId,
          concedido,
          otorgado_por: otorgadoPor,
          motivo: motivo ?? null,
        },
        { onConflict: "perfil_id,permiso_id" },
      );

    if (error) return { error: normalizarError(error) };
    return { error: null };
  } catch (error) {
    return { error: normalizarError(error) };
  }
}

/**
 * Concede un permiso puntual a un usuario, por encima de lo que ya le da su rol.
 *
 * @param {string} idUsuario
 * @param {string} clave
 * @param {{ motivo?: string }} [opciones]
 * @returns {Promise<{ error: object|null }>}
 */
export function concederPermiso(idUsuario, clave, opciones = {}) {
  return escribirExcepcion(idUsuario, clave, true, opciones);
}

/**
 * Revoca un permiso puntual a un usuario, por debajo de lo que le daria su rol.
 *
 * @param {string} idUsuario
 * @param {string} clave
 * @param {{ motivo?: string }} [opciones]
 * @returns {Promise<{ error: object|null }>}
 */
export function revocarPermiso(idUsuario, clave, opciones = {}) {
  return escribirExcepcion(idUsuario, clave, false, opciones);
}

/**
 * Quita la excepcion individual de un usuario sobre un permiso, devolviendolo al valor por
 * defecto de su rol. Borrar una excepcion que no existe no es un error: es el mismo resultado
 * (el usuario ya estaba en el valor de su rol) por un camino distinto.
 *
 * @param {string} idUsuario
 * @param {string} clave
 * @returns {Promise<{ error: object|null }>}
 */
export async function restablecerPermiso(idUsuario, clave) {
  if (!idUsuario || !clave) return { error: null };

  const { id: permisoId, error: errorDePermiso } = await obtenerIdDePermiso(clave);
  if (errorDePermiso) return { error: errorDePermiso };

  try {
    const { error } = await obtenerSupabase()
      .from("usuario_permiso")
      .delete()
      .eq("perfil_id", idUsuario)
      .eq("permiso_id", permisoId);

    if (error) return { error: normalizarError(error) };
    return { error: null };
  } catch (error) {
    return { error: normalizarError(error) };
  }
}
