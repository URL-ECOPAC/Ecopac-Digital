// View model de la pestaña "Cierre" de DetalleJornadaPage.jsx (issue #183).
//
// Es la unica pieza que llama a cambiarEstadoJornada(..., FINALIZADA, ...) para la transicion
// en curso -> finalizada: ni useJornadasKanban.js (tablero) ni useDetalleJornada.js (pestaña
// "Resumen") vuelven a aplicar ese cambio directamente -- los dos llevan hasta aca en su lugar (ver
// PLAN.md seccion 3). Antes de finalizar, esta pestaña muestra el resumen (criterio 1) y las
// advertencias (criterio 2); el boton "Confirmar cierre" es la accion explicita del criterio 3.
// Despues de finalizar, la misma pestaña sigue sirviendo para consultar el resumen (criterio 5):
// no hay un componente separado para "antes" y "despues", solo deja de ofrecerse el boton.

import { useCallback, useEffect, useState } from "react";

import { ESTADOS_JORNADA } from "../enums.js";
import { cambiarEstadoJornada } from "./api.js";
import { hayAdvertenciasDeCierre, obtenerResumenCierre } from "./resumenCierre.js";

const RESUMEN_INICIAL = {
  indicadores: { pacientesAtendidos: null, consultasRealizadas: null, tratamientosEntregados: null },
  atencionesIncompletas: null,
  movimientosPendientes: 0,
  error: null,
};

/**
 * @param {object} [opciones]
 * @param {object|null} [opciones.jornada] Jornada ya cargada por useDetalleJornada() (id,
 *   botiquinBodegaId, estado).
 * @param {string} [opciones.rol] Rol de quien mira la pantalla, para los indicadores clinicos.
 * @param {() => Promise<void>} [opciones.onCerrada] Se llama despues de confirmar el cierre con
 *   exito, para que la pantalla vuelva a leer la jornada (recargar() de useDetalleJornada.js) y
 *   este hook refleje el nuevo estado.
 * @returns {{
 *   resumen: object,
 *   cargando: boolean,
 *   error: object|null,
 *   hayAdvertencias: boolean,
 *   recargar: () => Promise<void>,
 *   confirmarCierre: () => Promise<void>,
 *   confirmando: boolean,
 *   errorCierre: string|null,
 * }}
 */
export function useResumenCierreJornada({ jornada, rol, onCerrada } = {}) {
  const jornadaId = jornada?.id;
  const [resumen, setResumen] = useState(RESUMEN_INICIAL);
  const [cargando, setCargando] = useState(true);
  const [confirmando, setConfirmando] = useState(false);
  const [errorCierre, setErrorCierre] = useState(null);

  const cargar = useCallback(async () => {
    if (!jornadaId) {
      setResumen(RESUMEN_INICIAL);
      setCargando(false);
      return;
    }

    setCargando(true);
    const respuesta = await obtenerResumenCierre(jornada, { rol });
    setResumen(respuesta);
    setCargando(false);
  }, [jornada, jornadaId, rol]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  /**
   * Aplica el cierre (criterio 3). Llama a cambiarEstadoJornada() directo, no a
   * useDetalleJornada().cambiarEstado(): esa funcion queda para las demas transiciones
   * (planificada -> en curso, la reapertura), y esta pestaña es la unica dueña de la transicion a
   * finalizada (ver PLAN.md seccion 3).
   */
  const confirmarCierre = useCallback(async () => {
    if (!jornadaId) return;

    setConfirmando(true);
    setErrorCierre(null);

    const { jornada: actualizada, error } = await cambiarEstadoJornada(
      jornadaId,
      ESTADOS_JORNADA.FINALIZADA,
      { rol },
    );

    setConfirmando(false);

    if (error) {
      setErrorCierre(error.mensaje);
      return;
    }

    if (!actualizada) {
      setErrorCierre(
        "No se pudo finalizar esta jornada. Es posible que no tengas permiso, o que otra " +
          "persona ya haya cambiado su estado; actualiza la pagina e intenta de nuevo.",
      );
      return;
    }

    if (onCerrada) await onCerrada();
  }, [jornadaId, rol, onCerrada]);

  return {
    resumen,
    cargando,
    error: resumen.error,
    hayAdvertencias: hayAdvertenciasDeCierre(resumen),
    recargar: cargar,
    confirmarCierre,
    confirmando,
    errorCierre,
  };
}
