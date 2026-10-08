// Formulario de una cita (issue #927). El paciente no es un campo del descriptor: se elige con el
// buscador de pacientes (useBusquedaPacientes), con alta en linea si no esta registrado.

import { TIPOS_DE_CAMPO } from "../descriptores.js";
import { DURACION_DE_CITA_MIN, hoyEnGuatemala, sumarMinutos } from "./horas.js";
import { LARGO_MAXIMO_NOTAS_DE_CITA } from "./validaciones.js";

export const CAMPOS_CITA = [
  {
    id: "jornadaId",
    label: "Jornada",
    tipo: TIPOS_DE_CAMPO.SELECT,
    opcionesDesde: "jornadas",
    // El nombre de la jornada con su fecha no cabe en un tercio del ancho.
    anchoCompleto: true,
    validacion: { requerido: true },
  },
  {
    id: "clinicaId",
    label: "Clínica",
    tipo: TIPOS_DE_CAMPO.SELECT,
    opcionesDesde: "clinicas",
    validacion: { requerido: true },
  },
  {
    id: "areaId",
    label: "Área de atención",
    tipo: TIPOS_DE_CAMPO.SELECT,
    opcionesDesde: "areasAtencion",
    validacion: { requerido: true },
  },
  {
    id: "profesionalId",
    label: "Profesional",
    tipo: TIPOS_DE_CAMPO.SELECT,
    opcionesDesde: "profesionales",
    ayuda: "Opcional. Médicos del cuadro de turnos de la jornada.",
  },
  {
    id: "fecha",
    label: "Fecha",
    tipo: TIPOS_DE_CAMPO.FECHA,
    validacion: { requerido: true },
  },
  {
    id: "horaInicio",
    label: "Hora de inicio",
    tipo: TIPOS_DE_CAMPO.HORA,
    validacion: { requerido: true },
  },
  {
    id: "horaFin",
    label: "Hora de fin",
    tipo: TIPOS_DE_CAMPO.HORA,
    validacion: { requerido: true },
  },
  {
    id: "notas",
    label: "Notas",
    tipo: TIPOS_DE_CAMPO.TEXTO_LARGO,
    validacion: { maxLongitud: LARGO_MAXIMO_NOTAS_DE_CITA },
  },
];

/** Los campos que se pueden cambiar en una cita atendida o cancelada (fn_validar_cita). */
export const CAMPOS_EDITABLES_SIN_AGENDA = Object.freeze(["notas"]);

/**
 * Los valores de una cita nueva: lo que se pide (el horario donde se hizo clic en la agenda, el
 * paciente de la ficha) y, si no, hoy a las 08:00, con fin a los 30 minutos.
 *
 * @param {{ pacienteId?: string, jornadaId?: string, fecha?: string, horaInicio?: string }} [inicial]
 * @returns {object}
 */
export function valoresDeCitaNueva(inicial = {}) {
  const horaInicio = inicial.horaInicio ?? "08:00";
  return {
    pacienteId: inicial.pacienteId ?? "",
    jornadaId: inicial.jornadaId ?? "",
    clinicaId: inicial.clinicaId ?? "",
    areaId: inicial.areaId ?? "",
    profesionalId: "",
    fecha: inicial.fecha ?? hoyEnGuatemala(),
    horaInicio,
    horaFin: sumarMinutos(horaInicio, DURACION_DE_CITA_MIN),
    notas: "",
  };
}

/**
 * Las opciones de jornada para agendar: "Nombre · 03/10/2026".
 *
 * @param {{ id: string, nombre: string, fecha: string }[]} jornadas
 * @returns {{ value: string, label: string }[]}
 */
export function opcionesDeJornadasParaAgendar(jornadas = []) {
  return jornadas.map((jornada) => {
    const [anio, mes, dia] = String(jornada.fecha ?? "").split("-");
    return {
      value: jornada.id,
      label: jornada.fecha ? `${jornada.nombre} · ${dia}/${mes}/${anio}` : jornada.nombre,
    };
  });
}

/**
 * Las opciones de profesional: los medicos del cuadro de turnos, con su turno.
 *
 * @param {{ id: string, nombre: string, horaInicio?: string|null, horaFin?: string|null }[]} profesionales
 * @returns {{ value: string, label: string }[]}
 */
export function opcionesDeProfesionales(profesionales = []) {
  return profesionales.map((profesional) => ({
    value: profesional.id,
    label:
      profesional.horaInicio && profesional.horaFin
        ? `${profesional.nombre} · ${profesional.horaInicio} - ${profesional.horaFin}`
        : profesional.nombre,
  }));
}
