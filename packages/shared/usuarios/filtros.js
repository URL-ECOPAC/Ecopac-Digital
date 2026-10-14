import { TIPOS_DE_FILTRO } from "../descriptores.js";

export const FILTROS_USUARIO = [
  {
    id: "busqueda",
    tipo: TIPOS_DE_FILTRO.BUSQUEDA,
    label: "Buscar usuario",
    placeholder: "Nombre, apellido o correo",
  },
  {
    id: "rol",
    tipo: TIPOS_DE_FILTRO.SELECT,
    label: "Rol",
    opcionesDesde: "roles",
  },
  {
    id: "estado",
    tipo: TIPOS_DE_FILTRO.SELECT,
    label: "Estado",
    opcionesDesde: "estadoUsuario",
  },
  {
    id: "especialidad",
    tipo: TIPOS_DE_FILTRO.SELECT,
    label: "Especialidad",
    opcionesDesde: "especialidades",
  },
];

export const FILTROS_USUARIO_VACIOS = {
  busqueda: "",
  rol: null,
  estado: null,
  especialidad: null,
};

/**
 * Si hay algun filtro puesto, para habilitar o no el boton "Limpiar filtros" (issue #864).
 *
 * OJO con `estado`: su valor es el booleano de `perfiles.activo` (ESTADOS_USUARIO en campos.js),
 * asi que "Inactivo" es `false`. Un `Boolean(filtros.estado)` -el patron de
 * hayFiltrosDeNotificaciones(), donde todos los valores son cadenas- daria "no hay filtros"
 * justo cuando se esta filtrando por inactivos. Por eso se compara contra null/undefined y no
 * por veracidad.
 *
 * @param {{ busqueda?: string, rol?: string|null, estado?: boolean|null, especialidad?: string|null }} filtros
 * @returns {boolean}
 */
export function hayFiltrosDeUsuario(filtros = {}) {
  return Boolean(
    filtros.busqueda?.trim() ||
    filtros.rol != null ||
    filtros.estado != null ||
    filtros.especialidad != null,
  );
}
