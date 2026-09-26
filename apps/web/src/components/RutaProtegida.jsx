import { Navigate, Outlet, useLocation } from "react-router-dom";
import { ESTADOS_DE_RESTAURACION, puedeVerModulo } from "@ecopac/shared";
import { useSesionCompartida } from "../contexto/SesionProvider";
import AccesoDenegadoPage from "../pages/AccesoDenegadoPage";
import LoadingState from "./LoadingState";

/**
 * Guard de rutas: bloquea una ruta cuando no hay sesion o cuando el rol no alcanza el modulo.
 *
 * ESTO MEJORA LA EXPERIENCIA, NO ES LA GARANTIA DE SEGURIDAD. Cualquiera puede saltarse un
 * guard de cliente; lo que de verdad protege los datos son las politicas RLS de la base. Aqui
 * se evita que alguien llegue a una pantalla que no va a poder usar y se le explica por que.
 *
 * `modulo` es el id del modulo de MODULOS (packages/shared/navegacion.js) al que pertenece la
 * ruta, y lo decide puedeVerModulo(): el mismo que arma el menu, asi que el sidebar y el guard no
 * pueden discrepar. Cuenta lo que el rol tiene por defecto, lo que la matriz de acceso le abrio y
 * las funciones delegadas a la persona (00148); con una lista de roles fija, un modulo abierto por
 * la matriz aparecia en el menu y la ruta lo negaba.
 *
 * Sin `modulo` solo comprueba que haya sesion. Se usa asi por encima de MainLayout: el layout
 * dibuja el nombre y el rol de quien entro, asi que no puede montarse antes de saber si hay
 * alguien. El modulo se comprueba despues, ruta por ruta, ya dentro del layout.
 *
 * El orden de las comprobaciones importa y es el que sigue.
 */
export default function RutaProtegida({ modulo = null }) {
  const { estadoRestauracion, haySesion, perfil, rol, cargando } = useSesionCompartida();
  const location = useLocation();

  // 1. Todavia no se sabe si hay sesion. Va primero: pintar el login antes de saberlo es el
  //    parpadeo que hay que evitar. useSesion no pasa a LISTO hasta que el perfil esta leido,
  //    justamente para que aqui no se decida con informacion a medias.
  if (estadoRestauracion === ESTADOS_DE_RESTAURACION.CARGANDO) {
    return <LoadingState message="Comprobando tu sesión..." />;
  }

  // 2. No hay sesion: al login, conservando a donde queria ir. `replace` evita que el boton
  //    atras devuelva a una ruta que no se puede ver.
  if (!haySesion) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 3. Hay token y el perfil se esta leyendo todavia. Pasa en CADA inicio de sesion: SIGNED_IN
  //    fija el usuario -y con el, haySesion- antes de que llegue el perfil, y la restauracion ya
  //    estaba en LISTO desde que se abrio la pagina sin sesion. Sin esta comprobacion, la regla
  //    de abajo pintaba "no se pudo confirmar tu rol" un instante y despues la sesion entraba
  //    igual: el error que se veia en cada login (issue #840).
  if (!perfil && cargando) {
    return <LoadingState message="Comprobando tu sesión..." />;
  }

  // 4. Hay token pero no se pudo leer el perfil. useSesion conserva la sesion a proposito para
  //    poder reintentar, asi que NO se manda al login a alguien que si esta autenticado: sin
  //    perfil no hay rol, y sin rol no se autoriza nada.
  if (!perfil) {
    return <AccesoDenegadoPage rol={null} />;
  }

  // 5. El rol no alcanza este modulo. Se dibuja en el sitio, sin cambiar la URL.
  if (modulo !== null && !puedeVerModulo(rol, modulo)) {
    return <AccesoDenegadoPage rol={rol} />;
  }

  return <Outlet />;
}
