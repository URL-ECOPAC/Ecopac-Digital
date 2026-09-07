import { esTextoVacio, normalizarTexto } from "../validations/index.js";

/**
 * Normaliza los campos de texto de una comunidad.
 */
export function normalizarDatosComunidad(datos = {}) {
  const normalizados = { ...datos };

  if (Object.prototype.hasOwnProperty.call(datos, "nombre")) {
    normalizados.nombre = normalizarTexto(datos.nombre);
  }

  return normalizados;
}

/**
 * Valida los datos requeridos para la creación o edición de una comunidad.
 */
export function validarComunidad(datosObjeto = {}) {
  const datos = normalizarDatosComunidad(datosObjeto);
  const errores = {};

  if (esTextoVacio(datos.nombre)) {
    errores.nombre = "El nombre de la comunidad es requerido.";
  }

  if (!datos.municipio_id && !datos.municipioId) {
    errores.municipio_id = "El municipio es requerido.";
  }

  return errores;
}