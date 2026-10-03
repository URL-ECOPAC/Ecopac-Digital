// Filtros de la agenda de citas (issue #927): jornada, clinica, area, profesional y estado. "Mis
// citas" no es un filtro del descriptor: es un atajo del medico que fija el profesional.

import { TIPOS_DE_FILTRO } from "../descriptores.js";

export const FILTROS_AGENDA_CITAS = [
  { id: "jornadaId", tipo: TIPOS_DE_FILTRO.SELECT, label: "Jornada", opcionesDesde: "jornadas" },
  { id: "clinicaId", tipo: TIPOS_DE_FILTRO.SELECT, label: "Clínica", opcionesDesde: "clinicas" },
  {
    id: "areaId",
    tipo: TIPOS_DE_FILTRO.SELECT,
    label: "Área de atención",
    opcionesDesde: "areasAtencion",
  },
  {
    id: "profesionalId",
    tipo: TIPOS_DE_FILTRO.SELECT,
    label: "Profesional",
    opcionesDesde: "profesionales",
  },
  { id: "estado", tipo: TIPOS_DE_FILTRO.SELECT, label: "Estado", opcionesDesde: "estadoCita" },
];

export const FILTROS_AGENDA_CITAS_VACIOS = {
  jornadaId: "",
  clinicaId: "",
  areaId: "",
  profesionalId: "",
  estado: "",
};

/**
 * Las citas que pasan los filtros. La agenda trae las del rango sin filtrar en la base -las
 * necesita todas para contar las salas libres de la clinica- y filtra aqui.
 *
 * @param {object[]} citas
 * @param {typeof FILTROS_AGENDA_CITAS_VACIOS} filtros
 * @returns {object[]}
 */
export function filtrarCitas(citas = [], filtros = FILTROS_AGENDA_CITAS_VACIOS) {
  return citas.filter((cita) =>
    Object.keys(FILTROS_AGENDA_CITAS_VACIOS).every(
      (clave) => !filtros[clave] || cita[clave] === filtros[clave],
    ),
  );
}
