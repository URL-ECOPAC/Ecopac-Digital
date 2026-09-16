import { TIPOS_DE_FILTRO } from "../descriptores.js";

/**
 * Filtros de la pantalla de catalogo de comunidades (issue #756). El filtro de municipio sale
 * de un catalogo cargado en el hook (`opcionesDesde: "municipios"`), igual que "rol" en
 * FILTROS_USUARIO; el de estado es un cerrado de dos valores, como "estado" en el mismo modulo.
 */
export const FILTROS_COMUNIDADES = [
  {
    id: "busqueda",
    tipo: TIPOS_DE_FILTRO.BUSQUEDA,
    label: "Buscar comunidad",
    placeholder: "Nombre de la comunidad",
  },
  {
    id: "municipioId",
    tipo: TIPOS_DE_FILTRO.SELECT,
    label: "Municipio",
    opcionesDesde: "municipios",
  },
  {
    id: "esVigente",
    tipo: TIPOS_DE_FILTRO.SELECT,
    label: "Estado",
    opcionesDesde: "estadosVigencia",
  },
];

export const FILTROS_COMUNIDADES_VACIOS = {
  busqueda: "",
  municipioId: null,
  esVigente: null,
};
