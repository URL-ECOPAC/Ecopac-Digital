// Autenticacion: iniciar sesion, cerrarla y consultar la sesion actual.
//
// Une el cliente de Supabase Auth con el perfil de la tabla perfiles: toda la aplicacion
// depende del rol, y el rol vive en perfiles, no en el usuario de auth.users.

import { obtenerSupabase } from "./cliente.js";
import { CODIGOS_DE_ERROR_DE_SUPABASE, construirError, normalizarError } from "./errores-de-supabase.js";
import { obtenerPerfil } from "../usuarios/api.js";
import { validarCredenciales } from "../usuarios/validaciones.js";
import { SIN_ERRORES, hayErrores } from "../validations/index.js";

/** Forma de "no hay sesion", para que obtenerSesion() nunca devuelva null a secas. */
const SIN_SESION = Object.freeze({ sesion: null, perfil: null, rol: null, error: null });

/**
 * Error de credenciales invalidas, calculado una sola vez.
 *
 * iniciarSesion() devuelve exactamente ESTA referencia (no una copia con el mismo contenido)
 * tanto para una contrasena incorrecta como para una cuenta desactivada: si trajeran un
 * `detalle` distinto, comparar los dos errores completos revelaria cual de los dos paso,
 * que es la enumeracion de cuentas que el criterio de aceptacion prohibe (OWASP A07). Por
 * eso se descarta a proposito el `detalle` que traeria normalizarError() para una contrasena
 * realmente incorrecta: aqui importa mas que los dos casos sean indistinguibles que conservar
 * ese dato para el log.
 */
const ERROR_CREDENCIALES_INVALIDAS = Object.freeze(
  construirError(CODIGOS_DE_ERROR_DE_SUPABASE.CREDENCIALES_INVALIDAS),
);

function esCredencialesInvalidas(error) {
  return error?.codigo === CODIGOS_DE_ERROR_DE_SUPABASE.CREDENCIALES_INVALIDAS;
}

/**
 * Indica si, ante este error de evaluarPerfilDeSesion(), hay que cerrar la sesion que
 * Supabase ya emitio.
 *
 * Existe como funcion aparte (en vez de que evaluarPerfilDeSesion() cierre la sesion por su
 * cuenta) porque useSesion() necesita marcar su propio aviso de "este cierre lo pedimos
 * nosotros" (cierreIntencional) justo antes de llamar a cerrarSesion(), y esa marca es estado
 * de React que este archivo no puede tocar (packages/shared no puede depender de como cada
 * consumidor organiza su estado). Cada quien decide cuándo y cómo cerrar; esta función solo
 * dice si hace falta.
 */
export function requiereCerrarSesion(error) {
  return (
    error?.codigo === CODIGOS_DE_ERROR_DE_SUPABASE.CUENTA_DESACTIVADA ||
    error?.codigo === CODIGOS_DE_ERROR_DE_SUPABASE.PERMISO_DENEGADO
  );
}

/**
 * Evalua el perfil de un usuario ya autenticado: que exista, que este activo, y arma el rol.
 *
 * No decide si hay que cerrar sesion (ver requiereCerrarSesion): solo evalua y devuelve.
 *
 * @param {{ id: string }} usuario `user` de una sesion de Supabase.
 * @returns {Promise<{ perfil: object|null, rol: string|null, error: object|null }>}
 */
export async function evaluarPerfilDeSesion(usuario) {
  const { perfil, error } = await obtenerPerfil(usuario.id);

  // Fallo transitorio (red, servidor) leyendo el perfil: no es un rechazo de la cuenta, es
  // no poder confirmar nada todavia. No amerita cerrar una sesion que puede ser valida.
  if (error) {
    return { perfil: null, rol: null, error };
  }

  if (!perfil) {
    // Autenticado en auth.users pero sin fila en perfiles. La 00038 concede SELECT sobre la
    // fila propia sin condiciones (id = auth.uid()), asi que para un usuario leyendo su
    // propio id esto solo puede significar que la fila no existe, nunca que RLS la escondio.
    //
    // Se reusa el codigo PERMISO_DENEGADO: es el mismo que ya usaba useSesion() para este
    // caso antes de este cambio. Su mensaje ("no tienes permiso para hacer esto...") describe
    // mal la causa real (falta un dato, no falta un permiso), pero corregir el texto es un
    // cambio de copy en errores-de-supabase.js que queda fuera de este issue a proposito,
    // para no alterar un mensaje que useSesion() ya venia mostrando en produccion.
    return { perfil: null, rol: null, error: construirError(CODIGOS_DE_ERROR_DE_SUPABASE.PERMISO_DENEGADO) };
  }

  if (perfil.activo === false) {
    return {
      perfil: null,
      rol: null,
      error: construirError(CODIGOS_DE_ERROR_DE_SUPABASE.CUENTA_DESACTIVADA),
    };
  }

  return { perfil, rol: perfil.rol, error: null };
}

