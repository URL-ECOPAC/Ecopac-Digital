// El historial clinico de un paciente como lista de visitas (issue #840, bloque F).
//
// Reemplaza en las pantallas a useHistorialPaciente(), que lo entregaba como eventos sueltos
// -triaje, consulta, receta- agrupados por jornada. Aqui cada elemento es una visita, y trae
// dentro sus signos, su consulta y su receta: es la unidad con la que el personal piensa ("la
// consulta del martes en El Rosario"), no tres filas hermanas.

import { useCallback, useEffect, useState } from "react";

import { obtenerVisitasDePaciente } from "./historial.api.js";
import { puedeVerHistorial } from "./permisos.js";

const FILTROS_VACIOS = Object.freeze({ desde: "", hasta: "" });

/**
 * Que partes tiene una visita, para el resumen de su cabecera. Pura para probarla sin montar.
 *
 * @param {object} visita Lo que devuelve aVisita().
 * @returns {{ signos: boolean, consulta: boolean, receta: boolean }}
 */
export function partesDeVisita(visita) {
  return {
    signos: Boolean(visita?.signos),
    consulta: Boolean(visita?.consulta),
    receta: (visita?.recetas ?? []).length > 0,
  };
}

/**
 * @param {string} pacienteId
 * @param {{ rol: string }} opciones
 */
export function useVisitasPaciente(pacienteId, { rol } = {}) {
  const [visitas, setVisitas] = useState([]);
  const [filtros, setFiltros] = useState(FILTROS_VACIOS);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const permitido = puedeVerHistorial(rol);
  const { desde, hasta } = filtros;

  const cargar = useCallback(async () => {
    if (!pacienteId || !permitido) {
      setVisitas([]);
      setCargando(false);
      return;
    }
    setCargando(true);
    const respuesta = await obtenerVisitasDePaciente(pacienteId, {
      rol,
      desde: desde || undefined,
      hasta: hasta || undefined,
    });
    setVisitas(respuesta.visitas);
    setError(respuesta.error);
    setCargando(false);
  }, [pacienteId, rol, permitido, desde, hasta]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const setFiltro = useCallback((id, valor) => {
    setFiltros((anteriores) => ({ ...anteriores, [id]: valor ?? "" }));
  }, []);

  const limpiarFiltros = useCallback(() => setFiltros(FILTROS_VACIOS), []);

  return {
    permitido,
    visitas,
    filtros,
    setFiltro,
    limpiarFiltros,
    hayFiltros: Boolean(desde || hasta),
    cargando,
    error,
    recargar: cargar,
  };
}
