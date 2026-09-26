// Que puede hacer cada rol con las condiciones cronicas de un paciente.
//
// ESTO DECIDE QUE MUESTRA LA INTERFAZ, NO QUE PROTEGE EL SERVIDOR.
//
// Mismo criterio que atenciones/permisos.js: un boton escondido no es seguridad. Quien de verdad
// impide leer o escribir son las cuatro politicas RLS de padecimientos_cronicos (migracion
// 00010) y, para el catalogo, las de condiciones_cronicas (00079 para leer, 00140 para escribir).
// Aqui se replica el rol que esas politicas piden, para no ofrecer una accion que el servidor va
// a rechazar con un 42501.

import { accedeAModuloPorMatriz } from "../usuarios/acceso.js";
import { esAdministrador, ROLES_DE_CAMPO, TODOS_LOS_ROLES } from "../usuarios/roles.js";

function esPersonalDeCampo(rol) {
  return ROLES_DE_CAMPO.includes(rol);
}

/**
 * Puede ver las condiciones cronicas de un paciente.
 *
 * Espejo de la politica de SELECT de padecimientos_cronicos (00148): administrador, personal de
 * campo, y el rol al que la matriz le abrio Pacientes. El colaborador entra desde la 00148, que le
 * abre pacientes por completo.
 */
export function puedeVerCondiciones(rol) {
  return esAdministrador(rol) || esPersonalDeCampo(rol) || accedeAModuloPorMatriz(rol, "pacientes");
}

/**
 * Puede asociar una condicion cronica a un paciente.
 *
 * Espejo de la politica de INSERT (00148): administrador y personal de campo.
 */
export function puedeRegistrarCondicion(rol) {
  return esAdministrador(rol) || esPersonalDeCampo(rol);
}

/**
 * Puede corregir una condicion ya registrada o darla de alta al paciente (resuelta).
 *
 * Espejo de la politica de UPDATE (00148): administrador y personal de campo. Cubre tanto
 * actualizarCondicion() como desasociarCondicion(), porque la baja es un cambio de estado y no
 * un borrado: las dos son el mismo UPDATE para la base de datos.
 */
export function puedeEditarCondicion(rol) {
  return esAdministrador(rol) || esPersonalDeCampo(rol);
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
 */
export function puedeCrearCondicionDelCatalogo(rol) {
  return esAdministrador(rol) || esPersonalDeCampo(rol);
}

/**
 * Puede renombrar una condicion del catalogo o reactivar una retirada.
 *
 * Espejo de la politica de UPDATE (00148): administrador y personal de campo. Retirarla
 * (es_vigente = false) no: la quita del selector de TODAS las fichas, que es lo mas parecido a
 * eliminarla, y queda en puedeRetirarCondicionDelCatalogo().
 */
export function puedeMantenerCatalogoCondiciones(rol) {
  return esAdministrador(rol) || esPersonalDeCampo(rol);
}

/**
 * Puede retirar una condicion del catalogo (es_vigente = false). Solo la administradora: trigger
 * impedir_retirar_sin_ser_administrador (00148).
 */
export function puedeRetirarCondicionDelCatalogo(rol) {
  return esAdministrador(rol);
}
