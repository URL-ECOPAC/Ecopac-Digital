import { TIPOS_DE_FILTRO } from "../descriptores.js";
import { TIPOS_DE_EVENTO } from "./historial.api.js";

export const OPCIONES_TIPO_DE_EVENTO = [
  { valor: TIPOS_DE_EVENTO.TRIAJE, etiqueta: "Signos vitales" },
  { valor: TIPOS_DE_EVENTO.CONSULTA, etiqueta: "Consulta" },
  { valor: TIPOS_DE_EVENTO.RECETA, etiqueta: "Receta" },
];

export const ETIQUETAS_TIPO_DE_EVENTO = Object.fromEntries(
  OPCIONES_TIPO_DE_EVENTO.map((opcion) => [opcion.valor, opcion.etiqueta]),
);

export const FILTROS_HISTORIAL = [
  { id: "desde", label: "Desde", tipo: TIPOS_DE_FILTRO.RANGO, subtipo: "fecha" },
  { id: "hasta", label: "Hasta", tipo: TIPOS_DE_FILTRO.RANGO, subtipo: "fecha" },
  {
    id: "tipo",
    label: "Tipo de evento",
    tipo: TIPOS_DE_FILTRO.SELECT,
    opciones: OPCIONES_TIPO_DE_EVENTO,
  },
];

export const FILTROS_HISTORIAL_VACIOS = Object.freeze({ desde: "", hasta: "", tipo: "" });
