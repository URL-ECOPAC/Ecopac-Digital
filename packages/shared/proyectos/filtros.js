// Filtros de las pantallas de listado de proyectos (issue #287).

import { TIPOS_DE_FILTRO } from "../descriptores.js";
import { OPCIONES_ESTADO_PROYECTO } from "./campos.js";

/**
 * `busqueda` se declara para que FilterBar tenga el control, pero listarProyectos()
 * (proyectos/api.js) solo acepta { estado, responsableId } -mismo caso que
 * FILTROS_JORNADA/FILTROS_JORNADA_VACIOS-, asi que se excluye de VACIOS mas abajo.
 */
export const FILTROS_PROYECTO = [
  {
    id: "busqueda",
    tipo: TIPOS_DE_FILTRO.BUSQUEDA,
    label: "Buscar proyecto",
    placeholder: "Nombre del proyecto",
  },
  {
    id: "estado",
    tipo: TIPOS_DE_FILTRO.SELECT,
    label: "Estado",
    opciones: OPCIONES_ESTADO_PROYECTO,
  },
  {
    id: "responsableId",
    tipo: TIPOS_DE_FILTRO.SELECT,
    label: "Responsable",
    opcionesDesde: "perfiles",
  },
];

export const FILTROS_PROYECTO_VACIOS = {
  estado: null,
  responsableId: null,
};
