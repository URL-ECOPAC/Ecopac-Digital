import { useCallback, useEffect, useState } from "react";
import { puedeVerHistorial } from "./permisos.js";
import { obtenerRecetas } from "./recetas.api.js";

/**
 * @param {{ anulada?: boolean }} receta
 * @returns {"ANULADA"|"EMITIDA"} El estado en mayusculas, para la receta impresa y la lista.
 */
export function estadoRecetaTexto(receta) {
  return receta.anulada ? "ANULADA" : "EMITIDA";
}

/**
 * @param {{ medicamento?: string, concentracion?: string, presentacion?: string }} renglon
 * @returns {string} Medicamento, concentracion y presentacion.
 */
export function describirMedicamento(renglon) {
  return [renglon?.medicamento, renglon?.concentracion, renglon?.presentacion]
    .filter(Boolean)
    .join(" ")
    .trim();
}

/**
 * @param {{ dosis?: string, frecuencia?: string, duracion?: string }} renglon
 * @returns {string} Dosis, frecuencia y duracion separadas por coma.
 */
export function describirPosologia(renglon) {
  const partes = [renglon?.dosis, renglon?.frecuencia, renglon?.duracion].filter(Boolean);
  return partes.join(", ");
}

/**
 * Cantidad entregada de un renglon, teniendo en cuenta una correccion posterior
 * (`fn_ajustar_entrega_receta`).
 *
 * @param {{ cantidadEntregada?: number, cantidadAjustada?: number }} renglon
 * @returns {{ vigente: number|null, original: number|null, corregida: boolean, texto: string }}
 *   `vigente` es la corregida si la hay.
 */
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

/**
 * @param {{ anulada?: boolean }[]} [recetas]
 * @returns {{ total: number, emitidas: number, anuladas: number }}
 */
export function contarRecetas(recetas = []) {
  return {
    total: recetas.length,
    emitidas: recetas.filter((receta) => !receta.anulada).length,
    anuladas: recetas.filter((receta) => receta.anulada).length,
  };
}

/**
 * Recetas de un paciente con su conteo por estado.
 *
 * @param {string} pacienteId
 * @param {object} [opciones]
 * @param {string} [opciones.rol] Rol de la sesion.
 * @returns {{ recetas: object[], conteo: { total: number, emitidas: number, anuladas: number },
 *   cargando: boolean, error: object|null, recargar: () => Promise<void> }}
 */
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
