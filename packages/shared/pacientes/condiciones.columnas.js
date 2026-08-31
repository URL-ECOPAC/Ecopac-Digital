// Que datos se muestran de una condicion cronica (issue #122).
//
// Dos listas, porque son dos pantallas distintas que pide #132:
//   - COLUMNAS_CONDICION_DEL_PACIENTE: las condiciones dentro de la ficha de un paciente.
//   - COLUMNAS_PACIENTE_CRONICO: el listado de pacientes cronicos de una comunidad.
//
// La columna `condiciones` de tipo CHIPS que ya declara columnas.js:18 es otra cosa: es el
// resumen que va en la fila del listado general de pacientes. Aqui se describe el detalle.

import { TIPOS_DE_PRESENTACION } from "../descriptores.js";

/** Una condicion en la ficha del paciente. */
export const COLUMNAS_CONDICION_DEL_PACIENTE = [
  { id: "condicion", label: "Condicion", tipo: TIPOS_DE_PRESENTACION.TEXTO, principal: true },
  { id: "fechaDiagnostico", label: "Diagnosticada", tipo: TIPOS_DE_PRESENTACION.FECHA },
  {
    id: "estado",
    label: "Estado",
    tipo: TIPOS_DE_PRESENTACION.ESTADO,
    etiquetasDesde: "estadosCondicionCronica",
  },
  { id: "notas", label: "Notas", tipo: TIPOS_DE_PRESENTACION.TEXTO },
];

/**
 * Un paciente en el listado de cronicos de una comunidad.
 *
 * Repite avatar, nombre y comunidad de COLUMNAS_PACIENTE en lugar de reutilizarla porque esta
 * lista se arma desde padecimientos_cronicos: cada fila es una condicion de un paciente, no un
 * paciente, y las dos ultimas columnas no existen en aquella.
 */
export const COLUMNAS_PACIENTE_CRONICO = [
  {
    id: "avatar",
    label: "",
    tipo: TIPOS_DE_PRESENTACION.AVATAR,
    desde: "nombreCompleto",
    anchoWeb: "48px",
  },
  { id: "nombreCompleto", label: "Nombre", tipo: TIPOS_DE_PRESENTACION.TEXTO, principal: true },
  { id: "comunidad", label: "Comunidad", tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: "condicion", label: "Condicion", tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: "fechaDiagnostico", label: "Diagnosticada", tipo: TIPOS_DE_PRESENTACION.FECHA },
  {
    id: "estado",
    label: "Estado",
    tipo: TIPOS_DE_PRESENTACION.ESTADO,
    etiquetasDesde: "estadosCondicionCronica",
  },
];
