// Que puede hacer cada rol con la cola de atenciones.
//
// ESTO DECIDE QUE MUESTRA LA INTERFAZ, NO QUE PROTEGE EL SERVIDOR.
//
// Mismo criterio que jornadas/permisos.js: un boton escondido no es seguridad. Quien de verdad
// impide escribir son las politicas RLS de atenciones (migracion 00033). Aqui se replica el rol
// que esas politicas piden, para no ofrecer una accion que el servidor va a rechazar.

import { esAdministrador, ROLES } from "../usuarios/roles.js";

/**
 * Puede registrar la llegada de un paciente a la jornada.
 *
 * Espejo de la politica de INSERT de 00033, que admite administrador, medico y voluntario
 * general: registrar en la mesa de entrada es lo primero del flujo de campo y no lo hace solo
 * el personal medico.
 */
export function puedeIniciarAtencion(rol) {
  return esAdministrador(rol) || rol === ROLES.MEDICO || rol === ROLES.VOLUNTARIO;
}

/**
 * Puede retirar una atencion de la cola.
 *
 * Espejo de la politica de UPDATE de 00033, mas restrictiva que la de INSERT: solo
 * administrador y medico. Es coherente con quien entrega, porque receta_detalle tambien es de
 * esos dos roles: quien cierra el flujo es quien lo termina.
 *
 * Un voluntario registra pacientes y toma triaje, pero no decide que una atencion termino.
 */
export function puedeCerrarAtencion(rol) {
  return esAdministrador(rol) || rol === ROLES.MEDICO;
}

/**
 * Puede ver la cola de la jornada.
 *
 * Cualquier rol conocido: que filas devuelve la vista lo acota su propio WHERE (00060), que
 * limita a quien participa en la jornada mas la administradora. Esta funcion no lo replica
 * porque el cliente no sabe en que jornadas esta asignada la persona sin preguntar.
 */
export function puedeVerCola(rol) {
  return Object.values(ROLES).includes(rol);
}
