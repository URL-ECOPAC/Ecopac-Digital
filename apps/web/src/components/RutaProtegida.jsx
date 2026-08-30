import { Navigate, Outlet, useLocation } from "react-router-dom";
import { ESTADOS_DE_RESTAURACION } from "@ecopac/shared";
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
 * `roles` es la lista de roles permitidos en esa ruta. Sale de MODULOS en
 * packages/shared/navegacion.js, para que quien puede ver que se siga declarando en un solo
 * archivo y el sidebar y el guard no puedan discrepar.
 *
 * Sin `roles` solo comprueba que haya sesion. Se usa asi por encima de MainLayout: el layout
 * dibuja el nombre y el rol de quien entro, asi que no puede montarse antes de saber si hay
 * alguien. Los roles se comprueban despues, ruta por ruta, ya dentro del layout.
 *
 * El orden de las comprobaciones importa y es el que sigue.
 */
export default function RutaProtegida({ roles = null }) {
  const { estadoRestauracion, haySesion, perfil, rol } = useSesionCompartida();
  const location = useLocation();

  // 1. Todavia no se sabe si hay sesion. Va primero: pintar el login antes de saberlo es el
  //    parpadeo que hay que evitar. useSesion no pasa a LISTO hasta que el perfil esta leido,
  //    justamente para que aqui no se decida con informacion a medias.
  if (estadoRestauracion === ESTADOS_DE_RESTAURACION.CARGANDO) {
    return <LoadingState message="Comprobando tu sesion..." />;
  }

  // 2. No hay sesion: al login, conservando a donde queria ir. `replace` evita que el boton
  //    atras devuelva a una ruta que no se puede ver.
  if (!haySesion) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 3. Hay token pero no se pudo leer el perfil. useSesion conserva la sesion a proposito para
  //    poder reintentar, asi que NO se manda al login a alguien que si esta autenticado: sin
  //    perfil no hay rol, y sin rol no se autoriza nada.
  if (!perfil) {
    return <AccesoDenegadoPage rol={null} />;
  }

  // 4. El rol no alcanza este modulo. Se dibuja en el sitio, sin cambiar la URL.
  if (roles !== null && !roles.includes(rol)) {
    return <AccesoDenegadoPage rol={rol} />;
  }

  return <Outlet />;
}
