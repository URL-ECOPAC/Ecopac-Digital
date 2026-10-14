// View model de la nota de fusiones absorbidas en la ficha de un paciente (issue #637, criterio
// 6: una fusion hecha por error se tiene que poder consultar despues).
//
// No pide listarFusionesRecibidas() si el rol no va a poder verlas: mismo criterio que
// usePaciente.js aplica a la ultima atencion (puedeVerHistorial) -- RLS igual las bloquearia
// (00101: "Solo administrador lee fusiones_pacientes"), pero evita un viaje de red que ya se sabe
// que vuelve vacio.

import { useCallback, useEffect, useState } from "react";

import { listarFusionesRecibidas } from "./duplicados.api.js";
import { puedeFusionarPacientes } from "./permisos.js";

/**
 * @param {string} pacienteId
 * @param {{ rol?: string }} [opciones]
 * @returns {{ fusiones: object[], cargando: boolean, error: object|null, permitido: boolean }}
 */
export function useFusionesDelPaciente(pacienteId, { rol } = {}) {
  const [fusiones, setFusiones] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  const permitido = puedeFusionarPacientes(rol);

  const cargar = useCallback(async () => {
    if (!permitido || !pacienteId) {
      setFusiones([]);
      setCargando(false);
      return;
    }

    setCargando(true);
    const respuesta = await listarFusionesRecibidas(pacienteId);
    setFusiones(respuesta.fusiones ?? []);
    setError(respuesta.error);
    setCargando(false);
  }, [permitido, pacienteId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return { fusiones, cargando, error, permitido };
}
