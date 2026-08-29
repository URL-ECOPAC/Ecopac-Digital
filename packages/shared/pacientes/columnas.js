// EJEMPLAR DE REFERENCIA de la arquitectura compartida (ver docs/ARQUITECTURA-FRONTEND.md).
//
// Una sola definicion de que datos se muestran de un paciente. El componente DataList de
// cada app la interpreta distinto: en web se vuelve una <Table> con estas columnas, en
// movil una tarjeta con estos mismos campos apilados. La lista, el orden y las etiquetas
// no se repiten en ninguna de las dos apps.
//
// Fuente: wireframe de gestion de pacientes (Entregable Semana 6, p. 62 y p. 66).

import { TIPOS_DE_PRESENTACION } from '../descriptores.js';

export const COLUMNAS_PACIENTE = [
  { id: 'avatar', label: '', tipo: TIPOS_DE_PRESENTACION.AVATAR, desde: 'nombreCompleto', anchoWeb: '48px' },
  { id: 'numeroFicha', label: 'Ficha', tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: 'nombreCompleto', label: 'Nombre', tipo: TIPOS_DE_PRESENTACION.TEXTO, principal: true },
  { id: 'edad', label: 'Edad', tipo: TIPOS_DE_PRESENTACION.NUMERO, sufijo: 'anios' },
  { id: 'sexo', label: 'Genero', tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: 'comunidad', label: 'Municipio', tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: 'condiciones', label: 'Condiciones', tipo: TIPOS_DE_PRESENTACION.CHIPS },
  { id: 'ultimaAtencion', label: 'Ultima atencion', tipo: TIPOS_DE_PRESENTACION.FECHA },
];

/** Datos de la ficha clinica, en el orden en que el diseno los presenta. */
export const CAMPOS_FICHA_PACIENTE = [
  { id: 'codigoFicha', label: 'Numero de ficha', tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: 'dpi', label: 'DPI', tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: 'fechaNacimiento', label: 'Fecha de nacimiento', tipo: TIPOS_DE_PRESENTACION.FECHA },
  { id: 'sexo', label: 'Genero', tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: 'tipoSangre', label: 'Tipo sanguineo', tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: 'idioma', label: 'Idioma', tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: 'comunidad', label: 'Comunidad', tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: 'telefono', label: 'Telefono', tipo: TIPOS_DE_PRESENTACION.TELEFONO },
  { id: 'nombreResponsable', label: 'Responsable', tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: 'parentescoResponsable', label: 'Parentesco', tipo: TIPOS_DE_PRESENTACION.TEXTO },
];
