// Filtros de la pantalla de catalogo de diagnosticos (issue #639).
//
// Un solo campo de busqueda: el catalogo es chico (34 filas sembradas por la 00105, crece uno a
// uno desde la aplicacion) y se trae completo una sola vez, asi que filtrar por nombre o codigo
// es trabajo del cliente (useCatalogoDiagnosticos.js), no una consulta nueva por cada tecla.

import { TIPOS_DE_FILTRO } from "../descriptores.js";

export const FILTROS_CATALOGO_DIAGNOSTICOS = [
  {
    id: "busqueda",
    tipo: TIPOS_DE_FILTRO.BUSQUEDA,
    label: "Buscar diagnostico",
    placeholder: "Nombre o codigo CIE-10",
  },
];

export const FILTROS_CATALOGO_DIAGNOSTICOS_VACIOS = {
  busqueda: "",
};
