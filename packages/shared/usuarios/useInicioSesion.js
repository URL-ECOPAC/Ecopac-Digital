// View model de la pantalla de inicio de sesion.
//
// Reescrito porque la version anterior no podia funcionar y ademas rompia la frontera de
// packages/shared (docs/ARQUITECTURA-FRONTEND.md):
//
// 1. Importaba `react-router-dom` y llamaba a useNavigate()/useLocation(). shared no puede
//    depender del router de la web: el mismo hook lo consume la app movil, que usa expo-router.
//    La navegacion vuelve a la pantalla; el hook solo dice A DONDE ir (`destinoPorDefecto`).
// 2. Llamaba `iniciarSesion({ correo, contrasena })` con un objeto, pero la funcion recibe dos
//    argumentos posicionales. El objeto entraba como `correo` y la contrasena llegaba undefined.
// 3. Desestructuraba `{ usuario, perfil }` del resultado, que devuelve `{ sesion, perfil, rol,
//    error, erroresDeCampo }`, y esperaba una excepcion que iniciarSesion nunca lanza: los
//    errores viajan en el campo `error`.
// 4. Comparaba contra `ROLES.VOLUNTARIO_GENERAL`, que no existe en roles.js -la clave es
//    VOLUNTARIO-, asi que esa rama valia undefined y no entraba nunca.
// 5. Devolvia `{ errores, errorGeneral, cargando }`, pero LoginPage.jsx desestructura
//    `{ erroresDeCampo, error, enviando, destinoPorDefecto }`. Ninguno de esos nombres existia.
//
// Usa iniciarSesion de api/sesion.js y no la de usuarios/api.js. Hay dos funciones con ese
// nombre en el paquete; la de api/sesion.js es la que valida credenciales, normaliza el error,
// resuelve el perfil y cierra sesion si la cuenta esta desactivada.

import { useState } from "react";

import { iniciarSesion } from "../api/sesion.js";
import { modulosVisibles } from "../navegacion.js";

/**
 * Primera ruta que el rol puede ver, segun la definicion unica de MODULOS.
 *
 * Sale de navegacion.js y no de una lista de ifs por rol: si un modulo cambia de roles, el
 * destino de entrada cambia solo. La version anterior tenia esa tabla escrita a mano y apuntaba
 * a /dashboard y /jornadas-activas, dos rutas que App.jsx no declara.
 */
function rutaInicialDe(rol) {
  return modulosVisibles(rol)[0]?.ruta ?? "/";
}

/**
 * @param {{ rutaPrevia?: string }} [opciones] Ruta protegida que la persona intentaba abrir antes
 *   de que el guard la mandara al login. Si viene, gana sobre el destino por rol.
 */
export function useInicioSesion({ rutaPrevia } = {}) {
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [erroresDeCampo, setErroresDeCampo] = useState({});
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [destinoPorDefecto, setDestinoPorDefecto] = useState(rutaPrevia ?? null);

  async function handleSubmit(evento) {
    evento?.preventDefault?.();

    setError(null);
    setErroresDeCampo({});
    setEnviando(true);

    try {
      const resultado = await iniciarSesion(correo, contrasena);

      if (Object.keys(resultado.erroresDeCampo ?? {}).length > 0) {
        setErroresDeCampo(resultado.erroresDeCampo);
        return;
      }

      if (resultado.error) {
        setError(resultado.error);
        return;
      }

      setDestinoPorDefecto(rutaPrevia ?? rutaInicialDe(resultado.rol));
    } finally {
      setEnviando(false);
    }
  }

  return {
    correo,
    setCorreo,
    contrasena,
    setContrasena,
    erroresDeCampo,
    error,
    enviando,
    handleSubmit,
    destinoPorDefecto,
  };
}
