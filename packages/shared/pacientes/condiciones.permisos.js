// Que puede hacer cada rol con las condiciones cronicas de un paciente.
//
// ESTO DECIDE QUE MUESTRA LA INTERFAZ, NO QUE PROTEGE EL SERVIDOR.
//
// Mismo criterio que atenciones/permisos.js: un boton escondido no es seguridad. Quien de verdad
// impide leer o escribir son las cuatro politicas RLS de padecimientos_cronicos (migracion
// 00010) y, para el catalogo, las de condiciones_cronicas (00079 para leer, 00140 para escribir).
// Aqui se replica el rol que esas politicas piden, para no ofrecer una accion que el servidor va
// a rechazar con un 42501.

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
 * Cualquier rol conocido: la politica de SELECT de condiciones_cronicas es
 * `USING (rol_actual() IS NOT NULL)` desde la 00079 -la `USING (true)` de la 00010 se retiro alli-
 * y el GRANT alcanza a authenticated. El catalogo no dice nada de ningun paciente.
 */
export function puedeVerCatalogoDeCondiciones(rol) {
  return TODOS_LOS_ROLES.includes(rol);
}

/**
 * Puede dar de alta una condicion en el catalogo (issue #850).
 *
 * Espejo de la politica de INSERT de la 00140: administrador, medico y voluntario general. Los
 * tres roles que atienden, porque una condicion que falta se descubre en jornada, con el paciente
 * delante, y esperar a que la administracion la de de alta pierde el dato.
 *
 * Los dos roles consultivos -junta directiva y socio fundador- quedan fuera: desde la 00054 no
 * tocan ninguna fila clinica, y este catalogo lo es.
 *
 * OJO con el voluntario general: puede dar de alta en el catalogo, pero no vera el resultado en
 * la ficha de ningun paciente, porque padecimientos_cronicos (00010) no tiene ninguna politica
 * para su rol, ni de SELECT. Para el, el unico camino es la pantalla de catalogo. Esta asimetria
 * esta documentada en docs/PERMISOS.md; no es un olvido de esta funcion.
 */
export function puedeCrearCondicionDelCatalogo(rol) {
  return esAdministrador(rol) || rol === ROLES.MEDICO || rol === ROLES.VOLUNTARIO;
}

/**
 * Puede renombrar una condicion del catalogo o retirarla con `es_vigente` (issue #850).
 *
 * Espejo de la politica de UPDATE de la 00140, mas estrecha que la de INSERT a proposito: solo
 * administrador. Dar de alta y retirar no son la misma accion. Retirar quita la condicion del
 * selector de TODAS las fichas, y renombrarla reescribe lo que ya citan expedientes ajenos: eso
 * es curaduria del catalogo, no captura en jornada.
 */
export function puedeMantenerCatalogoCondiciones(rol) {
  return esAdministrador(rol);
}
