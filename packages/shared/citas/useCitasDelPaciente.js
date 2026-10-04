// Las citas de un paciente en su ficha (issue #927): proximas y pasadas.

import { useCallback, useEffect, useMemo, useState } from "react";

import { listarCitas } from "./api.js";
import { citaPendiente } from "./estados.js";
import { puedeAgendarCitas, puedeVerCitas } from "./permisos.js";

/**
 * Proximas: las que siguen creadas o en atencion, de la mas cercana a la mas lejana. Pasadas: las
 * atendidas y canceladas, de la mas reciente a la mas antigua. Pura.
 *
 * @param {object[]} citas
 * @returns {{ proximas: object[], pasadas: object[] }}
 */
export function separarCitasDelPaciente(citas = []) {
  const porInicio = (una, otra) => String(una.iniciaEn).localeCompare(String(otra.iniciaEn));
  return {
    proximas: citas.filter(citaPendiente).sort(porInicio),
    pasadas: citas.filter((cita) => !citaPendiente(cita)).sort((una, otra) => porInicio(otra, una)),
  };
}

/**
 * @param {string} pacienteId
 * @param {{ rol?: string }} [opciones]
 * @returns {{ proximas: object[], pasadas: object[], cargando: boolean, error: object|null,
 *   recargar: Function, permitido: boolean, puedeAgendar: boolean }}
 */
export function useCitasDelPaciente(pacienteId, { rol } = {}) {
  const [citas, setCitas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const permitido = puedeVerCitas(rol);

  const cargar = useCallback(async () => {
    if (!permitido || !pacienteId) {
      setCitas([]);
      setCargando(false);
      return;
    }
    setCargando(true);
    const respuesta = await listarCitas({ pacienteId });
    setCitas(respuesta.citas);
    setError(respuesta.error);
    setCargando(false);
  }, [permitido, pacienteId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const separadas = useMemo(() => separarCitasDelPaciente(citas), [citas]);

  return {
    ...separadas,
    cargando,
    error,
    recargar: cargar,
    permitido,
    puedeAgendar: puedeAgendarCitas(rol),
  };
}
