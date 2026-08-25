// Que puede hacer cada rol con el catalogo de principios activos.
//
// ESTO DECIDE QUE MUESTRA LA INTERFAZ, NO QUE PROTEGE EL SERVIDOR.
//
// Quien de verdad impide escribir es Row Level Security en la base de datos
// (politica de INSERT en 00034_politicas_rls_inventario.sql; las de UPDATE y DELETE
// se agregaron en 00046_catalogo_principios_activos.sql). Por la misma razon,
// ninguna funcion de principios-activos.api.js consulta este archivo antes de
// llamar: el cliente pregunta para dibujar; el servidor decide.

import { esAdministrador, ROLES } from "../usuarios/roles.js";

/**
 * Puede crear, editar o eliminar principios activos del catalogo.
 *
 * Espejo exacto de las tres politicas de escritura de principios_activos: las tres
 * exigen unicamente es_administrador(), sin el permiso fino que si existe en
 * jornadas (jornadas.gestionar). Aqui no hay excepcion que el cliente deba dejar
 * pasar.
 */
export function puedeAdministrarPrincipiosActivos(rol) {
  return esAdministrador(rol);
}

/**
 * Puede ver el catalogo.
 *
 * La politica de SELECT de principios_activos es de lectura abierta para cualquier
 * autenticado (USING (true)): a diferencia de jornadas, aqui no hay filas que un rol
 * vea y otro no, asi que cualquier rol conocido puede ver el listado completo.
 */
export function puedeVerPrincipiosActivos(rol) {
  return Object.values(ROLES).includes(rol);
}

/**
 * Permisos de un rol, en la forma que consume una pantalla.
 *
 * Se devuelven juntos para que un hook no tenga que llamar a las funciones sueltas
 * ni acordarse de cuales existen.
 */
export function permisosDePrincipiosActivos(rol) {
  const puedeAdministrar = puedeAdministrarPrincipiosActivos(rol);

  return {
    puedeVer: puedeVerPrincipiosActivos(rol),
    puedeCrear: puedeAdministrar,
    puedeEditar: puedeAdministrar,
    puedeEliminar: puedeAdministrar,
  };
}
