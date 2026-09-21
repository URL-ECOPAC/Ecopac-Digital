// Que datos se muestran de una condicion cronica (issue #122).
//
// Tres listas, porque son tres pantallas distintas:
//   - COLUMNAS_CONDICION_DEL_PACIENTE: las condiciones dentro de la ficha de un paciente (#132).
//   - COLUMNAS_PACIENTE_CRONICO: el listado de pacientes cronicos de una comunidad (#132).
//   - COLUMNAS_CATALOGO_CONDICIONES: el catalogo en si, que es la pantalla de la #850.
//
// La columna `condiciones` de tipo CHIPS que ya declara columnas.js:18 es otra cosa: es el
// resumen que va en la fila del listado general de pacientes. Aqui se describe el detalle.

import { TIPOS_DE_PRESENTACION } from "../descriptores.js";
import { labels } from "@ecopac/ui-tokens";

/** Una condicion en la ficha del paciente. */
export const COLUMNAS_CONDICION_DEL_PACIENTE = [
  { id: "condicion", label: "Condición", tipo: TIPOS_DE_PRESENTACION.TEXTO, principal: true },
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
  { id: "condicion", label: "Condición", tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: "fechaDiagnostico", label: "Diagnosticada", tipo: TIPOS_DE_PRESENTACION.FECHA },
  {
    id: "estado",
    label: "Estado",
    tipo: TIPOS_DE_PRESENTACION.ESTADO,
    etiquetasDesde: "estadosCondicionCronica",
  },
];

/**
 * Catalogo para la columna de estado del catalogo: `value` es el booleano que guarda
 * `condiciones_cronicas.es_vigente` y `clave` es lo que indexa `statusColors`.
 *
 * Hacen falta los dos porque la celda no guarda el valor de un enum, sino un booleano: sin
 * `clave`, DataList pintaria `true`. Mismo patron que ESTADOS_DIAGNOSTICO y ESTADOS_USUARIO.
 */
export const ESTADOS_CONDICION_CATALOGO = [
  { value: true, clave: "activo", label: labels.activo },
  { value: false, clave: "inactivo", label: labels.inactivo },
];

/**
 * Una condicion en la pantalla de mantenimiento del catalogo (issue #850).
 *
 * Solo dos columnas: la tabla tiene nombre, `es_vigente` y `created_at`, y la fecha de creacion
 * no le dice nada a quien mantiene el catalogo.
 */
export const COLUMNAS_CATALOGO_CONDICIONES = [
  { id: "nombre", label: "Condición", tipo: TIPOS_DE_PRESENTACION.TEXTO, principal: true },
  {
    id: "estado",
    label: "Estado",
    tipo: TIPOS_DE_PRESENTACION.ESTADO,
    desde: "esVigente",
    etiquetasDesde: "estadoCondicionCatalogo",
  },
];
