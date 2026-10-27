import { calcularEdad, formatearFechaCorta } from "../formato/fechas.js";
import { textoComparable } from "../formato/opciones.js";
import { nombreCompletoDePaciente } from "./ficha.js";
import {
  describirEntrega,
  describirMedicamento,
  describirPosologia,
} from "./useRecetasPaciente.js";

export const ENCABEZADO_DE_RECETA = Object.freeze({
  organizacion: "Ecopac Guatemala",
  documento: "Receta medica",
});

/**
 * Los datos de una receta listos para imprimir: encabezado de la organizacion, folio, medico,
 * paciente y renglones.
 *
 * @param {object} [opciones]
 * @param {object} opciones.receta Receta ya normalizada por la API.
 * @param {object} [opciones.paciente] Paciente de la receta.
 * @returns {object|null} `null` sin receta.
 */
export function datosDeRecetaImprimible({ receta, paciente } = {}) {
  if (!receta) return null;

  return {
    ...ENCABEZADO_DE_RECETA,
    folio: receta.folio ?? null,
    fecha: receta.createdAt ?? null,
    estado: receta.estado ?? null,
    anulada: receta.anulada === true,
    motivoAnulacion: receta.motivoAnulacion ?? null,
    anuladaEn: receta.anuladaEn ?? null,
    medico: receta.medico ?? null,
    jornada: receta.jornada ?? null,
    fechaDeJornada: receta.fechaDeJornada ?? null,
    indicacionesGenerales: receta.indicacionesGenerales ?? null,
    paciente: {
      nombre: nombreCompletoDePaciente(paciente),
      numeroFicha: paciente?.expediente?.numeroFicha ?? null,
      edad: calcularEdad(paciente?.fechaNacimiento)?.texto ?? null,
      sexo: paciente?.sexo ?? null,
      comunidad: paciente?.comunidad?.nombre ?? null,
    },
    medicamentos: (receta.detalle ?? []).map((renglon) => ({
      id: renglon.id,
      descripcion: describirMedicamento(renglon),
      posologia: describirPosologia(renglon),
      // La cifra vigente: la corregida si la hubo (00128). Una receta impresa despues de ajustar
      // la entrega decia la cantidad original.
      cantidadEntregada: describirEntrega(renglon).vigente,
    })),
  };
}

// ---------------------------------------------------------------------------------------------
// Receta medica: el formato que imita la receta escrita a mano ("Rp:", "# 10 tabletas", "Uso:").
// Convive con datosDeRecetaImprimible, que sigue siendo el de "Imprimir / PDF".
// ---------------------------------------------------------------------------------------------

export const DOCUMENTO_RECETA_MEDICA = "Receta médica";

// La base guarda kilos (00013) aunque el triaje se capture en libras (triaje.api.js).
const LIBRAS_POR_KILO = 2.20462;

// Lo que se entrega de una presentacion que no se cuenta por pieza: de un jarabe se entrega el
// frasco. Las claves van en textoComparable(); las que no estan se nombran como la presentacion.
const ENVASE_DE_PRESENTACION = Object.freeze({
  jarabe: "frasco de jarabe",
  pomada: "tubo de pomada",
  "gotas oftalmicas": "frasco de gotas oftálmicas",
  "gotas oticas": "frasco de gotas óticas",
});

// Presentaciones en las que una dosis escrita como numero suelto ("1") se cuenta en piezas
// ("1 tableta"). En un jarabe un "5" puede ser ml o cucharaditas, asi que se deja como esta.
const PIEZA_DE_DOSIS = Object.freeze({
  tableta: "tableta",
  capsula: "cápsula",
  unidad: "unidad",
  "gotas oftalmicas": "gota",
  "gotas oticas": "gota",
});

const SE_APLICA = Object.freeze(["pomada", "inyectable", "gotas oftalmicas", "gotas oticas"]);

const NUMERO_SUELTO = /^\d+([.,]\d+)?$/;
const EMPIEZA_CON_CANTIDAD =
  /^(\d|(un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|quince|treinta)\s)/i;

