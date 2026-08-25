import {
  validarConDescriptores,
  combinarErrores,
  normalizarTexto,
  esTextoVacio,
} from "../validations/index.js";
import { CAMPOS_PACIENTE } from "./campos.js";

const REGEX_DPI = /^\d{13}$/;
const EDAD_MAXIMA_ANOS = 120;

/**
 * Normaliza los datos de paciente eliminando espacios sobrantes.
 */
export function normalizarDatosPaciente(datos = {}) {
  return {
    ...datos,
    nombres: normalizarTexto(datos.nombres).replace(/\s+/g, " "),
    apellidos: normalizarTexto(datos.apellidos).replace(/\s+/g, " "),
    comunidad: normalizarTexto(datos.comunidad).replace(/\s+/g, " "),
    dpi: esTextoVacio(datos.dpi) ? null : normalizarTexto(datos.dpi),
  };
}

/**
 * Aplica las reglas de negocio y descriptores para validar un paciente.
 * @param {object} datosObjeto
 * @returns {Record<string, string>} Errores agrupados por campo.
 */
export function validarPaciente(datosObjeto) {
  const datos = normalizarDatosPaciente(datosObjeto);

  // 1. Validaciones estructurales de descriptores
  const erroresDescriptores = validarConDescriptores(CAMPOS_PACIENTE, datos);

  // 2. Reglas de negocio específicas
  const erroresNegocio = {};

  // Validar Fecha de Nacimiento
  if (!esTextoVacio(datos.fechaNacimiento)) {
    const fecha = new Date(datos.fechaNacimiento);
    const ahora = new Date();

    if (isNaN(fecha.getTime())) {
      erroresNegocio.fechaNacimiento = "Fecha de nacimiento no válida.";
    } else if (fecha > ahora) {
      erroresNegocio.fechaNacimiento = "La fecha de nacimiento no puede ser futura.";
    } else {
      const fechaLimiteEdad = new Date();
      fechaLimiteEdad.setFullYear(ahora.getFullYear() - EDAD_MAXIMA_ANOS);

      if (fecha < fechaLimiteEdad) {
        erroresNegocio.fechaNacimiento = `La edad no puede ser mayor a ${EDAD_MAXIMA_ANOS} años.`;
      }
    }
  }

  // Validar DPI (Opcional, pero si existe debe ser de 13 dígitos)
  if (datos.dpi !== null && !REGEX_DPI.test(datos.dpi)) {
    erroresNegocio.dpi = "El DPI debe contener exactamente 13 dígitos numéricos.";
  }

  // 3. Combinar prioridad de errores
  return combinarErrores(erroresDescriptores, erroresNegocio);
}