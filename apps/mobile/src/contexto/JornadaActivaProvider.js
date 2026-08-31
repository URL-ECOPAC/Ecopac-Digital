import { createContext, useContext } from "react";
import { useJornadaActiva } from "@ecopac/shared";

import { almacenamientoMovil } from "../almacenamiento";
import { useSesionCompartida } from "./SesionProvider";

/**
 * Jornada activa compartida por toda la app movil (issue #186).
 *
 * Mismo motivo que SesionProvider.js: useJornadaActiva() de shared es un hook con su propio
 * estado, y varias pantallas ya lo llaman cada una por su cuenta (RegistroPacienteScreen,
 * TriajeScreen, ConsultaScreen). Eso les alcanza porque React Navigation las monta de nuevo en
 * cada navegacion y releen la seleccion persistida. Pero el badge de jornada activa (criterio 4,
 * visible desde cualquier pantalla) vive en el header de AppNavigator, que NO se remonta al
 * navegar, y la pantalla de seleccion (criterio 5, cambiar de jornada) necesita que ese cambio
 * se vea reflejado ahi mismo sin esperar un remontaje. Por eso este es un contexto aparte, con
 * una unica instancia, y no una cuarta llamada suelta a useJornadaActiva().
 *
 * No se tocan las tres pantallas que ya llaman useJornadaActiva() por su cuenta: no son parte de
 * esta issue y seguir funcionando como estan no rompe nada.
 */
const ContextoDeJornadaActiva = createContext(null);

export function JornadaActivaProvider({ children }) {
  const { perfil } = useSesionCompartida();
  const jornadaActiva = useJornadaActiva({
    perfilId: perfil?.id,
    almacenamiento: almacenamientoMovil,
  });

  return (
    <ContextoDeJornadaActiva.Provider value={jornadaActiva}>
      {children}
    </ContextoDeJornadaActiva.Provider>
  );
}

/** Misma forma que devuelve useJornadaActiva(), pero compartida. */
export function useJornadaActivaCompartida() {
  const jornadaActiva = useContext(ContextoDeJornadaActiva);

  if (jornadaActiva === null) {
    throw new Error("useJornadaActivaCompartida() se llamo fuera de <JornadaActivaProvider>.");
  }

  return jornadaActiva;
}
