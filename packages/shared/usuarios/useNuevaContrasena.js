// View model de la pantalla que fija la contrasena nueva tras seguir el enlace del correo.
//
// Reescrito por tres motivos:
//
// 1. Importaba `{ supabase } from '../supabase/client'`, una ruta que no existe en el paquete.
// 2. Importaba `react-router-dom` para navegar a /login. shared no puede depender del router de
//    la web; la navegacion vuelve a la pantalla, que aqui la decide mirando `exito`.
// 3. Reimplementaba la politica de contrasenas a mano ("al menos 8 caracteres"), en paralelo a
//    validarContrasena() de usuarios/validaciones.js, que ya la define: longitud minima, al menos
//    una letra y al menos un numero. Dos definiciones de la misma regla acaban divergiendo, y la
//    de aqui ya era mas laxa que la del registro.

import { useState } from "react";

import { obtenerSupabase } from "../api/cliente.js";
import { cerrarSesion } from "../api/sesion.js";
import { validarContrasena } from "./validaciones.js";

export function useNuevaContrasena() {
  const [contrasena, setContrasena] = useState("");
  const [confirmarContrasena, setConfirmarContrasena] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [errorGlobal, setErrorGlobal] = useState("");
  const [erroresDeCampo, setErroresDeCampo] = useState({});
  const [exito, setExito] = useState(false);

  function validar() {
    const { errores } = validarContrasena(contrasena);
    const todos = { ...errores };

    if (contrasena !== confirmarContrasena) {
      todos.confirmarContrasena = "Las contrasenas no coinciden.";
    }

    setErroresDeCampo(todos);
    return Object.keys(todos).length === 0;
  }

  async function actualizarContrasena(evento) {
    evento?.preventDefault?.();

    setErrorGlobal("");
    if (!validar()) return;

    setEnviando(true);

    try {
      const { error } = await obtenerSupabase().auth.updateUser({ password: contrasena });

      if (error) {
        setErrorGlobal(error.message || "El enlace ha caducado o no es valido.");
        return;
      }

      // Se cierra la sesion de recuperacion a proposito: obliga a entrar de nuevo con la
      // contrasena recien fijada, y de paso invalida el enlace del correo.
      await cerrarSesion();
      setExito(true);
    } catch (error) {
      setErrorGlobal(error?.message || "El enlace ha caducado o no es valido.");
    } finally {
      setEnviando(false);
    }
  }

  return {
    contrasena,
    setContrasena,
    confirmarContrasena,
    setConfirmarContrasena,
    enviando,
    errorGlobal,
    erroresDeCampo,
    exito,
    actualizarContrasena,
  };
}
