// Cliente de Supabase compartido por la web y la app movil.
//
// Una sola instancia para toda la aplicacion. supabase-js mantiene por cliente la sesion, el
// temporizador de refresco del token y las conexiones de realtime: dos instancias significan
// dos sesiones que se pisan y un token que se refresca dos veces.
//
// La configuracion sale de packages/shared/entorno (issue #44) y el almacenamiento de la
// sesion entra por parametro, porque shared no puede tocar localStorage ni AsyncStorage.

import { createClient } from "@supabase/supabase-js";

import { obtenerEntorno, PLATAFORMAS } from "../entorno/index.js";
import { crearAlmacenamientoEnMemoria, validarAlmacenamiento } from "./almacenamiento.js";
import { CODIGOS_DE_ERROR_DE_CLIENTE, ErrorDeCliente } from "./errores.js";

/** La unica instancia. Se crea en inicializarSupabase() y se lee con obtenerSupabase(). */
let cliente = null;

/** Opciones de autenticacion, calculadas a partir del entorno ya validado. */
function opcionesDeAutenticacion(entorno, almacenamiento) {
  return {
    storage: almacenamiento,

    // La sesion debe sobrevivir a cerrar la app: en campo nadie va a volver a escribir su
    // contrasena entre un paciente y el siguiente.
    persistSession: true,
    autoRefreshToken: true,

    // Solo el navegador tiene un fragmento de URL que leer al volver de un correo de
    // recuperacion. Se decide con la plataforma que ya resolvio el modulo de entorno, sin
    // volver a detectarla por nuestra cuenta.
    detectSessionInUrl: entorno.plataforma === PLATAFORMAS.WEB,

    // PKCE es el flujo que necesitan la recuperacion de contrasena en web (#101) y los deep
    // links del inicio de sesion movil (#109).
    flowType: "pkce",
  };
}

/**
 * Crea la instancia unica del cliente de Supabase.
 *
 * La app la llama una sola vez al arrancar y despues todo el codigo usa obtenerSupabase().
 *
 * @param {object} [opciones]
 * @param {object} [opciones.almacenamiento] Adaptador con getItem, setItem y removeItem. Sin
 *   el, la sesion se guarda solo en memoria y no sobrevive a recargar. Las implementaciones
 *   por plataforma son la issue #46.
 * @param {object} [opciones.entorno] Configuracion ya resuelta. Por defecto la de
 *   obtenerEntorno(); se acepta por parametro para poder ejercitar el modulo fuera de un
 *   bundler.
 * @returns {import("@supabase/supabase-js").SupabaseClient}
 */
export function inicializarSupabase({ almacenamiento, entorno } = {}) {
  // Idempotente a proposito: el Fast Refresh de Vite y el StrictMode de React ejecutan el
  // arranque dos veces. Lanzar aqui romperia el desarrollo sin que nadie hiciera nada mal.
  if (cliente !== null) {
    console.warn(
      "inicializarSupabase() se llamo mas de una vez. Se reutiliza la instancia existente; " +
        "el almacenamiento y el entorno de esta llamada se ignoran.",
    );
    return cliente;
  }

  const configuracion = entorno ?? obtenerEntorno();

  let almacenamientoDeSesion;
  if (almacenamiento) {
    almacenamientoDeSesion = validarAlmacenamiento(almacenamiento);
  } else {
    console.warn(
      "inicializarSupabase() se llamo sin adaptador de almacenamiento: la sesion se guarda " +
        "solo en memoria y se pierde al recargar la pagina o cerrar la app.",
    );
    almacenamientoDeSesion = crearAlmacenamientoEnMemoria();
  }

  cliente = createClient(configuracion.supabaseUrl, configuracion.supabaseAnonKey, {
    auth: opcionesDeAutenticacion(configuracion, almacenamientoDeSesion),
  });

  return cliente;
}

/**
 * La instancia del cliente. Es lo que consume cada api.js de modulo.
 *
 * @returns {import("@supabase/supabase-js").SupabaseClient}
 */
export function obtenerSupabase() {
  if (cliente === null) {
    throw new ErrorDeCliente(
      "El cliente de Supabase todavia no existe. Llama a inicializarSupabase() una vez al " +
        "arrancar la aplicacion, antes de renderizar cualquier pantalla.",
      { codigo: CODIGOS_DE_ERROR_DE_CLIENTE.SIN_INICIALIZAR },
    );
  }

  return cliente;
}

/** Indica si ya hay cliente, para quien necesite preguntarlo sin provocar un error. */
export function haySupabase() {
  return cliente !== null;
}

/**
 * Olvida la instancia.
 *
 * Existe para las pruebas, que necesitan varios clientes en el mismo proceso. En la
 * aplicacion no hay razon para llamarla.
 */
export function reiniciarSupabase() {
  cliente = null;
}
