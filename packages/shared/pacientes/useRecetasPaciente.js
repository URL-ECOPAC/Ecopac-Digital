import { useCallback, useEffect, useState } from "react";

import { puedeVerHistorial } from "./permisos.js";
import { obtenerRecetas } from "./recetas.api.js";

export function describirMedicamento(renglon) {
  return [renglon?.medicamento, renglon?.concentracion, renglon?.presentacion]
    .filter(Boolean)
    .join(" ")
    .trim();
}

export function describirPosologia(renglon) {
  const partes = [renglon?.dosis, renglon?.frecuencia, renglon?.duracion].filter(Boolean);
  return partes.join(", ");
}

export function contarRecetas(recetas = []) {
  return {
    total: recetas.length,
    emitidas: recetas.filter((receta) => !receta.anulada).length,
    anuladas: recetas.filter((receta) => receta.anulada).length,
  };
}

export function useRecetasPaciente(pacienteId, { rol } = {}) {
  const [recetas, setRecetas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const permitido = puedeVerHistorial(rol);

  const cargar = useCallback(async () => {
    if (!pacienteId || !permitido) {
      setRecetas([]);
      setCargando(false);
      return;
    }

    setCargando(true);
    setError(null);

    const respuesta = await obtenerRecetas(pacienteId);
    setRecetas(respuesta.recetas ?? []);
    setError(respuesta.error);
    setCargando(false);
  }, [pacienteId, permitido]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return {
    recetas,
    conteo: contarRecetas(recetas),
    cargando,
    error,
    recargar: cargar,
  };
}
