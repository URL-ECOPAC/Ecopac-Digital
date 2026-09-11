// View model del detalle de un proyecto dentro del panel de ejecucion presupuestal (issue
// #301, criterio 3: "al abrir un proyecto se ve el presupuesto asignado y ejecutado de cada
// una de sus jornadas").
//
// listarJornadasDelProyecto() (proyectos/api.js) no trae presupuesto, asi que se completa con
// obtenerPresupuestosDeJornadas() (presupuestos/api.js), version en lote (issue #759, migracion
// 00123) de la RPC de un solo id: una sola llamada con todos los id de las jornadas del
// proyecto, no una por jornada.

import { useCallback, useEffect, useState } from "react";

import { listarJornadasDelProyecto } from "../proyectos/api.js";
import { obtenerPresupuestosDeJornadas } from "./api.js";
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

    const { presupuestos: presupuestosPorJornada } = await obtenerPresupuestosDeJornadas(
      filas.map((jornada) => jornada.id),
    );

    setJornadas(combinarJornadasConPresupuesto(filas, presupuestosPorJornada));
    setCargando(false);
  }, [proyectoId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return { jornadas, cargando, error, recargar: cargar };
}
