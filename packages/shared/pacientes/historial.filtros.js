import { SUBTIPOS_DE_RANGO, TIPOS_DE_FILTRO } from "../descriptores.js";
import { TIPOS_DE_EVENTO } from "./historial.api.js";

export const OPCIONES_TIPO_DE_EVENTO = [
  { value: TIPOS_DE_EVENTO.TRIAJE, label: "Signos vitales" },
  { value: TIPOS_DE_EVENTO.CONSULTA, label: "Consulta" },
  { value: TIPOS_DE_EVENTO.RECETA, label: "Receta" },
];

export const ETIQUETAS_TIPO_DE_EVENTO = Object.fromEntries(
  OPCIONES_TIPO_DE_EVENTO.map((opcion) => [opcion.value, opcion.label]),
);

export const FILTROS_HISTORIAL = [
  { id: "desde", label: "Desde", tipo: TIPOS_DE_FILTRO.RANGO, subtipo: SUBTIPOS_DE_RANGO.FECHA },
  { id: "hasta", label: "Hasta", tipo: TIPOS_DE_FILTRO.RANGO, subtipo: SUBTIPOS_DE_RANGO.FECHA },
  {
    id: "tipo",
    label: "Tipo de evento",
    tipo: TIPOS_DE_FILTRO.SELECT,
    opciones: OPCIONES_TIPO_DE_EVENTO,
  },
];

export const FILTROS_HISTORIAL_VACIOS = Object.freeze({ desde: "", hasta: "", tipo: "" });