function pluralDePalabra(palabra) {
  if (/[sx]$/i.test(palabra)) return palabra;
  if (/[aeiouáéó]$/i.test(palabra)) return `${palabra}s`;
  if (/z$/i.test(palabra)) return `${palabra.slice(0, -1)}ces`;
  return `${palabra}es`;
}

// "frasco de jarabe" -> "frascos de jarabe": se pluraliza solo el nucleo, la primera palabra.
function enNumero(nombre, cantidad) {
  if (Number(cantidad) === 1) return nombre;
  const [nucleo, ...resto] = nombre.split(" ");
  return [pluralDePalabra(nucleo), ...resto].join(" ");
}

function minusculaInicial(texto) {
  return texto.charAt(0).toLowerCase() + texto.slice(1);
}

// Texto libre del medico, listo para ir en medio de una frase: sin espacios de mas, sin punto
// final, en minuscula inicial y con la tilde de "dia(s)", que el teclado casi nunca pone.
function enFrase(valor) {
  if (valor === null || valor === undefined) return "";
  const texto = String(valor).trim().replace(/\s+/g, " ").replace(/\.+$/, "");
  return minusculaInicial(texto)
    .replace(/(^|\s)dias(?=$|[\s,;])/gi, "$1días")
    .replace(/(^|\s)dia(?=$|[\s,;])/gi, "$1día");
}

function describirDosis(dosis, presentacion) {
  const texto = enFrase(dosis);
  const pieza = PIEZA_DE_DOSIS[textoComparable(presentacion)];
  if (!NUMERO_SUELTO.test(texto) || !pieza) return texto;
  return `${texto} ${enNumero(pieza, texto.replace(",", "."))}`;
}

function describirFrecuencia(frecuencia) {
  const texto = enFrase(frecuencia).replace(/^c\/\s*/i, "cada ");
  return /^\d/.test(texto) ? `cada ${texto}` : texto;
}

function describirDuracion(duracion) {
  const texto = enFrase(duracion).replace(/^x\s+/i, "por ");
  return EMPIEZA_CON_CANTIDAD.test(texto) ? `por ${texto}` : texto;
}

/**
 * La linea "# 10 tabletas" de la receta: cuanto se entrega y de que.
 *
 * @param {number|null} cantidad Cantidad vigente entregada (describirEntrega().vigente).
 * @param {string|null} [presentacion] Nombre del catalogo de presentaciones (00144).
 * @returns {string|null} `null` sin cantidad.
 */
export function describirCantidadRecetada(cantidad, presentacion) {
  if (cantidad === null || cantidad === undefined || cantidad === "") return null;
  const nombre =
    ENVASE_DE_PRESENTACION[textoComparable(presentacion)] ??
    (presentacion ? String(presentacion).trim().toLowerCase() : "");
  return nombre ? `# ${cantidad} ${enNumero(nombre, cantidad)}` : `# ${cantidad}`;
}

/**
 * La indicacion de uso en lenguaje natural, a partir de dosis, frecuencia y duracion
 * (receta_detalle, 00019; sus COMMENT ON de la 00156 dan la forma esperada: "1 tableta",
 * "cada 8 horas", "5 dias"). Son texto libre, asi que solo se completa lo que falta para que la
 * frase se lea: "cada" delante de "8 horas", "por" delante de "3 dias", la pieza detras de un
 * numero suelto. Lo que no viene se omite.
 *
 * @param {{ dosis?: string, frecuencia?: string, duracion?: string, presentacion?: string }} renglon
 * @returns {string|null} "tomar 1 tableta cada 8 horas por 3 días." o `null` si no hay ningun dato.
 */
export function describirUso(renglon) {
  const partes = [
    describirDosis(renglon?.dosis, renglon?.presentacion),
    describirFrecuencia(renglon?.frecuencia),
    describirDuracion(renglon?.duracion),
  ].filter(Boolean);
  if (partes.length === 0) return null;

  const verbo = SE_APLICA.includes(textoComparable(renglon?.presentacion)) ? "aplicar" : "tomar";
  return `${verbo} ${partes.join(" ")}.`;
}

