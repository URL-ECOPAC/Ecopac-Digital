import {
  combinarErrores,
  esTextoVacio,
  normalizarTexto,
  validarConDescriptores,
} from "../validations/index.js";
import { CAMPOS_CONDICION_CRONICA } from "./condiciones.campos.js";
import { ESTADOS_CONDICION_CRONICA } from "../enums.js";

const ESTADOS_VALIDOS = Object.values(ESTADOS_CONDICION_CRONICA);

/**
 * Recorta los textos sobrantes antes de validar y de enviar.
 */
export function normalizarDatosCondicion(datos = {}) {
  const normalizados = { ...datos };

  if (Object.prototype.hasOwnProperty.call(datos, "notas")) {
    normalizados.notas = esTextoVacio(datos.notas) ? null : normalizarTexto(datos.notas);
  }

  return normalizados;
}

/**
 * Reglas que no puede expresar el descriptor de campos.
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

  if (!esTextoVacio(datos.estado) && !ESTADOS_VALIDOS.includes(datos.estado)) {
    errores.estado = "El estado tiene que ser activa, controlada o resuelta.";
  }

  return errores;
}

/**
 * Valida el formulario de alta de una condición crónica.
 */
export function validarCondicionCronica(datosObjeto, hoy = new Date()) {
  const datos = normalizarDatosCondicion(datosObjeto);
  const erroresDescriptores = validarConDescriptores(CAMPOS_CONDICION_CRONICA, datos);
  const erroresNegocio = erroresDeNegocioCondicion(datos, hoy);
  return combinarErrores(erroresDescriptores, erroresNegocio);
}

/**
 * Valida una corrección parcial de una condición ya registrada.
 */
export function validarCambioDeCondicion(datosObjeto, hoy = new Date()) {
  const datos = normalizarDatosCondicion(datosObjeto);
  return erroresDeNegocioCondicion(datos, hoy);
}

/**
 * Valida el nombre al crear o editar una condición en el catálogo.
 */
export function validarCondicionCatalogo(datos = {}) {
  const errores = {};
  const nombre = normalizarTexto(datos.nombre);

  if (esTextoVacio(nombre)) {
    errores.nombre = "El nombre de la condicion es requerido.";
  }

  return errores;
}