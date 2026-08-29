// Esquema declarativo de las columnas/ficha de proyectos, hitos y seguimiento (issue #287).

import { TIPOS_DE_PRESENTACION } from "../descriptores.js";

export const COLUMNAS_PROYECTO = [
  { id: "nombre", label: "Nombre", tipo: TIPOS_DE_PRESENTACION.TEXTO, principal: true },
  // No es columna de `proyectos`: sale del join con responsable_id (perfiles).
  { id: "responsable", label: "Responsable", tipo: TIPOS_DE_PRESENTACION.TEXTO, desde: "responsableNombre" },
  { id: "fechaInicio", label: "Inicio", tipo: TIPOS_DE_PRESENTACION.FECHA },
  { id: "fechaFin", label: "Fin", tipo: TIPOS_DE_PRESENTACION.FECHA },
  // proyectos.estado guarda el valor del enum tal cual (00007): CHIP, no ESTADO. Se usa la
  // columna real `estado`, NO `etapa` -tableroProyectosApi.js lee `proyecto.etapa`, que no es
  // una columna real desde la 00029 (bug preexistente, fuera de alcance de esta issue).
  { id: "estado", label: "Estado", tipo: TIPOS_DE_PRESENTACION.CHIP },
  { id: "porcentajeAvance", label: "Avance", tipo: TIPOS_DE_PRESENTACION.NUMERO, sufijo: "%" },
];

export const CAMPOS_FICHA_PROYECTO = [
  { id: "nombre", label: "Nombre", tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: "descripcion", label: "Descripcion", tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: "responsable", label: "Responsable", tipo: TIPOS_DE_PRESENTACION.TEXTO, desde: "responsableNombre" },
  { id: "fechaInicio", label: "Inicio", tipo: TIPOS_DE_PRESENTACION.FECHA },
  { id: "fechaFin", label: "Fin", tipo: TIPOS_DE_PRESENTACION.FECHA },
  { id: "estado", label: "Estado", tipo: TIPOS_DE_PRESENTACION.CHIP },
  { id: "porcentajeAvance", label: "Avance", tipo: TIPOS_DE_PRESENTACION.NUMERO, sufijo: "%" },
];

/** Hitos de un proyecto (proyecto_hitos, 00053); campos ya en camelCase por avance.api.js. */
export const COLUMNAS_HITO = [
  { id: "nombre", label: "Hito", tipo: TIPOS_DE_PRESENTACION.TEXTO, principal: true },
  { id: "fechaPrevista", label: "Fecha prevista", tipo: TIPOS_DE_PRESENTACION.FECHA },
  { id: "fechaReal", label: "Cumplido", tipo: TIPOS_DE_PRESENTACION.FECHA },
];

/**
 * Bitacora de avance de un proyecto (proyecto_seguimiento, 00053): solo lectura, sin politica de
 * UPDATE/DELETE (append-only).
 */
export const COLUMNAS_SEGUIMIENTO = [
  { id: "createdAt", label: "Fecha", tipo: TIPOS_DE_PRESENTACION.FECHA },
  { id: "nota", label: "Nota", tipo: TIPOS_DE_PRESENTACION.TEXTO, principal: true },
  { id: "porcentajeAnterior", label: "Antes", tipo: TIPOS_DE_PRESENTACION.NUMERO, sufijo: "%" },
  { id: "porcentajeNuevo", label: "Despues", tipo: TIPOS_DE_PRESENTACION.NUMERO, sufijo: "%" },
];