function redondearADecimal(valor) {
  return Math.round(valor * 10) / 10;
}

/**
 * @param {number|string|null} kilos `triajes.peso`, en kg.
 * @returns {string|null} "62.5 kg (137.8 lb)": la base guarda kilos y el triaje se toma en libras.
 */
export function formatearPeso(kilos) {
  if (kilos === null || kilos === undefined || kilos === "") return null;
  const valor = Number(kilos);
  if (!Number.isFinite(valor)) return null;
  return `${redondearADecimal(valor)} kg (${redondearADecimal(valor * LIBRAS_POR_KILO)} lb)`;
}

/**
 * @param {number|string|null} centimetros `triajes.talla`, en cm.
 * @returns {string|null}
 */
export function formatearTalla(centimetros) {
  if (centimetros === null || centimetros === undefined || centimetros === "") return null;
  const valor = Number(centimetros);
  if (!Number.isFinite(valor)) return null;
  return `${redondearADecimal(valor)} cm`;
}

/**
 * Los datos de la receta en el formato de receta medica: paciente con peso y talla del triaje,
 * y cada medicamento en tres lineas (titulo, "# cantidad presentacion" y "Uso:"). A diferencia de
 * datosDeRecetaImprimible no lleva comunidad ni ficha.
 *
 * @param {object} [opciones]
 * @param {object} opciones.receta Receta ya normalizada por la API.
 * @param {object} [opciones.paciente] Paciente de la receta.
 * @returns {object|null} `null` sin receta.
 */
export function datosDeRecetaMedica({ receta, paciente } = {}) {
  if (!receta) return null;

  return {
    documento: DOCUMENTO_RECETA_MEDICA,
    fecha: receta.createdAt ?? null,
    anulada: receta.anulada === true,
    motivoAnulacion: receta.motivoAnulacion ?? null,
    anuladaEn: receta.anuladaEn ?? null,
    medico: receta.medico ?? null,
    jornada: receta.jornada ?? null,
    fechaDeJornada: receta.fechaDeJornada ?? null,
    indicacionesGenerales: receta.indicacionesGenerales?.trim() || null,
    paciente: {
      nombre: nombreCompletoDePaciente(paciente),
      edad: calcularEdad(paciente?.fechaNacimiento)?.texto ?? null,
      sexo: paciente?.sexo ?? null,
      peso: formatearPeso(receta.peso),
      talla: formatearTalla(receta.talla),
    },
    medicamentos: (receta.detalle ?? []).map((renglon, indice) => {
      // La cifra vigente, como en el formato de siempre: la corregida si la hubo (00128).
      const cantidad = describirCantidadRecetada(
        describirEntrega(renglon).vigente,
        renglon.presentacion,
      );
      // La presentacion va en la linea "#"; si no hay cantidad, se queda en el titulo.
      const titulo = cantidad
        ? [renglon.medicamento, renglon.concentracion].filter(Boolean).join(" ")
        : describirMedicamento(renglon);
      return {
        id: renglon.id,
        numero: indice + 1,
        titulo: titulo || "Medicamento sin nombre",
        cantidad,
        uso: describirUso(renglon),
      };
    }),
  };
}

const ESCAPES_HTML = Object.freeze({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
});

/**
 * Escapa `& < > " '` para insertar un valor en HTML sin que se interprete como marcado.
 *
 * @param {unknown} valor
 * @returns {string} `""` para `null` y `undefined`.
 */
