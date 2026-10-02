// Validacion del formulario de alta y edicion de un articulo del catalogo (medicamento o insumo).
//
// QUE ESTABA MAL (issue #911). La pantalla mandaba el formulario tal cual y, con un campo
// obligatorio vacio, la base lo rechazaba y solo se veia "Ocurrio un error inesperado", sin decir
// que faltaba. Ahora cada campo vacio se marca debajo del suyo antes de llamar al servidor, como en
// el resto de los formularios.
//
// Las claves del objeto de errores son las del formulario de la pantalla (InventarioPage), para que
// cada mensaje caiga debajo de su campo sin traducir nada.

import { esTextoVacio } from "../validations/index.js";
import { pideDatosFarmacologicos } from "./campos.js";

/**
 * Valida un articulo del catalogo antes de guardarlo. Un insumo no lleva principio activo ni
 * concentracion (00164): solo se piden a un medicamento.
 *
 * @param {{ nombre?: string, tipoArticulo?: string, principio_activo_id?: string,
 *   concentracion?: string, presentacionId?: string, marca?: string }} [datos]
 * @returns {Record<string, string>} Errores por campo. Vacio si todo esta bien.
 */
export function validarMedicamentoDelCatalogo(datos = {}) {
  const errores = {};

  if (esTextoVacio(datos.nombre)) errores.nombre = "El nombre comercial es obligatorio.";
  if (esTextoVacio(datos.tipoArticulo)) errores.tipoArticulo = "Elige el tipo de artículo.";

  if (pideDatosFarmacologicos(datos.tipoArticulo)) {
    if (esTextoVacio(datos.principio_activo_id)) {
      errores.principio_activo_id = "Elige el principio activo.";
    }
    if (esTextoVacio(datos.concentracion)) {
      errores.concentracion = "La concentración es obligatoria.";
    }
  }

  if (esTextoVacio(datos.presentacionId)) errores.presentacionId = "Elige una presentación.";
  if (esTextoVacio(datos.marca)) errores.marca = "La marca o laboratorio es obligatoria.";

  return errores;
}
