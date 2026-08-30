// Filtros del listado de pacientes cronicos (issue #122).
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
    label: "Condicion",
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
