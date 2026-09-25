import { esAdministrador } from "../usuarios/roles.js";

/**
 * @param {string} rol Valor de `ROLES`.
 * @returns {boolean} Solo el administrador.
 */
export function puedeCrearComunidad(rol) {
  return esAdministrador(rol);
}

/**
 * @param {string} rol Valor de `ROLES`.
 * @returns {boolean} Solo el administrador.
 */
export function puedeEditarComunidad(rol) {
  return esAdministrador(rol);
}

/**
 * Si un rol entra a la pantalla de catalogo de comunidades (issue #756), que es de administracion.
 * Quien solo necesita leer comunidades para un selector en cascada usa `listarComunidades()`, que la
 * politica "Sesion activa lee comunidades" (00079) abre a cualquier sesion activa.
 *
 * @param {string} rol Valor de `ROLES`.
 * @returns {boolean} Solo el administrador.
 */
export function puedeVerCatalogoComunidades(rol) {
  return esAdministrador(rol);
}
