import {
  validarConDescriptores,
  combinarErrores,
  normalizarTexto,
  esTextoVacio,
} from "../validations/index.js";
import { CAMPOS_PACIENTE, CAMPOS_REGISTRO_PACIENTE } from "./campos.js";

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
 * Reglas de negocio sobre fecha de nacimiento y DPI, comunes a cualquier formulario de paciente.
 * Son independientes del descriptor de campos que decide que es "requerido": validarPaciente()
 * (CAMPOS_PACIENTE) y validarRegistroPaciente() (CAMPOS_REGISTRO_PACIENTE) las comparten sin
 * repetirlas.
 *
 * @param {object} datos Ya normalizados (normalizarDatosPaciente()).
 * @returns {Record<string, string>}
 */
function erroresDeNegocioPaciente(datos) {
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

  return erroresNegocio;
}

/**
 * Aplica las reglas de negocio y descriptores para validar un paciente contra CAMPOS_PACIENTE
 * (issue #112): nombres, apellidos, fecha de nacimiento, DPI y comunidad.
 * @param {object} datosObjeto
 * @returns {Record<string, string>} Errores agrupados por campo.
 */
export function validarPaciente(datosObjeto) {
  const datos = normalizarDatosPaciente(datosObjeto);
  const erroresDescriptores = validarConDescriptores(CAMPOS_PACIENTE, datos);
  const erroresNegocio = erroresDeNegocioPaciente(datos);
  return combinarErrores(erroresDescriptores, erroresNegocio);
}

/**
 * Valida el formulario completo de registro de un paciente nuevo (CAMPOS_REGISTRO_PACIENTE,
 * campos.js): ademas de lo que ya cubre validarPaciente(), exige sexo, telefonoContacto e
 * idioma (NOT NULL en pacientes, 00009). numeroFicha no esta en este formulario: lo genera
 * fn_registrar_paciente del lado del servidor (migraciones 00057, 00078), no lo escribe quien
 * registra. Mismas reglas de negocio que validarPaciente(): la fecha de nacimiento y el DPI no
 * cambian segun el formulario.
 * @param {object} datosObjeto
 * @returns {Record<string, string>} Errores agrupados por campo.
 */
export function validarRegistroPaciente(datosObjeto) {
  const datos = normalizarDatosPaciente(datosObjeto);
  const erroresDescriptores = validarConDescriptores(CAMPOS_REGISTRO_PACIENTE, datos);
  const erroresNegocio = erroresDeNegocioPaciente(datos);
  return combinarErrores(erroresDescriptores, erroresNegocio);
}