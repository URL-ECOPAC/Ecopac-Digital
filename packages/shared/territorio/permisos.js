import { esAdministrador, ROLES_DE_CAMPO } from "../usuarios/roles.js";

// Comunidades: desde la 00148 el personal de campo las crea y corrige -una comunidad que falta se
// descubre en jornada, con el paciente delante-. Retirarla (es_vigente = false) es lo mas parecido a
// eliminarla y sigue siendo de la administradora. Nadie tiene DELETE.

function esPersonalDeCampo(rol) {
  return ROLES_DE_CAMPO.includes(rol);
}

/**
 * @param {string} rol Valor de `ROLES`.
 * @returns {boolean} Administrador y personal de campo (00148).
 */
export function puedeCrearComunidad(rol) {
  return esAdministrador(rol) || esPersonalDeCampo(rol);
}

/**
 * @param {string} rol Valor de `ROLES`.
 * @returns {boolean} Administrador y personal de campo (00148).
 */
export function puedeEditarComunidad(rol) {
  return esAdministrador(rol) || esPersonalDeCampo(rol);
}

/**
 * @param {string} rol Valor de `ROLES`.
 * @returns {boolean} Solo el administrador: trigger impedir_retirar_sin_ser_administrador (00148).
 */
export function puedeRetirarComunidad(rol) {
  return esAdministrador(rol);
}

/**
 * Si un rol entra a la pantalla de catalogo de comunidades (issue #756). Desde la 00148 tambien el
 * personal de campo, que ahora las mantiene. Quien solo necesita leer comunidades para un selector
 * en cascada usa `listarComunidades()`, que la politica "Sesion activa lee comunidades" (00079) abre
 * a cualquier sesion activa.
 *
 * @param {string} rol Valor de `ROLES`.
 * @returns {boolean}
 */
export function puedeVerCatalogoComunidades(rol) {
  return esAdministrador(rol) || esPersonalDeCampo(rol);
}
