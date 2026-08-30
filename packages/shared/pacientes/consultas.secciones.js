import { CAMPOS_CONSULTA } from "./campos.js";

export const SECCIONES_CONSULTA = Object.freeze([
  { id: "motivo", titulo: "Motivo y antecedentes", campos: ["motivoConsulta", "antecedentes"] },
  { id: "exploracion", titulo: "Sintomas y exploracion", campos: ["sintomas", "exploracion"] },
  {
    id: "diagnostico",
    titulo: "Diagnostico y tratamiento",
    campos: ["diagnosticos", "tratamiento"],
  },
  {
    id: "seguimiento",
    titulo: "Observaciones y seguimiento",
    campos: ["observaciones", "planSeguimiento"],
  },
]);

export function camposDeSeccion(seccion) {
  return seccion.campos
    .map((id) => CAMPOS_CONSULTA.find((campo) => campo.id === id))
    .filter(Boolean);
}

export function seccionesConCampos() {
  return SECCIONES_CONSULTA.map((seccion) => ({ ...seccion, campos: camposDeSeccion(seccion) }));
}
