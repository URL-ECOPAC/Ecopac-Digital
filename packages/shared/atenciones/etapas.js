// Etapas de la cola de pacientes de una jornada.
//
// Es un ESPEJO del CASE de vista_cola_jornada (migracion 00060), no una segunda fuente de
// verdad: quien decide la etapa de cada paciente es la base, mirando que filas existen. Este
// archivo sirve para que las pantallas agrupen y ordenen sin escribir las cadenas a mano.
//
// Las etapas nacen aqui y en ningun otro archivo del paquete. Es la regla que dejo el bug #365:
// un nombre exportado por el barril de shared solo puede tener un origen, porque `export *`
// excluye del namespace cualquier nombre ambiguo y el consumidor recibe undefined sin aviso.

import { aFechaLocal } from "../formato/fechas.js";

/**
 * Etapas del flujo de campo, en el orden en que un paciente las recorre.
 *
 * LISTA_PARA_CERRAR no es una etapa de espera: es la consulta que termino sin receta, o sea sin
 * nada que entregar. Aparece en la cola para que alguien la cierre; si no apareciera, esa
 * atencion quedaria abierta e invisible para siempre.
 */
export const ETAPAS_DE_COLA = Object.freeze({
  ESPERA_TRIAJE: "espera triaje",
  ESPERA_CONSULTA: "espera consulta",
  ESPERA_ENTREGA: "espera entrega",
  LISTA_PARA_CERRAR: "lista para cerrar",
});

/**
 * Las etapas en orden de flujo. Sirve para pintar los grupos siempre igual y para inicializar
 * la cola con todas las claves, incluidas las vacias: un grupo que desaparece cuando se queda
 * sin pacientes hace saltar la pantalla.
 */
export const ORDEN_DE_ETAPAS = Object.freeze([
  ETAPAS_DE_COLA.ESPERA_TRIAJE,
  ETAPAS_DE_COLA.ESPERA_CONSULTA,
  ETAPAS_DE_COLA.ESPERA_ENTREGA,
  ETAPAS_DE_COLA.LISTA_PARA_CERRAR,
]);

/** Nombre de cada etapa para mostrar en pantalla. */
export const NOMBRES_DE_ETAPA = Object.freeze({
  [ETAPAS_DE_COLA.ESPERA_TRIAJE]: "Espera triaje",
  [ETAPAS_DE_COLA.ESPERA_CONSULTA]: "Espera consulta",
  [ETAPAS_DE_COLA.ESPERA_ENTREGA]: "Espera entrega",
  [ETAPAS_DE_COLA.LISTA_PARA_CERRAR]: "Lista para cerrar",
});

/**
 * Cuanto lleva esperando el paciente en su etapa actual, en minutos.
 *
 * El "ahora" entra por parametro y no se lee del reloj aqui, por el mismo motivo que en
 * calcularEdad() de formato/fechas.js: una funcion que mira el reloj por su cuenta no se puede
 * probar sin que el resultado cambie de un momento a otro.
 *
 * La fecha se interpreta con aFechaLocal() y no con `new Date()` a secas: `new Date(null)` no
 * falla, devuelve el epoch, y un paciente apareceria esperando desde 1970.
 *
 * Nunca devuelve negativo. El reloj del dispositivo puede ir atrasado respecto del servidor, y
 * "-3 minutos esperando" en la pantalla es peor que cero.
 *
 * @param {string|Date} esperandoDesde Instante en que entro a la etapa.
 * @param {Date} [ahora] Momento de referencia.
 * @returns {number|null} Minutos, o null si la fecha no sirve.
 */
export function minutosEsperando(esperandoDesde, ahora = new Date()) {
  const desde = aFechaLocal(esperandoDesde);
  const referencia = aFechaLocal(ahora);
  if (desde === null || referencia === null) return null;

  return Math.max(0, Math.floor((referencia.getTime() - desde.getTime()) / 60000));
}
