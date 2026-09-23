import { useCallback, useEffect, useState } from "react";
import { puedeVerHistorial } from "./permisos.js";
import { obtenerRecetas } from "./recetas.api.js";

//  NUEVA: Devuelve el estado en mayúsculas
export function estadoRecetaTexto(receta) {
  return receta.anulada ? "ANULADA" : "EMITIDA";
}

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

export function describirEntrega(renglon) {
  const original = renglon?.cantidadEntregada ?? null;
  const ajustada = renglon?.cantidadAjustada ?? null;
  const corregida = ajustada !== null && ajustada !== original;
  const vigente = corregida ? ajustada : original;
  if (vigente === null || vigente === "") {
    return { vigente: null, original, corregida: false, texto: "" };
  }
  if (!corregida) {
    return { vigente, original, corregida, texto: `entregadas: ${vigente}` };
  }
  const detalle = [`corregido de ${original}`];
  if (renglon.ajustadaPorNombre) detalle.push(`por ${renglon.ajustadaPorNombre}`);
  return { vigente, original, corregida, texto: `entregadas: ${vigente} (${detalle.join(" ")})` };
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
