// Filtros de la pantalla del catalogo de clinicas (issue #927, 00183). La tabla es chica y se
// filtra en el cliente (useCatalogoClinicas.js).

import { TIPOS_DE_FILTRO } from "../descriptores.js";

export const FILTROS_CATALOGO_CLINICAS = [
  {
    id: "busqueda",
    tipo: TIPOS_DE_FILTRO.BUSQUEDA,
    label: "Buscar clínica",
    placeholder: "Nombre de la clínica",
  },
];

export const FILTROS_CATALOGO_CLINICAS_VACIOS = {
  busqueda: "",
};
