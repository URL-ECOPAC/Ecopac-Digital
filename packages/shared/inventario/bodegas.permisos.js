// Que puede hacer cada rol con las bodegas y con los proveedores.
//
// ESTO DECIDE QUE MUESTRA LA INTERFAZ, NO QUE PROTEGE EL SERVIDOR.
//
// Quien de verdad impide escribir es Row Level Security (politicas de bodegas y proveedores en
// 00034_politicas_rls_inventario.sql, endurecidas por la 00079_desactivacion_perfiles_rls.sql). Por la misma razon, ninguna funcion de
// bodegas.api.js ni de proveedores.api.js consulta este archivo antes de llamar: el cliente
// pregunta para dibujar; el servidor decide.
//
// Los dos catalogos comparten archivo porque comparten exactamente las mismas politicas y se
// administran desde la misma pantalla de configuracion de inventario.

import { esAdministrador, ROLES } from "../usuarios/roles.js";

/**
 * Puede crear o editar bodegas.
 *
 * La politica "Solo Administrador puede modificar bodegas" (00034) es FOR ALL y exige que el
 * perfil de auth.uid() tenga rol 'administrador'.
 */
export function puedeAdministrarBodegas(rol) {
  return esAdministrador(rol);
}

/**
 * Puede consultar bodegas.
 *
 * "Lectura de bodegas para usuarios autenticados" (00034) exige que rol_actual() IS NOT NULL:
 * cualquier rol conocido activo ve el listado completo.
 */
export function puedeVerBodegas(rol) {
  return Object.values(ROLES).includes(rol);
}

/** Espejo de puedeAdministrarBodegas: la politica de proveedores de la 00034 es identica. */
export function puedeAdministrarProveedores(rol) {
  return esAdministrador(rol);
}

/** Espejo de puedeVerBodegas. */
export function puedeVerProveedores(rol) {
  return Object.values(ROLES).includes(rol);
}

/**
 * Permisos de un rol sobre bodegas, en la forma que consume una pantalla.
 *
 * Sin `puedeEliminar`: bodegas.api.js no expone borrar una bodega, y borrarla dejaria colgadas
 * las existencias que la referencian (existencias.bodega_id es ON DELETE RESTRICT, 00020).
 */
export function permisosDeBodegas(rol) {
  return {
    puedeVer: puedeVerBodegas(rol),
    puedeCrear: puedeAdministrarBodegas(rol),
    puedeEditar: puedeAdministrarBodegas(rol),
  };
}

/** Permisos de un rol sobre proveedores, en la forma que consume una pantalla. */
export function permisosDeProveedores(rol) {
  return {
    puedeVer: puedeVerProveedores(rol),
    puedeCrear: puedeAdministrarProveedores(rol),
    puedeEditar: puedeAdministrarProveedores(rol),
  };
}