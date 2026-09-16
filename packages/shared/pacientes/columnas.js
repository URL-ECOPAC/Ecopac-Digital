// EJEMPLAR DE REFERENCIA de la arquitectura compartida (ver docs/ARQUITECTURA-FRONTEND.md).
//
// Una sola definicion de que datos se muestran de un paciente. El componente DataList de
// cada app la interpreta distinto: en web se vuelve una <Table> con estas columnas, en
// movil una tarjeta con estos mismos campos apilados. La lista, el orden y las etiquetas
// no se repiten en ninguna de las dos apps.
//
// Fuente: wireframe de gestion de pacientes (Entregable Semana 6, p. 62 y p. 66).

import { TIPOS_DE_PRESENTACION } from "../descriptores.js";

export const COLUMNAS_PACIENTE = [
  {
    id: "avatar",
    label: "",
    tipo: TIPOS_DE_PRESENTACION.AVATAR,
    desde: "nombreCompleto",
    anchoWeb: "48px",
  },
  { id: "numeroFicha", label: "Ficha", tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: "nombreCompleto", label: "Nombre", tipo: TIPOS_DE_PRESENTACION.TEXTO, principal: true },
  { id: "edad", label: "Edad", tipo: TIPOS_DE_PRESENTACION.NUMERO, sufijo: "años" },
  { id: "sexo", label: "Sexo", tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: "comunidad", label: "Comunidad", tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: "condiciones", label: "Condiciones", tipo: TIPOS_DE_PRESENTACION.CHIPS },
  { id: "ultimaAtencion", label: "Ultima atencion", tipo: TIPOS_DE_PRESENTACION.FECHA },
];

/** Datos de la ficha clinica, en el orden en que el diseno los presenta. */
export const COLUMNAS_PACIENTE_MOVIL = COLUMNAS_PACIENTE.filter((columna) =>
  ["avatar", "nombreCompleto", "numeroFicha", "edad", "comunidad"].includes(columna.id),
);

export const CAMPOS_FICHA_PACIENTE = [
  { id: "numeroFicha", label: "Numero de ficha", tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: "dpi", label: "DPI", tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: "fechaNacimiento", label: "Fecha de nacimiento", tipo: TIPOS_DE_PRESENTACION.FECHA },
  { id: "sexo", label: "Sexo", tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: "tipoSangre", label: "Tipo sanguineo", tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: "idioma", label: "Idioma", tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: "departamento", label: "Departamento", tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: "municipio", label: "Municipio", tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: "comunidad", label: "Comunidad", tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: "telefonoContacto", label: "Telefono", tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: "nombreResponsable", label: "Responsable", tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: "parentescoResponsable", label: "Parentesco", tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: "fechaBaja", label: "Fecha de baja", tipo: TIPOS_DE_PRESENTACION.FECHA },
  // Las dos ultimas columnas de `pacientes` (00009) que no llegaban a ninguna pantalla. La API
  // ya las traia -COLUMNAS_DEL_PACIENTE pide created_at y updated_at desde siempre- y la ficha
  // simplemente no las dibujaba, asi que no habia forma de saber cuando se registro un
  // expediente ni si alguien lo habia corregido despues. Con FECHA_HORA y no FECHA: son
  // TIMESTAMPTZ, y dos correcciones de la misma tarde se leerian identicas sin la hora.
  { id: "registradoEn", label: "Registrado el", tipo: TIPOS_DE_PRESENTACION.FECHA_HORA },
  { id: "actualizadoEn", label: "Ultima actualizacion", tipo: TIPOS_DE_PRESENTACION.FECHA_HORA },
];
