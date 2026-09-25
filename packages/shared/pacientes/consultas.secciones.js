import { CAMPOS_CONSULTA } from "./campos.js";

export const SECCIONES_CONSULTA = Object.freeze([
  { id: "motivo", titulo: "Motivo y antecedentes", campos: ["motivoConsulta", "antecedentes"] },
  { id: "exploracion", titulo: "Síntomas y exploración", campos: ["sintomas", "exploracion"] },
  {
    id: "diagnostico",
    titulo: "Diagnóstico y tratamiento",
    campos: ["diagnosticos", "tratamiento"],
  },
  {
    id: "seguimiento",
    titulo: "Observaciones y seguimiento",
    campos: ["observaciones", "planSeguimiento"],
  },
]);

/**
 * Los descriptores de campo de una seccion de la consulta, en el orden de la seccion.
 *
 * @param {{ campos: string[] }} seccion Seccion de `SECCIONES_CONSULTA`.
 * @returns {object[]} Descriptores de `CAMPOS_CONSULTA`; los ids que no existen se omiten.
 */
export function camposDeSeccion(seccion) {
  return seccion.campos
    .map((id) => CAMPOS_CONSULTA.find((campo) => campo.id === id))
    .filter(Boolean);
}

/**
 * Las secciones de la consulta con sus descriptores de campo ya resueltos.
 *
 * @returns {object[]} Cada seccion de `SECCIONES_CONSULTA` con `campos` como descriptores.
 */
export function seccionesConCampos() {
  return SECCIONES_CONSULTA.map((seccion) => ({ ...seccion, campos: camposDeSeccion(seccion) }));
}
