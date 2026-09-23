// Autenticacion: iniciar sesion, cerrarla y consultar la sesion actual.
//
// Une el cliente de Supabase Auth con el perfil de la tabla perfiles: toda la aplicacion
// depende del rol, y el rol vive en perfiles, no en el usuario de auth.users.

import { obtenerSupabase } from "./cliente.js";
import {
  CODIGOS_DE_ERROR_DE_SUPABASE,
  construirError,
  normalizarError,
} from "./errores-de-supabase.js";
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
    return {
      perfil: null,
      rol: null,
      error: construirError(CODIGOS_DE_ERROR_DE_SUPABASE.PERMISO_DENEGADO),
    };
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

// ISSUE #864. Marca de "este cierre lo pidio esta capa", para el unico cierre que ocurre DENTRO
// de packages/shared/api y no lo pide un consumidor: el de iniciarSesion() cuando el perfil no
// sirve (cuenta desactivada o sin permiso).
//
// Sin esto, ese signOut llega a useSesion como un SIGNED_OUT que nadie pidio, es decir como una
// sesion expirada, y quien tiene la cuenta desactivada recibe "Tu sesion expiro. Inicia sesion de
// nuevo" -- un mensaje que le dice que reintente lo unico que no va a funcionar. Comprobado en el
// telefono con una cuenta desactivada a proposito.
//
// Es una variable de modulo y no estado de React porque el hecho que describe es de este archivo:
// useSesion no puede marcar un cierre que no dispara el. Es la contraparte de `cierreIntencional`,
// que sigue cubriendo los cierres que si dispara el hook (ver requiereCerrarSesion).
let cierreDeliberado = null;

/**
 * Lo lee useSesion cuando va a publicar un cierre. Se consume: una marca vale por un solo cierre.
 *
 * Devuelve `{ marcado, error }`. Existe por dos motivos, los dos de la #864:
 *
 * 1. EL MENSAJE TIENE QUE SOBREVIVIR AL DESMONTE DEL LOGIN. En movil, con la contrasena correcta
 *    Supabase emite SIGNED_IN, `haySesion` pasa a true y App.js cambia el AuthNavigator por las
 *    pestanas: eso destruye LoginScreen y se lleva el error que devolvio iniciarSesion(). El
 *    error de la sesion vive por encima del navegador y si llega a la pantalla nueva.
 *
 * 2. Y TIENE QUE SER EL MISMO EN LAS DOS PLATAFORMAS. Un intento de login con cuenta desactivada
 *    dispara DOS lecturas del perfil en paralelo -- la de iniciarSesion() y la de aplicarSesion()
 *    en useSesion, que reacciona al SIGNED_IN --, y cual termina primero no esta determinado. Sin
 *    esta marca, la web mostraba el mensaje generico y el telefono el especifico, para el mismo
 *    hecho y segun quien ganara la carrera.
 *
 *    Gana el generico, que es el criterio 2 ya aceptado (OWASP A07): la cuenta desactivada y la
 *    contrasena incorrecta responden lo mismo. Por eso la marca se pone ANTES de
 *    `signInWithPassword` y la consume el primero de los dos caminos que publique el cierre.
 *
 * Sin marca, useSesion publica lo que ya publicaba. Ese es el caso de a quien desactivan CON la
 * sesion abierta, donde el mensaje especifico si corresponde: no hay ningun intento de login que
 * pueda enumerar nada.
 */
