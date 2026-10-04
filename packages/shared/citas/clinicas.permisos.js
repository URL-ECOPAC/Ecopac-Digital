// Que puede hacer cada rol con las clinicas (issue #927, 00183).
//
// ESTO DECIDE QUE MUESTRA LA INTERFAZ, NO QUE PROTEGE EL SERVIDOR: quien protege son las politicas
// de clinicas, el trigger de retiro y fn_eliminar_clinica (00183).

import { puedeAdministrarJornadas } from "../jornadas/permisos.js";
import { esAdministrador, TODOS_LOS_ROLES } from "../usuarios/roles.js";

/**
 * Puede ver el catalogo de clinicas: toda sesion activa.
 *
 * @param {string} rol
 * @returns {boolean}
 */
export function puedeVerCatalogoDeClinicas(rol) {
  return TODOS_LOS_ROLES.includes(rol);
}

/**
 * Puede crear y editar clinicas: la administradora y quien tiene jornadas.gestionar.
 *
 * @param {string} rol
 * @returns {boolean}
 */
export function puedeMantenerClinicas(rol) {
  return puedeAdministrarJornadas(rol);
}

/**
 * Puede retirar, reactivar y eliminar clinicas: solo la administradora.
 *
 * @param {string} rol
 * @returns {boolean}
 */
export function puedeRetirarClinicas(rol) {
  return esAdministrador(rol);
}
