import { createContext, useContext } from 'react';
import { useSesion } from '@ecopac/shared';

/**
 * Sesion compartida por toda la app movil.
 *
 * POR QUE HACE FALTA. `useSesion()` de shared es un hook con su propio estado: cada componente
 * que lo llama abre SU PROPIA suscripcion a onAuthStateChange y lee el perfil por su cuenta.
 * En esta app lo llamaban dos -App.js y AjustesScreen-, asi que habia dos sesiones
 * independientes.
 *
 * El sintoma concreto: logout() marcaba `cierreIntencional` en la instancia de Ajustes, y la de
 * App.js recibia el SIGNED_OUT sin esa marca, asi que construia un error de "tu sesion expiro"
 * para un cierre que fue deliberado. No se veia porque App.js no renderiza `error`, pero la
 * primera pantalla que lo mostrara diria que la sesion caduco cada vez que alguien cierra
 * sesion a proposito. De paso se leia el perfil dos veces en cada arranque.
 *
 * Con este proveedor el hook se llama UNA vez, en la raiz, y todos leen el mismo estado.
 *
 * Vive en apps/mobile y no en packages/shared porque un proveedor devuelve JSX, y esa es
 * justamente la frontera que shared no puede cruzar (docs/ARQUITECTURA-FRONTEND.md). La app
 * web tiene el suyo propio por la misma razon.
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
