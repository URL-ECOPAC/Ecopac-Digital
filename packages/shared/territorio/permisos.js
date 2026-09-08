import { esAdministrador } from "../usuarios/roles.js";

export function puedeCrearComunidad(rol) {
  return esAdministrador(rol);
}

export function puedeEditarComunidad(rol) {
  return esAdministrador(rol);
}
