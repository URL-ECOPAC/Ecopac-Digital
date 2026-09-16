import { esAdministrador } from "../usuarios/roles.js";

export function puedeCrearComunidad(rol) {
  return esAdministrador(rol);
}

export function puedeEditarComunidad(rol) {
  return esAdministrador(rol);
}

// La pantalla de catalogo (issue #756) es de administracion, no de consulta: quien necesita
// leer comunidades para un selector en cascada (registro de paciente, jornada) sigue usando
// listarComunidades() directo, que la politica "Sesion activa lee comunidades" (00079) deja
// abierto a cualquier sesion activa. Esta puerta es solo para la pantalla de alta/edicion.
export function puedeVerCatalogoComunidades(rol) {
  return esAdministrador(rol);
}
