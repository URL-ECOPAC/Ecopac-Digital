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
 * usuarios.gestionar_permisos y reportes.exportar (00086). inventario.configurar_alertas gobierna
 * la escritura de configuracion_alertas_caducidad desde su creacion (00162, issue #899), y
 * citas.agendar el alta, el cambio de agenda y la cancelacion de citas (00185, issue #927).
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
  "inventario.configurar_alertas",
  "citas.agendar",
  "donaciones.registrar",
  "proyectos.gestionar",
  "usuarios.gestionar_permisos",
  "reportes.exportar",
]);

/**
 * Si conceder o revocar este permiso cambia de verdad lo que el servidor permite hoy.
 *
 * @param {string} clave
 * @returns {boolean}
 */
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
 * Cuando el origen es INDIVIDUAL, cada permiso trae ademas `motivo` y `otorgadoPorNombre`
 * (issue #756: usuario_permiso ya guardaba ambos desde escribirExcepcion(), pero
 * ModalPermisosUsuario.jsx nunca los pedia ni los mostraba). `otorgadoPorPerfil` se resuelve por
 * la FK usuario_permiso_otorgado_por_fkey -no la de perfil_id, que apunta a QUIEN tiene el
 * permiso, no a quien lo otorgo- mismo patron que anuladaPorPerfil en pacientes/recetas.api.js.
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
      cliente
        .from("usuario_permiso")
        .select(
          "permiso_id, concedido, motivo, otorgadoPor:otorgado_por, " +
            "otorgadoPorPerfil:perfiles!usuario_permiso_otorgado_por_fkey(nombres, apellidos)",
        )
        .eq("perfil_id", idUsuario),
    ]);

    const error = errorDePermisos ?? errorDelRol ?? errorDelUsuario;
    if (error) return { modulos: [], error: normalizarError(error) };

    const idsDelRol = new Set((delRol ?? []).map((fila) => fila.permiso_id));
    const excepciones = new Map((delUsuario ?? []).map((fila) => [fila.permiso_id, fila]));

    const combinados = (permisos ?? []).map((permiso) => {
      const excepcion = excepciones.get(permiso.id);
      const tieneExcepcion = excepcion !== undefined;

      return {
        ...permiso,
        concedido: tieneExcepcion ? excepcion.concedido : idsDelRol.has(permiso.id),
        origen: tieneExcepcion ? ORIGEN_PERMISO.INDIVIDUAL : ORIGEN_PERMISO.ROL,
        motivo: tieneExcepcion ? (excepcion.motivo ?? null) : null,
        otorgadoPorNombre: tieneExcepcion
          ? [excepcion.otorgadoPorPerfil?.nombres, excepcion.otorgadoPorPerfil?.apellidos]
              .filter(Boolean)
              .join(" ") || null
          : null,
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
  if (!data)
    return { id: null, error: construirError(CODIGOS_DE_ERROR_DE_SUPABASE.SIN_RESULTADOS) };
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
          motivo: typeof motivo === "string" && motivo.trim() !== "" ? motivo.trim() : null,
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

/**
 * Lo que la sesion puede ver y hacer ademas de su rol (migracion 00148): los modulos que la
 * matriz le abrio a su rol y sus permisos finos efectivos, los de su rol mas sus excepciones,
 * resueltos por tiene_permiso() -la misma funcion que usan las politicas-.
 *
 * Una sola llamada, al iniciar sesion. Si falla, se devuelve el error y no una lista vacia: una
 * sesion sin accesos se veria igual que una persona sin permisos, y eso es justo lo que no tiene
 * que pasar en silencio (AGENTS.md, "un contrato que cambia tiene que reventar").
 *
 * @returns {Promise<{ accesos: { modulos: string[], permisos: string[] }|null, error: object|null }>}
 */
export async function obtenerMisAccesos() {
  try {
    const { data, error } = await obtenerSupabase().rpc("mis_accesos");
    if (error) return { accesos: null, error: normalizarError(error) };
    return {
      accesos: { modulos: data?.modulos ?? [], permisos: data?.permisos ?? [] },
      error: null,
    };
  } catch (error) {
    return { accesos: null, error: normalizarError(error) };
  }
}

/**
 * Matriz de acceso a modulos (migracion 00148): que modulo abrio la administradora a que rol, ademas
 * de los que cada rol ya tiene por defecto. rol_modulo es chica -ocho modulos por cuatro roles como
 * maximo- asi que se trae completa.
 *
 * Cada acceso trae ademas quien lo abrio y cuando (`otorgado_por`/`otorgado_en`): la matriz lo
 * guardaba y no lo decia.
 *
 * @returns {Promise<{ accesos: Array<{ rol: string, modulo: string, otorgadoEn: string|null,
 *   otorgadoPorNombre: string|null }>, error: object|null }>}
 */
export async function listarAccesosPorRol() {
  try {
    const { data, error } = await obtenerSupabase()
      .from("rol_modulo")
      .select("rol, modulo, otorgadoEn:otorgado_en, otorgadoPor:perfiles(nombres, apellidos)")
      .order("rol", { ascending: true })
      .order("modulo", { ascending: true });

    if (error) return { accesos: [], error: normalizarError(error) };
    return {
      accesos: (data ?? []).map(({ otorgadoPor, ...fila }) => ({
        ...fila,
        otorgadoEn: fila.otorgadoEn ?? null,
        otorgadoPorNombre:
          [otorgadoPor?.nombres, otorgadoPor?.apellidos].filter(Boolean).join(" ") || null,
      })),
      error: null,
    };
  } catch (error) {
    return { accesos: [], error: normalizarError(error) };
  }
}

/**
 * Abre un modulo a un rol, en solo lectura. Abrir uno que ya estaba abierto choca con la
 * restriccion unica (23505): es una carrera entre dos pestanas, no un dato invalido, y se trata
 * como exito.
 *
 * @param {string} rol Enum rol_usuario (usuarios/roles.js).
 * @param {string} modulo `MODULOS[].modulo`.
 * @returns {Promise<{ error: object|null }>}
 */
export async function abrirModuloARol(rol, modulo) {
  if (!rol || !modulo) return { error: null };

  try {
    const { error } = await obtenerSupabase().from("rol_modulo").insert({ rol, modulo });
    if (error && error.code !== "23505") return { error: normalizarError(error) };
    return { error: null };
  } catch (error) {
    return { error: normalizarError(error) };
  }
}

/**
 * Cierra un modulo que la matriz le habia abierto a un rol. Cerrar uno que ya no estaba abierto no
 * es un error, mismo criterio que restablecerPermiso().
 *
 * @param {string} rol
 * @param {string} modulo
 * @returns {Promise<{ error: object|null }>}
 */
export async function cerrarModuloARol(rol, modulo) {
  if (!rol || !modulo) return { error: null };

  try {
    const { error } = await obtenerSupabase()
      .from("rol_modulo")
      .delete()
      .eq("rol", rol)
      .eq("modulo", modulo);

    if (error) return { error: normalizarError(error) };
    return { error: null };
  } catch (error) {
    return { error: normalizarError(error) };
  }
}
