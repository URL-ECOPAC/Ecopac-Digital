// Filtros del listado de pacientes cronicos (issue #122) y del catalogo de condiciones (#850).
//
// Los declara shared una sola vez; la web los dibuja con <Form.Select> y la app movil con
// <Selector>, sin que ninguna redefina la lista. Mismo patron que filtros.js.
//
// Son los tres que acepta obtenerPacientesConCondicion() en condiciones.api.js, para que la
// pantalla no pueda ofrecer un filtro que la consulta no sabe aplicar.

import { TIPOS_DE_FILTRO } from "../descriptores.js";

export const FILTROS_PACIENTE_CRONICO = [
  {
    id: "comunidad",
    tipo: TIPOS_DE_FILTRO.SELECT,
    label: "Comunidad",
    opcionesDesde: "comunidades",
  },
  {
    id: "condicion",
    tipo: TIPOS_DE_FILTRO.SELECT,
    label: "Condición",
    opcionesDesde: "condicionesCronicas",
  },
  {
    id: "estado",
    tipo: TIPOS_DE_FILTRO.SELECT,
    label: "Estado",
    opcionesDesde: "estadosCondicionCronica",
  },
];

/** Valor inicial de los filtros, para que ambas apps arranquen en el mismo estado. */
export const FILTROS_PACIENTE_CRONICO_VACIOS = {
  comunidad: null,
  condicion: null,
  estado: null,
};

/**
 * Filtros de la pantalla de mantenimiento del catalogo (issue #850).
 *
 * Un solo campo de busqueda, igual que el catalogo de diagnosticos: la tabla es chica -cinco
 * filas sembradas por la 00010, crece de una en una desde la aplicacion- asi que se trae completa
 * y filtrar por nombre es trabajo del cliente (useCatalogoCondiciones.js), no una consulta nueva
 * por cada tecla.
 */
export const FILTROS_CATALOGO_CONDICIONES = [
  {
    id: "busqueda",
    tipo: TIPOS_DE_FILTRO.BUSQUEDA,
    label: "Buscar condición",
    placeholder: "Nombre de la condición",
  },
];

/** Valor inicial de los filtros del catalogo, para que ambas apps arranquen igual. */
export const FILTROS_CATALOGO_CONDICIONES_VACIOS = {
  busqueda: "",
};
