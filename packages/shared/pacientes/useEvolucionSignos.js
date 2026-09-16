import { useCallback, useEffect, useMemo, useState } from "react";

import { puedeVerHistorial } from "./permisos.js";
import { agruparSeriesDeSignos, aSeriesDeSignos, hayAlgunaMedicion } from "./signos.js";
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
  // `grupos` separa las ocho series por lo que miden (cardiovascular, metabolico, medidas
  // corporales). La pantalla puede seguir usando `series` si prefiere la lista corrida; las dos
  // salen del mismo calculo.
  const grupos = useMemo(() => agruparSeriesDeSignos(series), [series]);

  return {
    series,
    grupos,
    hayMediciones: hayAlgunaMedicion(series),
    cargando,
    error,
    recargar: cargar,
  };
}
