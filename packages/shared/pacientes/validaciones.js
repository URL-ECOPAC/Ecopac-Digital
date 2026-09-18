import {
  validarConDescriptores,
  combinarErrores,
  normalizarTexto,
  esTextoVacio,
} from "../validations/index.js";
import { SEXOS } from "../enums.js";
import { CAMPOS_REGISTRO_PACIENTE } from "./campos.js";
import { aFechaLocal } from "../formato/fechas.js";

const REGEX_DPI = /^\d{13}$/;
/** Los valores del enum sexo_paciente (00132). Espejo, no segunda fuente. */
const VALORES_DE_SEXO = Object.values(SEXOS);
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
 * Son independientes del descriptor de campos que decide que es "requerido". Hasta la #699 las
 * compartian dos validadores; ahora solo queda validarRegistroPaciente(), y se mantienen aparte
 * porque no son reglas del descriptor sino del dominio.
 *
 * @param {object} datos Ya normalizados (normalizarDatosPaciente()).
 * @returns {Record<string, string>}
 */
function erroresDeNegocioPaciente(datos) {
  const erroresNegocio = {};

  // Validar Fecha de Nacimiento
  //
  // issue #694: usaba new Date(datos.fechaNacimiento), que interpreta una cadena AAAA-MM-DD
  // como medianoche UTC. En Guatemala (UTC-6) eso corre la fecha de nacimiento un dia.
  // aFechaLocal() (formato/fechas.js) la lee como dia de calendario, sin ese desplazamiento.
  if (!esTextoVacio(datos.fechaNacimiento)) {
    const fecha = aFechaLocal(datos.fechaNacimiento);
    const ahora = new Date();

    if (!fecha) {
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

  // El sexo, contra el enum (issue #699). Antes no se comprobaba en ningun sitio: la columna era un
  // VARCHAR sin CHECK, asi que un valor fuera del vocabulario -de una pantalla vieja, de un import,
  // de una prueba- se guardaba tal cual y despues no aparecia en ningun desglose. Desde la 00132 la
  // base lo rechaza con un 22P02, que no dice nada util; esto lo dice antes y sobre el campo.
  if (!esTextoVacio(datos.sexo) && !VALORES_DE_SEXO.includes(datos.sexo)) {
    erroresNegocio.sexo = `Sexo no valido. Los valores son: ${VALORES_DE_SEXO.join(", ")}.`;
  }

  return erroresNegocio;
}

// validarPaciente() se borro en la #699. Validaba contra CAMPOS_PACIENTE -cinco campos de los
// once- y no lo llamaba ninguna pantalla: el registro y la edicion usan el validador de abajo, y
// actualizarPaciente() tambien. Lo unico que lo mantenia vivo eran sus propias pruebas, que ahora
// cubren el que si se usa.

/**
 * Valida el formulario de paciente (CAMPOS_REGISTRO_PACIENTE, campos.js): los once campos del
 * registro, y los mismos que ofrece la edicion desde la #818. Exige sexo e idioma (NOT NULL en
 * pacientes, 00009); telefonoContacto es opcional desde la 00130. numeroFicha no esta en este
 * formulario: lo genera fn_registrar_paciente del lado del servidor (migraciones 00057, 00081,
 * 00110), no lo escribe quien registra.
 * @param {object} datosObjeto
 * @returns {Record<string, string>} Errores agrupados por campo.
 */
export function validarRegistroPaciente(datosObjeto) {
  const datos = normalizarDatosPaciente(datosObjeto);
  const erroresDescriptores = validarConDescriptores(CAMPOS_REGISTRO_PACIENTE, datos);
  const erroresNegocio = erroresDeNegocioPaciente(datos);
  return combinarErrores(erroresDescriptores, erroresNegocio);
}
function claveDeNombre(nombres, apellidos) {
  return [nombres, apellidos]
    .map((parte) => normalizarTexto(parte))
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function advertirPacienteDuplicado({ pacientes, nombres, apellidos, fechaNacimiento } = {}) {
  if (esTextoVacio(fechaNacimiento)) return null;

  const clave = claveDeNombre(nombres, apellidos);
  if (!clave) return null;

  const coincidencias = (pacientes ?? []).filter(
    (paciente) =>
      paciente?.fechaNacimiento === fechaNacimiento &&
      claveDeNombre(paciente?.nombres, paciente?.apellidos) === clave,
  );

  if (coincidencias.length === 0) return null;

  const fichas = coincidencias
    .map((paciente) => paciente.expediente?.numeroFicha ?? paciente.numeroFicha)
    .filter(Boolean)
    .join(", ");

  return fichas
    ? `Ya existe un paciente con ese nombre y fecha de nacimiento: ficha ${fichas}. Revisa antes de crear un expediente nuevo.`
    : "Ya existe un paciente con ese nombre y fecha de nacimiento. Revisa antes de crear un expediente nuevo.";
}
