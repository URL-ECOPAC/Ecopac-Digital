import { useEffect, useState } from "react";

import { obtenerConfiguracionAlertas } from "./configuracionAlertas.api.js";
import { UMBRALES_POR_DEFECTO, ventanaDeAviso } from "./configuracionAlertas.validaciones.js";

// Una sola consulta por sesion de la app, compartida por todas las pantallas que marcan "por
// vencer" (issue #899). En memoria y sin window, para que valga igual en el movil. Se invalida al
// guardar la configuracion.
let consultaEnCurso = null;
const suscriptores = new Set();

function consultarConfiguracion() {
  if (!consultaEnCurso) {
    consultaEnCurso = obtenerConfiguracionAlertas().then((respuesta) => {
      // Un fallo no se queda en cache: la siguiente pantalla que monte vuelve a intentar.
      if (respuesta.error) consultaEnCurso = null;
      return respuesta;
    });
  }
  return consultaEnCurso;
}

/**
 * Olvida la configuracion en cache y avisa a los hooks montados para que la vuelvan a leer. La
 * llama useConfiguracionAlertasVencimiento() despues de guardar.
 *
 * @returns {void}
 */
export function invalidarVentanaDeAviso() {
  consultaEnCurso = null;
  suscriptores.forEach((avisar) => avisar());
}

/**
 * Las antelaciones configuradas y la ventana de aviso (la mas larga), para las pantallas que
 * marcan un lote como "por vencer" con la misma regla que la rutina de alertas.
 *
 * Mientras carga, o si la consulta falla, usa UMBRALES_POR_DEFECTO -lo mismo que trae la base- y
 * expone `error`: la marca de "por vencer" es una ayuda visual, no puede dejar la lista en blanco.
 *
 * @returns {{ umbrales: number[], diasAviso: number, cargando: boolean, error: object|null }}
 */
export function useVentanaDeAvisoVencimiento() {
  const [estado, setEstado] = useState({
    umbrales: [...UMBRALES_POR_DEFECTO],
    cargando: true,
    error: null,
  });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const avisar = () => setVersion((v) => v + 1);
    suscriptores.add(avisar);
    return () => {
      suscriptores.delete(avisar);
    };
  }, []);

  useEffect(() => {
    let vigente = true;
    consultarConfiguracion().then((respuesta) => {
      if (!vigente) return;
      setEstado({
        umbrales: respuesta.configuracion?.umbralesDias ?? [...UMBRALES_POR_DEFECTO],
        cargando: false,
        error: respuesta.error,
      });
    });
    return () => {
      vigente = false;
    };
  }, [version]);

  return { ...estado, diasAviso: ventanaDeAviso(estado.umbrales) };
}
