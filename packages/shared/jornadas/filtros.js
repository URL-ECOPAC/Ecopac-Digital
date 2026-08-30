// Filtros de las pantallas de listado del modulo de jornadas: el listado general y el
// kanban comparten el mismo filtro de busqueda/estado/comunidad; el kanban ademas
// agrupa por estado en vez de filtrar por un solo valor a la vez.

import { TIPOS_DE_FILTRO } from '../descriptores.js';
import { ESTADOS_JORNADA, ETIQUETAS_ESTADO_JORNADA, opcionesDe } from "../enums.js";

/** Valores de estado_jornada (supabase/migrations/00001_initial_schema.sql). */
export const OPCIONES_ESTADO_JORNADA = opcionesDe(ESTADOS_JORNADA, ETIQUETAS_ESTADO_JORNADA);

export const FILTROS_JORNADA = [
  { id: 'busqueda', tipo: TIPOS_DE_FILTRO.BUSQUEDA, label: 'Buscar jornada', placeholder: 'Nombre o codigo' },
  { id: 'estado', tipo: TIPOS_DE_FILTRO.SELECT, label: 'Estado', opciones: OPCIONES_ESTADO_JORNADA },
  { id: 'comunidad', tipo: TIPOS_DE_FILTRO.SELECT, label: 'Comunidad', opcionesDesde: 'comunidades' },
  { id: 'rangoFecha', tipo: TIPOS_DE_FILTRO.RANGO, label: 'Fecha' },
];

/**
 * Estado inicial de los filtros del tablero de jornadas (issue #178).
 *
 * Solo trae estado, comunidad y rangoFecha: `busqueda` queda declarado en FILTROS_JORNADA (lo
 * usaria un listado que si lo soporte) pero listarJornadas() (#170, api.js) no acepta ningun
 * parametro de busqueda de texto, asi que la pantalla del tablero no lo pasa a FilterBar ni le
 * reserva estado aqui. Mismo patron que FILTROS_USUARIO_VACIOS en usuarios/filtros.js.
 */
export const FILTROS_JORNADA_VACIOS = {
  estado: null,
  comunidad: null,
  rangoFecha: null,
};