/**
 * Cierra la sesion local.
 *
 * Nunca lanza: si el servidor no responde el POST de logout, supabase-js igual limpia el
 * almacenamiento inyectado porque el scope es "local" (removeCurrentSession() corre tanto en
 * el camino de exito como en el de error dentro de GoTrueClient#_signOut, siempre que el
 * error llegue como AuthError -que es lo que hace _handleRequest con cualquier fallo de red).
 * El try/catch de aqui es solo para el caso residual de que signOut() llegue a lanzar de
 * verdad (por ejemplo si el adaptador de almacenamiento de la app revienta al borrar la
 * clave), que no es algo que este archivo pueda evitar.
 */
export async function cerrarSesion() {
  const cliente = obtenerSupabase();
  try {
    await cliente.auth.signOut({ scope: "local" });
  } catch {
    // Tragar el error: cerrarSesion() nunca debe dejar a quien llama sin saber que hacer con
    // una excepcion. El objetivo (no dejar sesion activa) ya se persigue del lado de
    // supabase-js como se explica arriba.
  } finally {
    cliente.auth.stopAutoRefresh();
  }
}

/**
 * Sesion actual, si la hay, junto con perfil y rol.
 *
 * Siempre devuelve la misma forma (nunca null a secas), para que quien llama no tenga que
 * distinguir "sin sesion" de "con sesion" antes de desestructurar.
 *
 * @returns {Promise<{ sesion: object|null, perfil: object|null, rol: string|null, error: object|null }>}
 */
export async function obtenerSesion() {
  const cliente = obtenerSupabase();
  const { data, error } = await cliente.auth.getSession();

  if (error) {
    return { ...SIN_SESION, error: normalizarError(error) };
  }

  const sesionDeSupabase = data?.session;
  if (!sesionDeSupabase) {
    return { ...SIN_SESION };
  }

  const { perfil, rol, error: errorDePerfil } = await evaluarPerfilDeSesion(sesionDeSupabase.user);

  if (errorDePerfil) {
    if (requiereCerrarSesion(errorDePerfil)) {
      await cerrarSesion();
    }
    // Aqui SI se muestra el mensaje especifico (cuenta desactivada / perfil ausente): ya
    // habia una sesion valida, asi que no hay nada que enumerar.
    return { sesion: null, perfil: null, rol: null, error: errorDePerfil };
  }

  return { sesion: sesionDeSupabase, perfil, rol, error: null };
}

/**
 * Inicia sesion con correo y contrasena.
 *
 * Ante credenciales invalidas y ante una cuenta desactivada, el error devuelto es LA MISMA
 * referencia de objeto (codigo, mensaje y detalle identicos): distinguirlos revelaria que el
 * correo existe (OWASP A07, criterio de aceptacion). Ese mensaje generico es exclusivo de
 * este punto de entrada -obtenerSesion() y useSesion() si muestran el mensaje especifico de
 * CUENTA_DESACTIVADA, porque ahi ya hay una sesion valida de antes y no hay nada que
 * enumerar-. Si el perfil no existe (autenticacion correcta pero sin fila en perfiles), el
 * mensaje SI es especifico: llegar aqui ya demuestra conocer la contrasena correcta, asi que
 * no hay enumeracion posible, y el mensaje generico llevaria a la persona a resetear una
 * contrasena que esta bien en vez de avisar del problema real.
 *
 * @param {string} correo
 * @param {string} contrasena
 * @returns {Promise<{
 *   sesion: object|null, perfil: object|null, rol: string|null,
 *   error: object|null, erroresDeCampo: Record<string, string>,
 * }>} `erroresDeCampo` solo trae contenido cuando el formulario no paso la validacion local
 *   (mismo formato que el resto de shared: por campo, para pintar bajo cada input) y en ese
 *   caso no se llega a llamar a Supabase. `error` es el error de servidor/negocio, con la
 *   forma de construirError()/normalizarError().
 */
export async function iniciarSesion(correo, contrasena) {
  const { correo: correoNormalizado, errores } = validarCredenciales({ correo, contrasena });

  if (hayErrores(errores)) {
    return { sesion: null, perfil: null, rol: null, error: null, erroresDeCampo: errores };
  }

  const cliente = obtenerSupabase();
  const { data, error: errorDeAuth } = await cliente.auth.signInWithPassword({
    email: correoNormalizado,
    password: contrasena,
  });

  if (errorDeAuth) {
    const normalizado = normalizarError(errorDeAuth);
    const error = esCredencialesInvalidas(normalizado) ? ERROR_CREDENCIALES_INVALIDAS : normalizado;
    return { sesion: null, perfil: null, rol: null, error, erroresDeCampo: SIN_ERRORES };
  }

  const { perfil, rol, error: errorDePerfil } = await evaluarPerfilDeSesion(data.session.user);

  if (errorDePerfil) {
    if (requiereCerrarSesion(errorDePerfil)) {
      await cerrarSesion();
    }

    const esCuentaDesactivada = errorDePerfil.codigo === CODIGOS_DE_ERROR_DE_SUPABASE.CUENTA_DESACTIVADA;
    const error = esCuentaDesactivada ? ERROR_CREDENCIALES_INVALIDAS : errorDePerfil;
    return { sesion: null, perfil: null, rol: null, error, erroresDeCampo: SIN_ERRORES };
  }

  return { sesion: data.session, perfil, rol, error: null, erroresDeCampo: SIN_ERRORES };
}
