// View model de la pantalla "Posibles duplicados" (issue #637).
//
// Mismo patron que useCatalogoDiagnosticos.js: `permitido` decide si la pantalla tiene algo que
// mostrar, `filas` ya viene lista para DataList. Se muestra solo a quien puede fusionar
// (puedeFusionarPacientes, solo administrador) y no en solo-lectura a medico/voluntario: una cola
// de candidatos sobre la que nadie mas que administrador puede actuar no tiene destino en esta
// pantalla (decision del PLAN.md de #637, pregunta 4).
//
// DataList espera `fila.id` para la key de cada renglon (DataList.jsx); un par de posibles
// duplicados no trae un id propio, asi que se sintetiza aqui uniendo los dos ids del par.

import { useCallback, useEffect, useState } from "react";

import { listarPosiblesDuplicados } from "./duplicados.api.js";
import { nombreCompletoDePaciente } from "./ficha.js";
import { puedeFusionarPacientes } from "./permisos.js";

function aFila(duplicado) {
  return {
    id: `${duplicado.pacienteAId}:${duplicado.pacienteBId}`,
    pacienteAId: duplicado.pacienteAId,
    pacienteBId: duplicado.pacienteBId,
    nombreCompletoA: nombreCompletoDePaciente({
      nombres: duplicado.nombresA,
      apellidos: duplicado.apellidosA,
    }),
    numeroFichaA: duplicado.numeroFichaA,
    nombreCompletoB: nombreCompletoDePaciente({
      nombres: duplicado.nombresB,
      apellidos: duplicado.apellidosB,
    }),
    numeroFichaB: duplicado.numeroFichaB,
    fechaNacimiento: duplicado.fechaNacimiento,
    similitudPorcentaje: Math.round((duplicado.similitud ?? 0) * 100),
  };
}

/**
 * @param {{ rol?: string }} [opciones]
 * @returns {{
 *   filas: object[],
 *   total: number,
 *   cargando: boolean,
 *   error: object|null,
 *   recargar: () => Promise<void>,
 *   permitido: boolean,
 * }}
 */
export function useDuplicadosPacientes({ rol } = {}) {
  const [filas, setFilas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const permitido = puedeFusionarPacientes(rol);

  const cargar = useCallback(async () => {
    if (!permitido) {
      setFilas([]);
      setCargando(false);
      return;
    }

    setCargando(true);
    setError(null);

    const respuesta = await listarPosiblesDuplicados({ rolUsuario: rol });

    setFilas((respuesta.duplicados ?? []).map(aFila));
    setError(respuesta.error);
    setCargando(false);
  }, [permitido, rol]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return { filas, total: filas.length, cargando, error, recargar: cargar, permitido };
}
