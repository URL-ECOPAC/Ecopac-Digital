// Que puede hacer cada rol con las condiciones cronicas de un paciente.
//
// ESTO DECIDE QUE MUESTRA LA INTERFAZ, NO QUE PROTEGE EL SERVIDOR.
//
// Mismo criterio que atenciones/permisos.js: un boton escondido no es seguridad. Quien de verdad
// impide leer o escribir son las cuatro politicas RLS de padecimientos_cronicos (migracion
// 00010). Aqui se replica el rol que esas politicas piden, para no ofrecer una accion que el
// servidor va a rechazar con un 42501.

import { esAdministrador, ROLES, TODOS_LOS_ROLES } from "../usuarios/roles.js";

/**
 * Puede ver las condiciones cronicas de un paciente.
 *
 * Espejo de la politica de SELECT de 00010, que admite solo administrador y medico. Es la
 * politica mas cerrada del modulo de pacientes: un voluntario general registra pacientes y toma
 * triaje, pero el diagnostico cronico es informacion clinica y no la ve. Para el, la consulta no
 * falla: devuelve cero filas.
 */
export function puedeVerCondiciones(rol) {
  return esAdministrador(rol) || rol === ROLES.MEDICO;
}

/**
 * Puede asociar una condicion cronica a un paciente.
 *
 * Espejo de la politica de INSERT de 00010: administrador y medico.
 */
export function puedeRegistrarCondicion(rol) {
  return esAdministrador(rol) || rol === ROLES.MEDICO;
}

/**
 * Puede corregir una condicion ya registrada o darla de baja.
 *
 * Espejo de la politica de UPDATE de 00010: administrador y medico. Cubre tanto
 * actualizarCondicion() como desasociarCondicion(), porque la baja es un cambio de estado y no
 * un borrado: las dos son el mismo UPDATE para la base de datos.
 */
export function puedeEditarCondicion(rol) {
  return esAdministrador(rol) || rol === ROLES.MEDICO;
}

/**
 * Puede borrar fisicamente el registro de una condicion.
 *
 * Espejo de la politica de DELETE de 00010, mas estrecha que las otras tres: **solo
 * administrador**, ni siquiera el medico. Es deliberado y esta documentado en
 * docs/PERMISOS.md:82: en las tablas clinicas la baja es logica, y padecimientos_cronicos es la
 * unica que admite borrado fisico. Existe para corregir un alta equivocada, no para dar de alta
 * a un paciente de su condicion; para eso esta desasociarCondicion().
 */
export function puedeQuitarCondicion(rol) {
  return esAdministrador(rol);
}

/**
 * Puede leer el catalogo de condiciones.
 *
 * Cualquier rol conocido: la politica de condiciones_cronicas es `FOR SELECT USING (true)` y el
 * GRANT alcanza a authenticated. El catalogo no dice nada de ningun paciente.
 */
export function puedeVerCatalogoDeCondiciones(rol) {
  return TODOS_LOS_ROLES.includes(rol);
}
