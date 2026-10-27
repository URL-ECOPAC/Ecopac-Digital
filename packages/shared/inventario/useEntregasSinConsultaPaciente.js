import { useCallback, useEffect, useState } from "react";

import { puedeVerHistorial } from "../pacientes/permisos.js";
import { listarEntregasSinConsultaDePaciente } from "./movimientos.api.js";

/**
 * Lo que se le entrego o vendio a un paciente sin pasar a consulta (00191, issue #964), para la
 * pestaña de historial de su ficha.
 *
 * Se pide con el mismo permiso que el historial clinico (puedeVerHistorial): que medicamento se le
 * dio a una persona es un dato clinico, aunque viva en movimientos_inventario. Para el resto no se
 * llama a la base y la seccion no se muestra (`visible` en false).
 *
 * @param {string} pacienteId
 * @param {{ rol?: string }} [opciones]
 * @returns {{ entregas: object[], visible: boolean, cargando: boolean, error: object|null,
 *   recargar: () => Promise<void> }}
 */
export function useEntregasSinConsultaPaciente(pacienteId, { rol } = {}) {
  const visible = puedeVerHistorial(rol);
  const [entregas, setEntregas] = useState([]);
  const [cargando, setCargando] = useState(visible);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    if (!pacienteId || !visible) {
      setEntregas([]);
      setCargando(false);
      return;
    }
    setCargando(true);
    setError(null);
    const respuesta = await listarEntregasSinConsultaDePaciente(pacienteId);
    setEntregas(respuesta.entregas);
    setError(respuesta.error);
    setCargando(false);
  }, [pacienteId, visible]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return { entregas, visible, cargando, error, recargar: cargar };
}
