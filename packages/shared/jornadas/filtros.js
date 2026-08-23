// Filtros de las pantallas de listado del modulo de jornadas: el listado general y el
// kanban comparten el mismo filtro de busqueda/estado/comunidad; el kanban ademas
// agrupa por estado en vez de filtrar por un solo valor a la vez.

import { TIPOS_DE_FILTRO } from '../descriptores.js';

/** Valores de estado_jornada (supabase/migrations/00001_initial_schema.sql). */
export const OPCIONES_ESTADO_JORNADA = [
  { valor: 'planificada', etiqueta: 'Planificada' },
  { valor: 'en curso', etiqueta: 'En curso' },
  { valor: 'finalizada', etiqueta: 'Finalizada' },
  { valor: 'cancelada', etiqueta: 'Cancelada' },
];

export const FILTROS_JORNADA = [
  { id: 'busqueda', tipo: TIPOS_DE_FILTRO.BUSQUEDA, label: 'Buscar jornada', placeholder: 'Nombre o codigo' },
  { id: 'estado', tipo: TIPOS_DE_FILTRO.SELECT, label: 'Estado', opciones: OPCIONES_ESTADO_JORNADA },
  { id: 'comunidad', tipo: TIPOS_DE_FILTRO.SELECT, label: 'Comunidad', opcionesDesde: 'comunidades' },
  { id: 'rangoFecha', tipo: TIPOS_DE_FILTRO.RANGO, label: 'Fecha' },
];
