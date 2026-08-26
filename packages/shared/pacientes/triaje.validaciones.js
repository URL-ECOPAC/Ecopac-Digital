// Reglas de negocio del triaje (signos vitales).
//
// ESTE ARCHIVO ES DELIBERADAMENTE DELGADO, Y CONVIENE SABER POR QUE.
//
// La validacion clinica de los signos vitales es la issue #118, de AnderNoleon: rangos
// fisiologicamente imposibles que se rechazan frente a rangos alarmantes que se aceptan con
// advertencia, ajuste por edad -- pediatrico y adulto -- y la coherencia de que la sistolica sea
// mayor que la diastolica. Nada de eso se escribe aqui: seria adelantarse a una issue que ya
// tiene dueno, igual que la #194 no invadio la #307.
//
// Lo que si aplica esta issue (#117) es la capa de descriptores: que los tres signos obligatorios
// esten presentes. `CAMPOS_TRIAJE` ademas declara min y max espejo de los CHECK de la 00013, pero
// validarConDescriptores() no los evalua -- solo mira obligatoriedad y longitudes -- y **hacerlo
// aqui seria justamente el criterio de aceptacion 1 de la #118**. Mientras esa issue no exista,
// un valor fuera de rango lo rechaza la base con un 23514 que normalizarError() traduce a CHECK.
//
// Cuando #118 se escriba, este es el archivo donde engancha: validarTriaje() combina su
// resultado con combinarErrores(), sin que triaje.api.js se entere.

import { CAMPOS_TRIAJE } from "./campos.js";
import { validarConDescriptores } from "../validations/index.js";

/**
 * Valida los signos vitales antes de mandarlos al servidor.
 *
 * Los signos parciales son un requisito de campo, no una concesion: en algunas comunidades no hay
 * glucometro ni bascula. `CAMPOS_TRIAJE` ya reparte que es obligatorio -- presion sistolica,
 * diastolica y frecuencia cardiaca -- y que es opcional -- glucosa, peso, talla y temperatura --,
 * y ese reparto es el mismo que impone la tabla triajes (00013) con sus NOT NULL. Esta funcion no
 * decide nada por su cuenta: lee el descriptor.
 *
 * @param {object} valores Valores indexados por el id de CAMPOS_TRIAJE.
 * @returns {Record<string, string>} Errores por campo. Vacio si todo esta bien.
 */
export function validarTriaje(valores) {
  return validarConDescriptores(CAMPOS_TRIAJE, valores);
}

/**
 * Valida una correccion parcial: solo los campos que vienen en el objeto.
 *
 * En un UPDATE, los signos obligatorios que no se estan cambiando ya estan en la fila y no
 * viajan. Aplicar validarTriaje() tal cual pediria una presion que nadie quiso tocar.
 *
 * Lo que si se conserva es la obligatoriedad de lo que SI viene: mandar `presionSistolica: ""`
 * es un intento de vaciar una columna NOT NULL, y eso se rechaza aqui en vez de dejar que la
 * base devuelva un 23502.
 *
 * @param {object} valores Solo los campos a cambiar, indexados por el id de CAMPOS_TRIAJE.
 * @returns {Record<string, string>} Errores por campo.
 */
export function validarCambioDeTriaje(valores = {}) {
  const enviados = CAMPOS_TRIAJE.filter((campo) =>
    Object.prototype.hasOwnProperty.call(valores, campo.id),
  );

  return validarConDescriptores(enviados, valores);
}

/**
 * Los signos que la tabla admite vacios.
 *
 * Se deriva de CAMPOS_TRIAJE en vez de escribirse a mano: si alguien cambia la obligatoriedad de
 * un campo en el descriptor y aqui hubiera una lista suelta, las dos se separarian sin aviso.
 */
export const SIGNOS_OPCIONALES = Object.freeze(
  CAMPOS_TRIAJE.filter((campo) => !campo.validacion?.requerido).map((campo) => campo.id),
);
