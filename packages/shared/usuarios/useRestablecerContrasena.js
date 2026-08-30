// View model de la pantalla "olvide mi contrasena": pide el correo y dispara el envio del enlace.
//
// Reescrito por dos motivos que lo hacian inservible:
//
// 1. Importaba `{ supabase } from '../supabase/client'`. Esa carpeta no existe en el paquete; el
//    cliente se obtiene con obtenerSupabase() de api/cliente.js. El archivo no compilaba, y por
//    eso ademas quedaba fuera del grafo del barril.
// 2. Armaba el enlace de retorno con `window.location.origin`. packages/shared no puede tocar
//    `window` (docs/ARQUITECTURA-FRONTEND.md): en la app movil no existe. La URL de retorno la
//    pasa ahora la pantalla, que si sabe en que plataforma corre.
//
// El flujo importa mas de lo normal en este proyecto: la migracion 00063 crea al primer
// administrador SIN contrasena a proposito, para no versionar una credencial en un repositorio
// publico. Esta pantalla es el camino por el que ese administrador entra por primera vez.

import { useState } from "react";

import { obtenerSupabase } from "../api/cliente.js";
import { validarCorreo } from "./validaciones.js";

/**
 * @param {{ urlDeRetorno?: string }} [opciones] Direccion a la que Supabase manda a la persona
 *   desde el correo. En web se construye con `${window.location.origin}/nueva-contrasena`; la
 *   pantalla la pasa, el hook no la adivina.
 */
export function useRestablecerContrasena({ urlDeRetorno } = {}) {
  const [correo, setCorreo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [mensajeExito, setMensajeExito] = useState(false);
  const [errorCampo, setErrorCampo] = useState("");

  async function solicitarRestablecimiento(evento) {
    evento?.preventDefault?.();

    // Se valida la forma del correo con la misma regla que el resto del modulo, en vez de
    // comprobar solo que no este vacio.
    const { valor, errores } = validarCorreo(correo);
    if (errores.email) {
      setErrorCampo(errores.email);
      return;
    }

    setErrorCampo("");
    setEnviando(true);

    try {
      await obtenerSupabase().auth.resetPasswordForEmail(
        valor,
        urlDeRetorno ? { redirectTo: urlDeRetorno } : undefined,
      );
    } catch {
      // El error del servidor se ignora a proposito: distinguir "correo enviado" de "esa cuenta
      // no existe" permite enumerar usuarios (OWASP A07). Tampoco se registra en consola, que en
      // este proyecto es dato de contacto de personas reales.
    } finally {
      setEnviando(false);
      // Mensaje unico exista o no la cuenta, por la misma razon.
      setMensajeExito(true);
    }
  }

  return {
    correo,
    setCorreo,
    enviando,
    mensajeExito,
    errorCampo,
    solicitarRestablecimiento,
  };
}
