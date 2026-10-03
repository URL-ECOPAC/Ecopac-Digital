// Que puede hacer cada rol con la agenda de citas (issue #927, 00184).
//
// ESTO DECIDE QUE MUESTRA LA INTERFAZ, NO QUE PROTEGE EL SERVIDOR: quien protege son las politicas
// de citas y fn_validar_cita (00184), y la RLS de consultas para guardar la consulta de la cita.
// La pertenencia a la jornada (pertenece_a_jornada) no se replica: la base filtra las citas que se
// ven y rechaza las que no se pueden escribir.

import { puedeAdministrarJornadas } from "../jornadas/permisos.js";
import { esAdministrador, esConsultivo, ROLES, ROLES_DE_CAMPO } from "../usuarios/roles.js";
import { ESTADOS_CITA, puedePasarCitaA } from "./estados.js";

/**
 * Puede ver la agenda: todos salvo la junta directiva y los socios fundadores, que no leen datos
 * de pacientes (docs/PROTECCION-DE-DATOS.md). El boton Citas no les aparece.
 *
 * @param {string} rol
 * @returns {boolean}
 */
export function puedeVerCitas(rol) {
  return Boolean(rol) && !esConsultivo(rol);
}

/**
 * Puede agendar, editar y cancelar: la administradora, quien tiene jornadas.gestionar y el personal
 * de campo (medico y voluntario) de la jornada.
 *
 * @param {string} rol
 * @returns {boolean}
 */
export function puedeAgendarCitas(rol) {
  return puedeAdministrarJornadas(rol) || ROLES_DE_CAMPO.includes(rol);
}

/**
 * Puede abrir una cita con Atender. La administradora siempre; el profesional de la cita; si no
 * tiene profesional, cualquier medico de la jornada. El voluntario tambien la abre, para tomar los
 * signos: la consulta no la guarda (RLS de consultas).
 *
 * @param {string} rol
 * @param {{ estado: string, profesionalId?: string|null }} cita
 * @param {string|null} perfilId
 * @returns {boolean}
 */
export function puedeAtenderCita(rol, cita, perfilId) {
  // Creada, o en atencion: se cerro el formulario sin guardar y se vuelve a abrir.
  const abrible = cita?.estado === ESTADOS_CITA.CREADA || cita?.estado === ESTADOS_CITA.EN_ATENCION;
  if (!abrible) return false;
  if (esAdministrador(rol)) return true;
  if (rol === ROLES.VOLUNTARIO) return true;
  if (rol !== ROLES.MEDICO) return false;
  return !cita.profesionalId || cita.profesionalId === perfilId;
}

/**
 * Puede cancelar la cita: quien agenda, mientras este creada o en atencion.
 *
 * @param {string} rol
 * @param {{ estado: string }} cita
 * @returns {boolean}
 */
export function puedeCancelarCita(rol, cita) {
  return puedeAgendarCitas(rol) && puedePasarCitaA(cita?.estado, ESTADOS_CITA.CANCELADA);
}

/**
 * Puede regresar a creada una cita que se abrio por error.
 *
 * @param {string} rol
 * @param {{ estado: string }} cita
 * @returns {boolean}
 */
export function puedeRegresarCitaACreada(rol, cita) {
  return puedeAgendarCitas(rol) && cita?.estado === ESTADOS_CITA.EN_ATENCION;
}

/**
 * Puede editar la cita: toda la agenda si esta creada; de una atendida o cancelada, solo las
 * notas (fn_validar_cita). En atencion no se reagenda.
 *
 * @param {string} rol
 * @param {{ estado: string }} cita
 * @returns {{ agenda: boolean, notas: boolean }}
 */
export function edicionDeCita(rol, cita) {
  const puede = puedeAgendarCitas(rol) && Boolean(cita);
  return {
    agenda: puede && cita.estado === ESTADOS_CITA.CREADA,
    notas: puede,
  };
}
