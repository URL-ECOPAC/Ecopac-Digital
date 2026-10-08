// Modulo de citas de la logica compartida (issue #927): clinicas y agenda de citas.
//
// Estructura estandar de un modulo (ver docs/ARQUITECTURA-FRONTEND.md). Las clinicas van con
// prefijo `clinicas.` porque son un catalogo propio dentro del modulo.

export * from "./clinicas.api.js";
export * from "./clinicas.campos.js";
export * from "./clinicas.columnas.js";
export * from "./clinicas.filtros.js";
export * from "./clinicas.permisos.js";
export * from "./clinicas.validaciones.js";
export * from "./useCatalogoClinicas.js";

// Agenda de citas.
export * from "./agenda.js";
export * from "./api.js";
export * from "./campos.js";
export * from "./columnas.js";
export * from "./estados.js";
export * from "./filtros.js";
export * from "./horas.js";
export * from "./permisos.js";
export * from "./useAgendaCitas.js";
export * from "./useCambioEstadoCita.js";
export * from "./useCitasDelPaciente.js";
export * from "./useFormularioCita.js";
export * from "./validaciones.js";
