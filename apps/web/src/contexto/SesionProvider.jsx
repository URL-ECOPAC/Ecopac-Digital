import { createContext, useContext } from 'react';
import { useSesion } from '@ecopac/shared';

/**
 * Sesion compartida por toda la aplicacion web.
 *
 * POR QUE HACE FALTA. `useSesion()` de shared es un hook con su propio estado: cada componente
 * que lo llama abre SU PROPIA suscripcion a onAuthStateChange y lee el perfil por su cuenta.
 * Con dos consumidores -el guard de rutas y el layout- eso da dos sesiones que se resuelven a
 * distinto ritmo: el guard ya sabe quien entro mientras el layout todavia tiene el perfil en
 * null, y el layout revienta al leer el rol.
 *
 * Con este proveedor el hook se llama UNA vez, en la raiz, y todos leen el mismo estado. De
 * paso deja de haber una lectura de perfil por componente.
 *
 * Vive en apps/web y no en packages/shared porque un proveedor devuelve JSX, y esa es
 * justamente la frontera que shared no puede cruzar (ver docs/ARQUITECTURA-FRONTEND.md).
 */
const ContextoDeSesion = createContext(null);

export function SesionProvider({ children }) {
  const sesion = useSesion();
  return <ContextoDeSesion.Provider value={sesion}>{children}</ContextoDeSesion.Provider>;
}

/** Misma forma que devuelve useSesion(), pero compartida. */
export function useSesionCompartida() {
  const sesion = useContext(ContextoDeSesion);

  if (sesion === null) {
    // Un error de programacion, no algo que el usuario final pueda provocar: se lanza para que
    // se note al primer render y no se degrade en un "perfil null" dificil de rastrear.
    throw new Error('useSesionCompartida() se llamo fuera de <SesionProvider>.');
  }

  return sesion;
}
