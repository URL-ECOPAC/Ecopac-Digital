// View model del detalle de un proyecto dentro del panel de ejecucion presupuestal (issue
// #301, criterio 3: "al abrir un proyecto se ve el presupuesto asignado y ejecutado de cada
// una de sus jornadas").
//
// Mismo patron N+1 que useEjecucionPresupuestal.js documenta para la lista de proyectos:
// listarJornadasDelProyecto() (proyectos/api.js) no trae presupuesto, asi que se completa con
// obtenerPresupuestoJornada() (presupuestos/api.js) por cada jornada. A la escala de jornadas
// por proyecto de esta ONG el costo es aceptable; no se agrega una RPC nueva.

import { useCallback, useEffect, useState } from "react";

import { listarJornadasDelProyecto } from "../proyectos/api.js";
import { obtenerPresupuestoJornada } from "./api.js";
import { combinarJornadasConPresupuesto } from "./useEjecucionPresupuestal.js";

/**
 * @param {string|null} proyectoId Proyecto cuyo detalle se quiere ver. `null`/`undefined` deja
 *   el hook inactivo (sin consultar, sin jornadas), para poder llamarlo siempre y activarlo solo
 *   cuando la pantalla abre un proyecto.
 */
export function useDetalleProyectoPresupuesto(proyectoId) {
  const [jornadas, setJornadas] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    if (!proyectoId) {
      setJornadas([]);
      setError(null);
      return;
    }

    setCargando(true);
    setError(null);

    const { jornadas: filas, error: errorDeLista } = await listarJornadasDelProyecto(proyectoId);

    if (errorDeLista) {
      setJornadas([]);
      setError(errorDeLista);
      setCargando(false);
      return;
    }

    const presupuestosPorJornada = {};
    await Promise.all(
      filas.map(async (jornada) => {
        const { presupuesto } = await obtenerPresupuestoJornada(jornada.id);
        if (presupuesto) presupuestosPorJornada[jornada.id] = presupuesto;
      }),
    );

    setJornadas(combinarJornadasConPresupuesto(filas, presupuestosPorJornada));
    setCargando(false);
  }, [proyectoId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return { jornadas, cargando, error, recargar: cargar };
}
