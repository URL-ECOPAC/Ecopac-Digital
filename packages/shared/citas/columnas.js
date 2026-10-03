// Que se muestra de una cita (issue #927): en la lista de citas del paciente y en el detalle.

import { TIPOS_DE_PRESENTACION } from "../descriptores.js";
import { OPCIONES_ESTADO_CITA } from "./estados.js";
import { formatearFechaHoraDeCita, horaEnGuatemala } from "./horas.js";

/** Estado de la cita: `value` es el del enum y tambien la clave de statusColors. */
export const ESTADOS_CITA_PARA_CHIP = OPCIONES_ESTADO_CITA.map((opcion) => ({
  ...opcion,
  clave: opcion.value,
}));

/** Una cita en la lista de citas del paciente. */
export const COLUMNAS_CITAS_DEL_PACIENTE = [
  { id: "cuando", label: "Fecha y hora", tipo: TIPOS_DE_PRESENTACION.TEXTO, principal: true },
  { id: "area", label: "Área", tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: "clinica", label: "Clínica", tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: "profesional", label: "Profesional", tipo: TIPOS_DE_PRESENTACION.TEXTO },
  {
    id: "estado",
    label: "Estado",
    tipo: TIPOS_DE_PRESENTACION.ESTADO,
    etiquetasDesde: "estadoCita",
  },
];

/** Los datos del detalle de una cita, en orden. */
export const CAMPOS_DETALLE_CITA = [
  { id: "paciente", label: "Paciente" },
  { id: "cuando", label: "Fecha y hora" },
  { id: "jornada", label: "Jornada" },
  { id: "clinica", label: "Clínica" },
  { id: "area", label: "Área de atención" },
  { id: "profesional", label: "Profesional" },
  { id: "notas", label: "Notas" },
  { id: "motivoCancelacion", label: "Motivo de cancelación" },
];

/**
 * Una cita lista para dibujar: los textos de fecha y hora en Guatemala, y "Sin asignar" en el
 * profesional que falta.
 *
 * @param {object} cita
 * @returns {object}
 */
export function filaDeCita(cita) {
  if (!cita) return null;
  return {
    ...cita,
    cuando: `${formatearFechaHoraDeCita(cita.iniciaEn)} - ${horaEnGuatemala(cita.terminaEn)}`,
    profesional: cita.profesional ?? "Sin asignar",
  };
}

/**
 * El detalle de una cita como pares rotulo-valor, sin los que no tienen dato.
 *
 * @param {object} cita
 * @returns {{ id: string, label: string, valor: string }[]}
 */
export function detalleDeCita(cita) {
  const fila = filaDeCita(cita);
  if (!fila) return [];
  return CAMPOS_DETALLE_CITA.map((campo) => ({ ...campo, valor: fila[campo.id] })).filter(
    (campo) => campo.valor !== null && campo.valor !== undefined && campo.valor !== "",
  );
}
