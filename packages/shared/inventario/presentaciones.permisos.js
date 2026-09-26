// Que puede hacer cada rol con el catalogo de presentaciones.
//
// ESTO DECIDE QUE MUESTRA LA INTERFAZ, NO QUE PROTEGE EL SERVIDOR.
//
// Quien de verdad impide escribir es Row Level Security en la base de datos
// (00144_presentaciones_catalogo.sql: SELECT abierto, INSERT/UPDATE/DELETE solo
// administrador, mismo patron que principios_activos). Por la misma razon, ninguna
// funcion de presentaciones.api.js consulta este archivo antes de llamar: el
// cliente pregunta para dibujar; el servidor decide.

import { esAdministrador, ROLES, ROLES_DE_CAMPO } from "../usuarios/roles.js";

/**
 * Puede crear o editar presentaciones del catalogo.
 *
 * Espejo de las politicas de INSERT y UPDATE de la 00148: administrador y personal de campo.
 * Eliminar no: la politica de DELETE (00144) sigue siendo solo de la administradora.
 */
export function puedeAdministrarPresentaciones(rol) {
  return esAdministrador(rol) || ROLES_DE_CAMPO.includes(rol);
}

/**
 * Puede ver el catalogo.
 *
 * La politica de SELECT de presentaciones es de lectura abierta para cualquier
 * autenticado (USING (true)): a diferencia de jornadas, aqui no hay filas que un rol
 * vea y otro no, asi que cualquier rol conocido puede ver el listado completo.
 */
export function puedeVerPresentaciones(rol) {
  return Object.values(ROLES).includes(rol);
}

/**
 * Permisos de un rol, en la forma que consume una pantalla.
 *
 * Se devuelven juntos para que un hook no tenga que llamar a las funciones sueltas
 * ni acordarse de cuales existen.
 */
export function permisosDePresentaciones(rol) {
  const puedeAdministrar = puedeAdministrarPresentaciones(rol);

  return {
    puedeVer: puedeVerPresentaciones(rol),
    puedeCrear: puedeAdministrar,
    puedeEditar: puedeAdministrar,
    puedeEliminar: esAdministrador(rol),
  };
}
