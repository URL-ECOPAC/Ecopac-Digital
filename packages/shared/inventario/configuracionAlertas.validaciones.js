// Reglas de las antelaciones con que se avisa que un lote va a vencer (issue #899).
//
// Replican las de la migracion 00162: fn_umbrales_caducidad_validos() (el CHECK de
// configuracion_alertas_caducidad) y fn_etapa_caducidad(). Quien decide es la base; esto adelanta
// el mensaje en el formulario y deja que web y movil calculen la etapa igual que el servidor.

/**
 * Cuantas antelaciones se pueden configurar, ademas del aviso del dia del vencimiento. El minimo es
 * cero: sin ninguna, solo se avisa el dia que vence.
 */
export const MAXIMO_DE_UMBRALES = 4;

/** La antelacion mas larga que se admite, en dias. */
export const DIA_MAXIMO_DE_UMBRAL = 365;

/** Lo que trae la base si nadie la ha cambiado (DEFAULT '{90}' en la 00162). */
export const UMBRALES_POR_DEFECTO = Object.freeze([90]);

/**
 * Las antelaciones como enteros, sin vacios, de mayor a menor: el mismo orden en que las guarda
 * el trigger de la 00162.
 *
 * @param {(number|string|null)[]} umbrales
 * @returns {number[]}
 */
export function normalizarUmbrales(umbrales = []) {
  return umbrales
    .filter((valor) => valor !== null && valor !== undefined && String(valor).trim() !== "")
    .map((valor) => Number(valor))
    .sort((a, b) => b - a);
}

/**
 * Valida la lista del formulario. Devuelve un mensaje por renglon con problema (por indice) y uno
 * general, o null si todo esta bien.
 *
 * @param {(number|string|null)[]} umbrales Tal como estan en el formulario, sin ordenar.
 * @returns {{ general: string|null, porRenglon: Record<number, string> }|null}
 */
export function validarUmbrales(umbrales = []) {
  const porRenglon = {};
  let general = null;

  if (umbrales.length > MAXIMO_DE_UMBRALES) {
    general = `Se pueden configurar como máximo ${MAXIMO_DE_UMBRALES} antelaciones.`;
  }

  const vistos = new Map();
  umbrales.forEach((valor, indice) => {
    const texto = valor === null || valor === undefined ? "" : String(valor).trim();
    const numero = Number(texto);

    if (texto === "") {
      porRenglon[indice] = "Indica los días.";
    } else if (!Number.isInteger(numero) || numero < 1 || numero > DIA_MAXIMO_DE_UMBRAL) {
      porRenglon[indice] = `Debe ser un número entero entre 1 y ${DIA_MAXIMO_DE_UMBRAL}.`;
    } else if (vistos.has(numero)) {
      porRenglon[indice] = "Esta antelación ya está en la lista.";
    } else {
      vistos.set(numero, indice);
    }
  });

  if (!general && Object.keys(porRenglon).length === 0) return null;
  return { general, porRenglon };
}

/**
 * La ventana de aviso: la antelacion mas larga. Un lote mas lejos no genera alerta. Sin
 * antelaciones es 0: solo cuenta lo que vence hoy o ya vencio (mismo COALESCE que la 00162).
 *
 * @param {number[]} umbrales
 * @returns {number}
 */
export function ventanaDeAviso(umbrales = UMBRALES_POR_DEFECTO) {
  const validos = normalizarUmbrales(umbrales);
  return validos.length > 0 ? validos[0] : 0;
}

/**
 * Etapa de aviso de un lote, igual que fn_etapa_caducidad() (00162): 0 si vence hoy o ya vencio,
 * la antelacion mas corta que ya alcanzo, o null si esta fuera de la ventana.
 *
 * @param {number|null} diasRestantes
 * @param {number[]} umbrales
 * @returns {number|null}
 */
export function etapaDeVencimiento(diasRestantes, umbrales = UMBRALES_POR_DEFECTO) {
  if (diasRestantes === null || diasRestantes === undefined) return null;
  if (diasRestantes <= 0) return 0;
  const alcanzadas = normalizarUmbrales(umbrales).filter((umbral) => diasRestantes <= umbral);
  return alcanzadas.length > 0 ? alcanzadas[alcanzadas.length - 1] : null;
}

/**
 * Texto de una etapa para la interfaz.
 *
 * @param {number|null} etapa
 * @returns {string}
 */
export function describirEtapa(etapa) {
  if (etapa === null || etapa === undefined) return "Sin aviso todavía";
  if (etapa === 0) return "Día del vencimiento";
  return `${etapa} ${etapa === 1 ? "día" : "días"} antes`;
}

/**
 * Resumen de los avisos configurados, en una linea: "90 y 30 días antes, y el día que vence".
 *
 * @param {number[]} umbrales
 * @returns {string}
 */
export function resumenDeAvisos(umbrales = UMBRALES_POR_DEFECTO) {
  const lista = normalizarUmbrales(umbrales);
  if (lista.length === 0) return "Solo el día que vence";
  const dias =
    lista.length === 1
      ? String(lista[0])
      : `${lista.slice(0, -1).join(", ")} y ${lista[lista.length - 1]}`;
  const unidad = lista.length === 1 && lista[0] === 1 ? "día" : "días";
  return `${dias} ${unidad} antes, y el día que vence`;
}
