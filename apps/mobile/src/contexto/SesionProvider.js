import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useSesion } from "@ecopac/shared";

import { almacenamientoMovil } from "../almacenamiento";
import AvisoDeInactividad from "../components/AvisoDeInactividad";
import { useInactividadMovil } from "./useInactividadMovil";

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
  const sesion = useSesion({ almacenamiento: almacenamientoMovil });

  // Hasta la issue #840 la app movil no cerraba la sesion nunca: un telefono perdido o prestado
  // quedaba con acceso a las fichas de los pacientes hasta que alguien cerrara sesion a mano. El
  // limite es de una hora y no de los 30 minutos de la web, por la razon que documenta
  // MINUTOS_INACTIVIDAD_MOVIL.
  const [cerradaPorInactividad, setCerradaPorInactividad] = useState(false);

  const cerrarPorInactividad = useCallback(async () => {
    setCerradaPorInactividad(true);
    await sesion.logout();
  }, [sesion]);

  const { registrarActividad, seguirConectado, avisoVisible, venceEn } = useInactividadMovil({
    activo: sesion.haySesion,
    alVencer: cerrarPorInactividad,
  });

  // Al volver a entrar, la explicacion de por que se cerro la sesion ya no viene al caso.
  useEffect(() => {
    if (sesion.haySesion) setCerradaPorInactividad(false);
  }, [sesion.haySesion]);

  const valor = useMemo(
    () => ({ ...sesion, cerradaPorInactividad, registrarActividad }),
    [sesion, cerradaPorInactividad, registrarActividad],
  );

  return (
    <ContextoDeSesion.Provider value={valor}>
      {children}
      <CuentaDeInactividad
        visible={avisoVisible}
        venceEn={venceEn}
        onSeguir={seguirConectado}
        onSalir={sesion.logout}
      />
    </ContextoDeSesion.Provider>
  );
}

/**
 * Lleva la cuenta regresiva del aviso. Esta aparte para que el segundero re-renderice solo este
 * componente y no el proveedor, cuyo valor alcanza a toda la app.
 */
function CuentaDeInactividad({ visible, venceEn, onSeguir, onSalir }) {
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    if (!visible) return undefined;
    setAhora(Date.now());
    const temporizador = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(temporizador);
  }, [visible]);

  const segundosRestantes = venceEn ? Math.max(0, Math.ceil((venceEn - ahora) / 1000)) : 0;

  return (
    <AvisoDeInactividad
      visible={visible}
      segundosRestantes={segundosRestantes}
      onSeguir={onSeguir}
      onSalir={onSalir}
    />
  );
}

/** Misma forma que devuelve useSesion(), pero compartida. */
export function useSesionCompartida() {
  const sesion = useContext(ContextoDeSesion);

  if (sesion === null) {
    // Un error de programacion, no algo que el usuario final pueda provocar: se lanza para que
    // se note al primer render y no se degrade en un "perfil null" dificil de rastrear.
    throw new Error("useSesionCompartida() se llamo fuera de <SesionProvider>.");
  }

  return sesion;
}
