import {
  combinarErrores,
  esTextoVacio,
  normalizarTexto,
  validarConDescriptores,
} from "../validations/index.js";
import { CAMPOS_CONDICION_CRONICA } from "./condiciones.campos.js";
import { ESTADOS_CONDICION_CRONICA } from "../enums.js";
import { aFechaLocal } from "../formato/fechas.js";

const ESTADOS_VALIDOS = Object.values(ESTADOS_CONDICION_CRONICA);

/**
 * Recorta los textos sobrantes antes de validar y de enviar.
 *
 * `notas` vacio viaja como NULL: la columna es nullable y borrar la nota es una accion legitima.
 *
 * `estado` vacio NO viaja. El formulario arranca con todos sus campos en cadena vacia
 * (`useCondicionesPaciente`), y `estado` es opcional justamente porque la columna tiene
 * `DEFAULT 'activa'` (00010) -- lo dice el comentario de CAMPOS_CONDICION_CRONICA--. Pero una
 * cadena vacia no es "no lo mando": es un valor, y PostgREST intenta convertirla al enum
 * `estado_condicion_cronica` y devuelve 400. Resultado: agregar una condicion sin tocar el
 * desplegable de estado fallaba siempre, con "Ocurrio un error inesperado" y sin decir que campo
 * era. Quitando la clave, la columna aplica su DEFAULT, que es lo que el descriptor ya prometia.
 *
 * Es deliberado que no se sustituya por 'activa' aqui: el valor por defecto vive en la migracion,
 * y repetirlo en el cliente es la clase de duplicado que se desincroniza sin que nadie lo note.
 */
export function normalizarDatosCondicion(datos = {}) {
  const normalizados = { ...datos };

  if (Object.prototype.hasOwnProperty.call(datos, "notas")) {
    normalizados.notas = esTextoVacio(datos.notas) ? null : normalizarTexto(datos.notas);
  }

  if (Object.prototype.hasOwnProperty.call(datos, "estado") && esTextoVacio(datos.estado)) {
    delete normalizados.estado;
  }

  return normalizados;
}

/**
 * Reglas que no puede expresar el descriptor de campos.
 */
function erroresDeNegocioCondicion(datos, hoy) {
  const errores = {};

  if (!esTextoVacio(datos.fechaDiagnostico)) {
    // aFechaLocal(): la columna es DATE, y new Date("AAAA-MM-DD") la lee en UTC (issue #840).
    const fecha = aFechaLocal(datos.fechaDiagnostico);

    if (fecha === null) {
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
