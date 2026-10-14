import { calcularEdad, formatearFechaCorta } from "../formato/fechas.js";
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
