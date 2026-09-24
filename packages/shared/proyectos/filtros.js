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

/**
 * Estado inicial de los filtros de la pantalla de proyectos (useProyectosSociales).
 *
 * Distinto de FILTROS_PROYECTO_VACIOS a proposito: la pantalla filtra el responsable por texto
 * libre en el cliente (`responsable`) y usa "" como "sin filtro", no los `null` del descriptor.
 */
export const FILTROS_PROYECTO_PANTALLA_VACIOS = {
  estado: "",
  responsable: "",
};

/**
 * De una lista de jornadas, las que todavia no pertenecen a ningun proyecto: las candidatas a
 * "Asociar jornada". listarJornadas() no sabe pedir "sin proyecto" (un `proyecto` vacio se ignora),
 * asi que se recorta aqui, sobre `proyectoId` que esa consulta ya trae.
 *
 * @param {Array<{ proyectoId?: string|null }>} [jornadas]
 * @returns {object[]}
 */
export function soloJornadasSinProyecto(jornadas = []) {
  return jornadas.filter((jornada) => !jornada.proyectoId);
}

/**
 * Indica si hay algun filtro puesto, para habilitar "Limpiar filtros".
 *
 * Mismo patron que hayFiltrosDeUsuario(): lo decide una funcion compartida y no cada pantalla.
 * El texto de responsable cuenta solo si tiene algo mas que espacios, igual que al filtrar.
 *
 * @param {{ estado?: string|null, responsable?: string }} [filtros]
 * @returns {boolean}
 */
export function hayFiltrosDeProyecto(filtros = {}) {
  return Boolean(filtros.estado || filtros.responsable?.trim());
}