export function escaparHtml(valor) {
  if (valor === null || valor === undefined) return "";
  return String(valor).replace(/[&<>"']/g, (caracter) => ESCAPES_HTML[caracter]);
}

function dato(etiqueta, valor) {
  return `<p class="dato"><span class="etiqueta">${escaparHtml(etiqueta)}:</span> ${
    valor ? escaparHtml(valor) : "&mdash;"
  }</p>`;
}

/**
 * Documento HTML completo de la receta, tamano carta, para imprimir o exportar a PDF desde
 * cualquiera de las dos apps. Todo valor pasa por `escaparHtml`.
 *
 * @param {object} [opciones]
 * @param {object} opciones.receta Receta ya normalizada por la API.
 * @param {object} [opciones.paciente] Paciente de la receta.
 * @returns {string|null} `null` sin receta.
 */
export function htmlDeRecetaImprimible({ receta, paciente } = {}) {
  const datos = datosDeRecetaImprimible({ receta, paciente });
  if (!datos) return null;

  const medicamentos = datos.medicamentos.length
    ? `<ol class="medicamentos">${datos.medicamentos
        .map(
          (medicamento) =>
            `<li><strong>${escaparHtml(medicamento.descripcion)}</strong>${
              medicamento.posologia ? `<div>${escaparHtml(medicamento.posologia)}</div>` : ""
            }${
              medicamento.cantidadEntregada !== null && medicamento.cantidadEntregada !== undefined
                ? `<div>Cantidad entregada: ${escaparHtml(medicamento.cantidadEntregada)}</div>`
                : ""
            }</li>`,
        )
        .join("")}</ol>`
    : "<p>Sin medicamentos.</p>";

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escaparHtml(datos.documento)}</title>
<style>
  @page { size: letter; margin: 16mm; }
  * { box-sizing: border-box; }
  body { font-family: Helvetica, Arial, sans-serif; color: #1a1a1a; font-size: 12pt; margin: 0; }
  header { border-bottom: 2px solid #1a1a1a; margin-bottom: 12pt; padding-bottom: 8pt; }
  h1 { font-size: 16pt; margin: 0; }
  h2 { font-size: 12pt; margin: 12pt 0 4pt; }
  .documento { font-size: 12pt; margin: 2pt 0 0; }
  .folio { color: #555; font-size: 10pt; margin: 2pt 0 0; }
  .anulada { border: 1.5pt solid #b00020; color: #b00020; font-weight: bold; margin-bottom: 10pt; padding: 6pt; text-align: center; }
  .bloque { margin-bottom: 10pt; }
  .dato { margin: 2pt 0; }
  .etiqueta { font-weight: bold; }
  .medicamentos { margin: 0; padding-left: 16pt; }
  .medicamentos li { margin-bottom: 6pt; }
  .firma { margin-top: 28pt; text-align: center; }
  .linea { border-top: 1pt solid #1a1a1a; display: block; margin: 0 auto 4pt; width: 60%; }
</style>
</head>
<body>
<header>
  <h1>${escaparHtml(datos.organizacion)}</h1>
  <p class="documento">${escaparHtml(datos.documento)}</p>
  <p class="folio">Folio ${escaparHtml(datos.folio ?? "sin folio")} &middot; ${escaparHtml(
    formatearFechaCorta(datos.fecha),
  )}</p>
</header>
${
  datos.anulada
    ? `<p class="anulada">RECETA ANULADA${
        datos.anuladaEn ? ` el ${escaparHtml(formatearFechaCorta(datos.anuladaEn))}` : ""
      }${datos.motivoAnulacion ? `: ${escaparHtml(datos.motivoAnulacion)}` : ""}</p>`
    : ""
}
<section class="bloque">
  ${dato("Paciente", datos.paciente.nombre)}
  ${dato("Ficha", datos.paciente.numeroFicha)}
  ${dato("Edad", datos.paciente.edad)}
  ${dato("Sexo", datos.paciente.sexo)}
  ${dato("Comunidad", datos.paciente.comunidad)}
</section>
<section class="bloque">
  ${dato("Médico", datos.medico)}
  ${dato("Jornada", datos.jornada)}
  ${dato("Fecha de jornada", datos.fechaDeJornada ? formatearFechaCorta(datos.fechaDeJornada) : null)}
</section>
<section>
  <h2>Medicamentos</h2>
  ${medicamentos}
</section>
${
  datos.indicacionesGenerales
    ? `<section><h2>Indicaciones generales</h2><p>${escaparHtml(
        datos.indicacionesGenerales,
      )}</p></section>`
    : ""
}
<footer class="firma">
  <span class="linea"></span>
  <p>${escaparHtml(datos.medico ?? "Firma del medico")}</p>
</footer>
</body>
</html>`;
}
