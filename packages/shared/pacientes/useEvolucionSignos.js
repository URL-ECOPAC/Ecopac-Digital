import { useCallback, useEffect, useMemo, useState } from "react";

import { puedeVerHistorial } from "./permisos.js";
import { aSeriesDeSignos, hayAlgunaMedicion } from "./signos.js";
import { obtenerTriajes } from "./triaje.api.js";

export function useEvolucionSignos(pacienteId, { rol } = {}) {
  const [triajes, setTriajes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const permitido = puedeVerHistorial(rol);

  const cargar = useCallback(async () => {
    if (!pacienteId || !permitido) {
      setTriajes([]);
      setCargando(false);
      return;
    }

    setCargando(true);
    setError(null);

    const respuesta = await obtenerTriajes(pacienteId);
    setTriajes(respuesta.triajes ?? []);
    setError(respuesta.error);
    setCargando(false);
  }, [pacienteId, permitido]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const series = useMemo(() => aSeriesDeSignos(triajes), [triajes]);

  return {
    series,
    hayMediciones: hayAlgunaMedicion(series),
    cargando,
    error,
    recargar: cargar,
  };
}
