// Filtros de la pantalla del catalogo de areas de atencion (issue #927, 00182).
//
// Un solo campo de busqueda, como el catalogo de condiciones: la tabla es chica y se filtra en el
// cliente (useCatalogoAreas.js).

import { TIPOS_DE_FILTRO } from "../descriptores.js";

export const FILTROS_CATALOGO_AREAS = [
  {
    id: "busqueda",
    tipo: TIPOS_DE_FILTRO.BUSQUEDA,
    label: "Buscar área",
    placeholder: "Nombre o descripción del área",
  },
];

/** Valor inicial de los filtros del catalogo, para que ambas apps arranquen igual. */
export const FILTROS_CATALOGO_AREAS_VACIOS = {
  busqueda: "",
};
