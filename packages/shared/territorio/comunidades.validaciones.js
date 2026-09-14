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

/** Un valor de coordenada "presente": no vacio, ni null ni undefined. */
function tieneValor(valor) {
  return valor !== undefined && valor !== null && valor !== "";
}

/**
 * Valida los datos requeridos para la creación o edición de una comunidad.
 *
 * `latitud`/`longitud` son opcionales -no toda comunidad rural tiene coordenadas capturadas-,
 * pero si una llega la otra tiene que llegar tambien: un punto en el mapa no existe a medias.
 * Fuera de ese rango (-90..90 / -180..180) no es una coordenada real, sea cual sea su origen.
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

  const hayLatitud = tieneValor(datos.latitud);
  const hayLongitud = tieneValor(datos.longitud);

  if (hayLatitud !== hayLongitud) {
    errores.ubicacion = "Selecciona un punto completo en el mapa: falta la latitud o la longitud.";
  } else if (hayLatitud && hayLongitud) {
    const latitud = Number(datos.latitud);
    const longitud = Number(datos.longitud);

    if (Number.isNaN(latitud) || latitud < -90 || latitud > 90) {
      errores.latitud = "La latitud debe estar entre -90 y 90.";
    }
    if (Number.isNaN(longitud) || longitud < -180 || longitud > 180) {
      errores.longitud = "La longitud debe estar entre -180 y 180.";
    }
  }

  return errores;
}
