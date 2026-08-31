// Generacion de CSV para los reportes (issue #207).
//
// Esta funcion SOLO arma el string: la descarga (Blob en web, escritura a FileSystem en
// movil) es responsabilidad de cada app, porque packages/shared no puede usar APIs
// web-only (ver docs/ARQUITECTURA-FRONTEND.md). Aqui no hay ni un import de Blob ni de
// document.
//
// Tres decisiones que no son obvias con solo mirar el codigo:
//
// 1. BOM UTF-8 al inicio del string. Sin el, Excel en Windows abre un CSV con acentos
//    asumiendo la codificacion ANSI de la maquina y "Jose" sale como caracteres invalidos.
//    Google Sheets y los editores de texto ignoran el BOM sin problema, asi que agregarlo
//    no rompe a nadie; omitirlo rompe al caso mas comun de la operacion (Excel en Windows).
//
// 2. Terminador de linea CRLF, no LF. Es el que exige RFC 4180 y el que Excel espera fila
//    por fila; con solo LF, algunas versiones de Excel en Windows leen el archivo entero
//    como una sola celda con saltos de linea dentro en vez de una fila por linea.
//
// 3. Las columnas de tipo FECHA y MONEDA se formatean AQUI, reusando formatearFechaCorta()
//    y formatearMoneda() de formato/. No se deja a discrecion del llamador: el criterio de
//    aceptacion de la #207 exige que la fecha salga en un formato que la hoja de calculo
//    reconozca, y dejarlo al hook de cada pantalla es la manera segura de que una de las
//    cuatro pantallas de reporte lo olvide y exporte un ISO crudo. El resto de tipos
//    (TEXTO, NUMERO, TELEFONO, BOOLEANO) se exportan tal cual llegan en la fila. ESTADO,
//    CHIP, CHIPS y AVATAR quedan fuera de este formateo automatico: su etiqueta visible
//    sale de un catalogo (etiquetasDesde) que vive en la app, no en esta funcion pura.

import { TIPOS_DE_PRESENTACION } from "../descriptores.js";
import { formatearFechaCorta } from "../formato/fechas.js";
import { formatearMoneda } from "../formato/moneda.js";

const BOM_UTF8 = String.fromCharCode(0xfeff);
const SEPARADOR_CAMPO = ",";
const SEPARADOR_LINEA = "\r\n";

/**
 * Escapa un valor para una celda CSV segun RFC 4180: si contiene coma, comilla doble o un
 * salto de linea, lo envuelve en comillas dobles y duplica las comillas internas.
 *
 * @param {*} valor
 * @returns {string}
 */
export function escaparCampoCSV(valor) {
  if (valor === null || valor === undefined) return "";

  const texto = String(valor);
  const necesitaComillas = /["\r\n,]/.test(texto);
  if (!necesitaComillas) return texto;

  return `"${texto.replace(/"/g, '""')}"`;
}

function formatearValorDeCelda(valor, columna) {
  if (valor === null || valor === undefined) return "";

  switch (columna?.tipo) {
    case TIPOS_DE_PRESENTACION.FECHA:
      return formatearFechaCorta(valor);
    case TIPOS_DE_PRESENTACION.MONEDA:
      return formatearMoneda(valor) ?? "";
    default:
      return String(valor);
  }
}

/**
 * Convierte un arreglo de filas planas a contenido CSV, usando `columna.label` como
 * encabezado y `columna.tipo` para formatear fechas y montos.
 *
 * @param {Array<Object>} filas
 * @param {Array<{id: string, label: string, tipo?: string}>} columnas
 * @returns {string} Contenido CSV completo, con BOM UTF-8 y terminadores CRLF.
 */
export function exportarFilasACSV(filas, columnas) {
  const columnasSeguras = Array.isArray(columnas) ? columnas : [];
  const filasSeguras = Array.isArray(filas) ? filas : [];

  const encabezado = columnasSeguras
    .map((columna) => escaparCampoCSV(columna.label))
    .join(SEPARADOR_CAMPO);

  const lineas = filasSeguras.map((fila) =>
    columnasSeguras
      .map((columna) => escaparCampoCSV(formatearValorDeCelda(fila?.[columna.id], columna)))
      .join(SEPARADOR_CAMPO),
  );

  return BOM_UTF8 + [encabezado, ...lineas].join(SEPARADOR_LINEA);
}
