// EJEMPLAR DE REFERENCIA de la arquitectura compartida (ver docs/ARQUITECTURA-FRONTEND.md).
//
// Este archivo existe para que el resto de modulos tenga un patron concreto que copiar.
// Los filtros se declaran una sola vez aqui; la web los dibuja con <Form.Select> y la app
// movil con <Selector>, sin que ninguna de las dos redefina la lista.
//
// Fuente: wireframe de gestion de pacientes (Entregable Semana 6, p. 62 web y p. 66 movil).

import { TIPOS_DE_FILTRO } from '../descriptores.js';

export const FILTROS_PACIENTE = [
  {
    id: 'busqueda',
    tipo: TIPOS_DE_FILTRO.BUSQUEDA,
    label: 'Buscar paciente',
    placeholder: 'Nombre, numero de ficha o DPI',
  },
  {
    id: 'comunidad',
    tipo: TIPOS_DE_FILTRO.SELECT,
    label: 'Lugar',
    // Las opciones se cargan del catalogo de comunidades; el descriptor solo declara
    // de donde salen para que ambas apps las resuelvan igual.
    opcionesDesde: 'comunidades',
  },
  {
    id: 'sexo',
    tipo: TIPOS_DE_FILTRO.SELECT,
    label: 'Sexo',
    opcionesDesde: 'sexo',
  },
  {
    id: 'rangoEdad',
    tipo: TIPOS_DE_FILTRO.RANGO,
    label: 'Rango de edad',
    min: 0,
    max: 120,
  },
];

/** Valor inicial de los filtros, para que ambas apps arranquen en el mismo estado. */
export const FILTROS_PACIENTE_VACIOS = {
  busqueda: '',
  comunidad: null,
  sexo: null,
  rangoEdad: null,
};
