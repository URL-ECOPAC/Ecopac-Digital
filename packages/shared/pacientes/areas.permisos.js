// Que puede hacer cada rol con las areas de atencion (issue #927, 00182).
//
// ESTO DECIDE QUE MUESTRA LA INTERFAZ, NO QUE PROTEGE EL SERVIDOR. Quien protege son las politicas
// de areas_atencion y paciente_area (00182); aqui se replica el rol que piden, para no ofrecer una
// accion que la base va a rechazar.

import { esAdministrador, TODOS_LOS_ROLES } from "../usuarios/roles.js";
import { puedeEditarPaciente } from "./permisos.js";

/**
 * Puede ver el catalogo de areas: toda sesion activa (politica de SELECT, 00182).
 *
 * @param {string} rol
 * @returns {boolean}
 */
export function puedeVerCatalogoDeAreas(rol) {
  return TODOS_LOS_ROLES.includes(rol);
}

/**
 * Puede crear, editar, retirar y reactivar areas: solo la administradora (politicas de INSERT y
 * UPDATE y el trigger de retiro, 00182). Un area nueva es una decision de la organizacion, no algo
 * que se descubre en jornada.
 *
 * @param {string} rol
 * @returns {boolean}
 */
export function puedeGestionarCatalogoDeAreas(rol) {
  return esAdministrador(rol);
}

/**
 * Puede asignar o quitar areas a un paciente ya registrado: quien puede editar pacientes (politica
 * de paciente_area, 00182). Quien registro al paciente tambien puede, pero eso lo decide la base
 * con pacientes.registrado_por: el cliente no lo sabe sin preguntar, y al registrar las areas viajan
 * con el alta.
 *
 * @param {string} rol
 * @returns {boolean}
 */
export function puedeAsignarAreasAPaciente(rol) {
  return puedeEditarPaciente(rol);
}
