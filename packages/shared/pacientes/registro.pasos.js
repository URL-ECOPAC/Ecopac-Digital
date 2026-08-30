import { CAMPOS_REGISTRO_PACIENTE } from "./campos.js";

export const PASOS_REGISTRO_PACIENTE = Object.freeze([
  {
    id: "identidad",
    titulo: "Identidad",
    campos: ["nombres", "apellidos", "fechaNacimiento", "sexo"],
  },
  { id: "ubicacion", titulo: "Ubicacion y contacto", campos: ["comunidad", "telefonoContacto", "idioma"] },
  { id: "documentos", titulo: "Documentos y salud", campos: ["dpi", "tipoSangre"] },
  {
    id: "responsable",
    titulo: "Persona responsable",
    campos: ["nombreResponsable", "parentescoResponsable"],
  },
]);

export function camposDePaso(paso) {
  return paso.campos
    .map((id) => CAMPOS_REGISTRO_PACIENTE.find((campo) => campo.id === id))
    .filter(Boolean);
}

export function pasosConCampos() {
  return PASOS_REGISTRO_PACIENTE.map((paso) => ({ ...paso, campos: camposDePaso(paso) }));
}

export function pasosConError(errores = {}) {
  const ids = Object.keys(errores);
  return PASOS_REGISTRO_PACIENTE.filter((paso) => paso.campos.some((id) => ids.includes(id))).map(
    (paso) => paso.id,
  );
}
