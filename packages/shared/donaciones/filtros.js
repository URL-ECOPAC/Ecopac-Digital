// Esquema declarativo de los filtros de las pantallas de listado de donantes y donaciones
// (issue #287). Mismo patron que packages/shared/pacientes/filtros.js: cada FILTROS_X trae su
// FILTROS_X_VACIOS, el estado inicial que consume la pantalla antes de que la persona toque nada.

import { TIPOS_DE_FILTRO } from "../descriptores.js";
import { OPCIONES_ESTADO_DONACION, OPCIONES_TIPO_DONACION, OPCIONES_TIPO_DONANTE } from "./campos.js";

export const FILTROS_DONANTE = [
  { id: "busqueda", tipo: TIPOS_DE_FILTRO.BUSQUEDA, label: "Buscar donante", placeholder: "Nombre, contacto o correo" },
  { id: "tipo", tipo: TIPOS_DE_FILTRO.SELECT, label: "Tipo de donante", opciones: OPCIONES_TIPO_DONANTE },
  // El valor viaja como booleano, el mismo que listarDonantes() traduce a soloActivos; la
  // pantalla hace ese mapeo, el descriptor solo declara el control.
  { id: "estado", tipo: TIPOS_DE_FILTRO.SELECT, label: "Estado", opcionesDesde: "estadoDonante" },
];

export const FILTROS_DONANTE_VACIOS = {
  busqueda: "",
  tipo: null,
  estado: null,
};

export const FILTROS_DONACION = [
  { id: "busqueda", tipo: TIPOS_DE_FILTRO.BUSQUEDA, label: "Buscar donacion", placeholder: "Donante u observaciones" },
  { id: "donanteId", tipo: TIPOS_DE_FILTRO.SELECT, label: "Donante", opcionesDesde: "donantes" },
  { id: "tipo", tipo: TIPOS_DE_FILTRO.SELECT, label: "Tipo de donacion", opciones: OPCIONES_TIPO_DONACION },
  { id: "estado", tipo: TIPOS_DE_FILTRO.SELECT, label: "Estado", opciones: OPCIONES_ESTADO_DONACION },
  { id: "rangoFecha", tipo: TIPOS_DE_FILTRO.RANGO, label: "Fecha", desde: "fechaInicio", hasta: "fechaFin" },
];

export const FILTROS_DONACION_VACIOS = {
  busqueda: "",
  donanteId: null,
  tipo: null,
  estado: null,
  rangoFecha: null,
};
