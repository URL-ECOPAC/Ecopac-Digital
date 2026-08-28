// Reglas de negocio de las condiciones cronicas (issue #122).
//
// Solo lo que se puede comprobar sin preguntarle al servidor. Lo que depende del estado de la
// base de datos no se valida aqui:
//   - que la condicion no este ya registrada en el paciente lo impide UNIQUE (paciente_id,
//     condicion_id) de la migracion 00010, y condiciones.api.js traduce el 23505 que devuelve;
//   - quien puede escribir lo deciden las politicas RLS, no el cliente.

import {
  combinarErrores,
  esTextoVacio,
  normalizarTexto,
  validarConDescriptores,
} from "../validations/index.js";
import { CAMPOS_CONDICION_CRONICA, ESTADOS_CONDICION_CRONICA } from "./condiciones.campos.js";

const ESTADOS_VALIDOS = Object.values(ESTADOS_CONDICION_CRONICA);

/**
 * Recorta los textos sobrantes antes de validar y de enviar.
 *
 * `notas` solo se toca si venia en el objeto. No es un detalle: actualizarCondicion() arma el
 * UPDATE con las claves presentes, asi que anadir `notas: null` a todo lo que pase por aqui
 * borraria las notas clinicas del paciente cada vez que alguien cambiara solo el estado -y
 * desasociarCondicion(), que hace exactamente eso, las borraria siempre-.
 */
export function normalizarDatosCondicion(datos = {}) {
  const normalizados = { ...datos };

  if (Object.prototype.hasOwnProperty.call(datos, "notas")) {
    // Vacio es null y no cadena vacia: la columna es nullable y "" guardaria un dato que no hay.
    normalizados.notas = esTextoVacio(datos.notas) ? null : normalizarTexto(datos.notas);
  }

  return normalizados;
}

/**
 * Reglas que no puede expresar el descriptor de campos.
 *
 * La fecha de diagnostico no puede ser futura por el mismo motivo que la de nacimiento en
 * validaciones.js: es un hecho ya ocurrido. La base no lo comprueba -no hay CHECK en la 00010-,
 * asi que si no se valida aqui no lo valida nadie.
 *
 * @param {object} datos Ya normalizados.
 * @param {Date} hoy Inyectable para que la prueba no dependa del reloj.
 * @returns {Record<string, string>}
 */
function erroresDeNegocioCondicion(datos, hoy) {
  const errores = {};

  if (!esTextoVacio(datos.fechaDiagnostico)) {
    const fecha = new Date(datos.fechaDiagnostico);

    if (Number.isNaN(fecha.getTime())) {
      errores.fechaDiagnostico = "Fecha de diagnostico no valida.";
    } else if (fecha > hoy) {
      errores.fechaDiagnostico = "La fecha de diagnostico no puede ser futura.";
    }
  }

  // El estado es opcional: la columna tiene DEFAULT 'activa'. Pero si viene, tiene que ser uno
  // de los tres del enum, o el INSERT falla en la base con un error que no dice nada util.
  if (!esTextoVacio(datos.estado) && !ESTADOS_VALIDOS.includes(datos.estado)) {
    errores.estado = "El estado tiene que ser activa, controlada o resuelta.";
  }

  return errores;
}

/**
 * Valida el formulario de alta de una condicion cronica (CAMPOS_CONDICION_CRONICA).
 *
 * @param {object} datosObjeto Valores indexados por el id del campo.
 * @param {Date} hoy Fecha de referencia; por defecto, ahora.
 * @returns {Record<string, string>} Errores agrupados por campo.
 */
export function validarCondicionCronica(datosObjeto, hoy = new Date()) {
  const datos = normalizarDatosCondicion(datosObjeto);
  const erroresDescriptores = validarConDescriptores(CAMPOS_CONDICION_CRONICA, datos);
  const erroresNegocio = erroresDeNegocioCondicion(datos, hoy);
  return combinarErrores(erroresDescriptores, erroresNegocio);
}

/**
 * Valida una correccion parcial de una condicion ya registrada.
 *
 * A diferencia del alta, aqui no se exige la condicion ni la fecha: actualizarCondicion() manda
 * solo lo que cambia. Lo que si se comprueba es que lo enviado sea valido.
 *
 * @param {object} datosObjeto Solo los campos que se van a cambiar.
 * @param {Date} hoy Fecha de referencia; por defecto, ahora.
 * @returns {Record<string, string>} Errores agrupados por campo.
 */
export function validarCambioDeCondicion(datosObjeto, hoy = new Date()) {
  const datos = normalizarDatosCondicion(datosObjeto);
  return erroresDeNegocioCondicion(datos, hoy);
}
