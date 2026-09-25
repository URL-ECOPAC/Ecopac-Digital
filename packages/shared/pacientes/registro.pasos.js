import { CAMPOS_REGISTRO_PACIENTE } from "./campos.js";

export const PASOS_REGISTRO_PACIENTE = Object.freeze([
  {
    id: "identidad",
    titulo: "Identidad",
    campos: ["nombres", "apellidos", "fechaNacimiento", "sexo"],
  },
  {
    id: "ubicacion",
    titulo: "Ubicación y contacto",
    campos: ["comunidad", "telefonoContacto", "idioma"],
  },
  { id: "documentos", titulo: "Documentos y salud", campos: ["dpi", "tipoSangre"] },
  {
    id: "responsable",
    titulo: "Persona responsable",
    campos: ["nombreResponsable", "parentescoResponsable"],
  },
]);

/**
 * Los descriptores de campo de un paso del registro de paciente, en el orden del paso.
 *
 * @param {{ campos: string[] }} paso Paso de `PASOS_REGISTRO_PACIENTE`.
 * @returns {object[]} Descriptores de `CAMPOS_REGISTRO_PACIENTE`; los ids que no existen se omiten.
 */
export function camposDePaso(paso) {
  return paso.campos
    .map((id) => CAMPOS_REGISTRO_PACIENTE.find((campo) => campo.id === id))
    .filter(Boolean);
}

/**
 * Los pasos del registro de paciente con sus descriptores de campo ya resueltos.
 *
 * @returns {object[]} Cada paso de `PASOS_REGISTRO_PACIENTE` con `campos` como descriptores.
 */
export function pasosConCampos() {
  return PASOS_REGISTRO_PACIENTE.map((paso) => ({ ...paso, campos: camposDePaso(paso) }));
}

/**
 * Que pasos del registro tienen al menos un campo con error, para marcarlos en el indicador.
 *
 * @param {Record<string, string>} [errores] Errores por id de campo.
 * @returns {string[]} Ids de los pasos con error.
 */
export function pasosConError(errores = {}) {
  const ids = Object.keys(errores);
  return PASOS_REGISTRO_PACIENTE.filter((paso) => paso.campos.some((id) => ids.includes(id))).map(
    (paso) => paso.id,
  );
}
