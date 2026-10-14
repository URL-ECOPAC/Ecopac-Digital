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
//    (TEXTO, NUMERO, TELEFONO) se exportan tal cual llegan en la fila.
//
// 4. ESTADO y CHIP SI se traducen, desde la issue #862, pasando `catalogos` como tercer
//    argumento. El comentario anterior decia que quedaban fuera "porque su etiqueta vive en la
//    app": eso era cierto del COMPONENTE, no del catalogo, que es un descriptor de shared como
//    cualquier otro y el hook ya tiene a mano. Sin esto, la columna "Alerta" del reporte de
//    vencimientos exportaba la cadena del enum -"critico"- en vez de "Crítico", y la columna
//    "Vencimiento" del desglose por lote exportaba `true` y `false`. Quien abre el CSV ve otra
//    cosa que quien mira la pantalla, que es justo lo que un export no debe hacer.
//
//    `catalogos` es opcional: sin el, el comportamiento es exactamente el de antes.

import { TIPOS_DE_PRESENTACION } from "../descriptores.js";
import { formatearFechaCorta } from "../formato/fechas.js";
import { formatearMoneda } from "../formato/moneda.js";

const BOM_UTF8 = String.fromCharCode(0xfeff);
const SEPARADOR_CAMPO = ",";
const SEPARADOR_LINEA = "\r\n";

// Inyeccion de formulas (issue #698, relacionada con #239 / OWASP A03): un valor que empiece
// por uno de estos caracteres se interpreta como formula al abrirlo en Excel o Google Sheets, y
// los reportes exportan campos escritos por usuarios (concepto de gasto, nombre de paciente,
// nombre de medicamento) donde eso es explotable -un "=HYPERLINK(...)" en un nombre se activa en
// la maquina de quien abre el CSV. La mitigacion estandar es anteponer un apostrofo: la celda
// se sigue viendo igual, pero deja de evaluarse como formula.
const PREFIJO_DE_FORMULA = /^[=+\-@\t\r]/;

/**
 * Escapa un valor para una celda CSV segun RFC 4180: si contiene coma, comilla doble o un
 * salto de linea, lo envuelve en comillas dobles y duplica las comillas internas. Antes de eso,
 * neutraliza un posible prefijo de formula (ver PREFIJO_DE_FORMULA).
 *
 * @param {*} valor
 * @returns {string}
 */
export function escaparCampoCSV(valor) {
  if (valor === null || valor === undefined) return "";

  let texto = String(valor);
  if (PREFIJO_DE_FORMULA.test(texto)) texto = `'${texto}`;

  const necesitaComillas = /["\r\n,]/.test(texto);
  if (!necesitaComillas) return texto;

  return `"${texto.replace(/"/g, '""')}"`;
}

function formatearValorDeCelda(valor, columna, catalogos = {}) {
  if (valor === null || valor === undefined) return "";

  switch (columna?.tipo) {
    case TIPOS_DE_PRESENTACION.FECHA:
      return formatearFechaCorta(valor);
    case TIPOS_DE_PRESENTACION.MONEDA:
      return formatearMoneda(valor) ?? "";
    case TIPOS_DE_PRESENTACION.BOOLEANO:
      return valor ? "Si" : "No";
    default:
      break;
  }

  // Una columna de estado guarda el valor del enum -o un booleano, como `vencido`- y muestra la
  // etiqueta de su catalogo. Mismo `etiquetasDesde` que leen DataList y ReporteImprimible.
  if (columna?.etiquetasDesde) {
    const catalogo = catalogos[columna.etiquetasDesde] ?? [];
    const opcion = catalogo.find((entrada) => entrada.value === valor);
    if (opcion) return String(opcion.label);
  }

  if (typeof valor === "boolean") return valor ? "Si" : "No";
  return String(valor);
}

/**
 * Convierte un arreglo de filas planas a contenido CSV, usando `columna.label` como
 * encabezado y `columna.tipo` para formatear fechas y montos.
 *
 * @param {Array<Object>} filas
 * @param {Array<{id: string, label: string, tipo?: string, etiquetasDesde?: string}>} columnas
 * @param {Record<string, Array<{value: *, label: string}>>} [catalogos] Para las columnas ESTADO.
 * @returns {string} Contenido CSV completo, con BOM UTF-8 y terminadores CRLF.
 */
export function exportarFilasACSV(filas, columnas, catalogos = {}) {
  const columnasSeguras = Array.isArray(columnas) ? columnas : [];
  const filasSeguras = Array.isArray(filas) ? filas : [];

  const encabezado = columnasSeguras
    .map((columna) => escaparCampoCSV(columna.label))
    .join(SEPARADOR_CAMPO);

  const lineas = filasSeguras.map((fila) =>
    columnasSeguras
      .map((columna) =>
        escaparCampoCSV(
          formatearValorDeCelda(fila?.[columna.desde ?? columna.id], columna, catalogos),
        ),
      )
      .join(SEPARADOR_CAMPO),
  );

  return BOM_UTF8 + [encabezado, ...lineas].join(SEPARADOR_LINEA);
}