export function consumirCierreDeliberado() {
  if (!cierreDeliberado) return { marcado: false, error: null };
  const { error } = cierreDeliberado;
  cierreDeliberado = null;
  return { marcado: true, error };
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
 * Canjea el codigo de un enlace de recuperacion de contrasena por una sesion real (flujo PKCE).
 *
 * Solo la necesita la app movil (issue #644): en el navegador, Supabase Auth resuelve la sesion
 * de recuperacion solo, leyendo el fragmento de la URL (`detectSessionInUrl`, ver
 * api/cliente.js). Ese mecanismo es exclusivo del navegador, asi que la app movil captura el
 * deep link con `Linking` y le pasa a esta funcion el parametro `code` de esa URL -nunca la URL
 * completa, `exchangeCodeForSession()` de supabase-js recibe solo el codigo-.
 *
 * @param {string} codigo El query param `code` del enlace de recuperacion.
 * @returns {Promise<{ error: object|null }>}
 */
export async function intercambiarSesionDeRecuperacion(codigo) {
  const { error } = await obtenerSupabase().auth.exchangeCodeForSession(codigo);
  return { error: error ? normalizarError(error) : null };
}

/**
 * Toma la sesion que viene DENTRO de un enlace de recuperacion, pisando la que hubiera.
 *
 * ISSUE #864, y es un defecto serio. El comentario de intercambiarSesionDeRecuperacion() dice
 * que "en el navegador, Supabase Auth resuelve la sesion de recuperacion solo, leyendo el
 * fragmento de la URL". Es cierto **solo si no hay ya una sesion abierta**: si la hay,
 * supabase-js conserva la guardada y el fragmento se queda sin procesar.
 *
 * La consecuencia se comprobo de punta a punta en local: la administradora invita a alguien y,
 * sin cerrar su sesion, abre el enlace de la invitacion en el mismo navegador. La pantalla de
 * "elige tu contrasena" se dibuja igual, pero `updateUser({ password })` se aplica **a la sesion
 * abierta**. Resultado: la contrasena que cambio fue la de la administradora, la persona
 * invitada se quedo sin ninguna, y ninguna de las dos pantallas dijo nada raro.
 *
 * Por eso no alcanza con "dejar que Supabase lo resuelva": hay que fijar explicitamente la
 * sesion del enlace antes de tocar nada. Los dos tokens salen del fragmento de la URL, que es un
 * detalle del navegador y por eso los lee la pantalla (apps/web/src/pages/NuevaContrasenaPage),
 * no esta funcion.
 *
 * @param {string} accessToken
 * @param {string} refreshToken
 * @returns {Promise<{ error: object|null }>}
 */
export async function establecerSesionDeRecuperacion(accessToken, refreshToken) {
  if (!accessToken || !refreshToken) {
    return { error: construirError(CODIGOS_DE_ERROR_DE_SUPABASE.SESION_EXPIRADA) };
  }

  const { error } = await obtenerSupabase().auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  return { error: error ? normalizarError(error) : null };
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

  // ANTES del signIn, no despues: el SIGNED_IN que emite arranca aplicarSesion() en useSesion, que
  // lee el perfil en paralelo y puede llegar a publicar el cierre antes que esta funcion.
  cierreDeliberado = { error: ERROR_CREDENCIALES_INVALIDAS };

  const { data, error: errorDeAuth } = await cliente.auth.signInWithPassword({
    email: correoNormalizado,
    password: contrasena,
  });

  if (errorDeAuth) {
    // No hubo sesion, asi que no va a haber ningun cierre que consuma la marca: se retira para no
    // dejarla puesta contaminando el proximo cierre, que podria ser una sesion que si expiro.
    cierreDeliberado = null;
    const normalizado = normalizarError(errorDeAuth);
    const error = esCredencialesInvalidas(normalizado) ? ERROR_CREDENCIALES_INVALIDAS : normalizado;
    return { sesion: null, perfil: null, rol: null, error, erroresDeCampo: SIN_ERRORES };
  }

  const { perfil, rol, error: errorDePerfil } = await evaluarPerfilDeSesion(data.session.user);

  if (errorDePerfil) {
    const esCuentaDesactivada =
      errorDePerfil.codigo === CODIGOS_DE_ERROR_DE_SUPABASE.CUENTA_DESACTIVADA;
    const error = esCuentaDesactivada ? ERROR_CREDENCIALES_INVALIDAS : errorDePerfil;

    if (requiereCerrarSesion(errorDePerfil)) {
      // La marca sigue puesta a proposito: si aplicarSesion() no la consumio ya, la consume el
      // SIGNED_OUT que este signOut dispara.
      await cerrarSesion();
    } else {
      cierreDeliberado = null;
    }

    return { sesion: null, perfil: null, rol: null, error, erroresDeCampo: SIN_ERRORES };
  }

  // El login sirvio: no hay ningun cierre que anunciar.
  cierreDeliberado = null;
  return { sesion: data.session, perfil, rol, error: null, erroresDeCampo: SIN_ERRORES };
}
