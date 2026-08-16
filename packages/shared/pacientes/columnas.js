// EJEMPLAR DE REFERENCIA de la arquitectura compartida (ver docs/ARQUITECTURA-FRONTEND.md).
//
// Una sola definicion de que datos se muestran de un paciente. El componente DataList de
// cada app la interpreta distinto: en web se vuelve una <Table> con estas columnas, en
// movil una tarjeta con estos mismos campos apilados. La lista, el orden y las etiquetas
// no se repiten en ninguna de las dos apps.
//
// Fuente: wireframe de gestion de pacientes (Entregable Semana 6, p. 62 y p. 66).

export const COLUMNAS_PACIENTE = [
  { id: 'avatar', label: '', tipo: 'avatar', desde: 'nombreCompleto', anchoWeb: '48px' },
  { id: 'nombreCompleto', label: 'Nombre', tipo: 'texto', principal: true },
  { id: 'edad', label: 'Edad', tipo: 'numero', sufijo: 'anios' },
  { id: 'sexo', label: 'Genero', tipo: 'texto' },
  { id: 'comunidad', label: 'Municipio', tipo: 'texto' },
  { id: 'condiciones', label: 'Condiciones', tipo: 'chips' },
];

/** Datos de la ficha clinica, en el orden en que el diseno los presenta. */
export const CAMPOS_FICHA_PACIENTE = [
  { id: 'codigoFicha', label: 'Numero de ficha', tipo: 'texto' },
  { id: 'dpi', label: 'DPI', tipo: 'texto' },
  { id: 'fechaNacimiento', label: 'Fecha de nacimiento', tipo: 'fecha' },
  { id: 'sexo', label: 'Genero', tipo: 'texto' },
  { id: 'tipoSangre', label: 'Tipo sanguineo', tipo: 'texto' },
  { id: 'idioma', label: 'Idioma', tipo: 'texto' },
  { id: 'comunidad', label: 'Comunidad', tipo: 'texto' },
  { id: 'telefono', label: 'Telefono', tipo: 'telefono' },
  { id: 'nombreResponsable', label: 'Responsable', tipo: 'texto' },
  { id: 'parentescoResponsable', label: 'Parentesco', tipo: 'texto' },
];
