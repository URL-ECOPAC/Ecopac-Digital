// Que puede hacer cada rol con los lotes de medicamentos.
//
// ESTO DECIDE QUE MUESTRA LA INTERFAZ, NO QUE PROTEGE EL SERVIDOR.
//
// Quien de verdad impide escribir es Row Level Security en la base de datos (politicas de
// INSERT/UPDATE de lotes en 00034_politicas_rls_inventario.sql, solo administrador). Por la
// misma razon, ninguna funcion de lotes.api.js consulta este archivo antes de llamar: el
// cliente pregunta para dibujar; el servidor decide.

import { esAdministrador, ROLES } from "../usuarios/roles.js";

/**
 * Puede registrar lotes.
 *
 * Espejo de puedeAdministrarMedicamentos: la politica de INSERT de lotes (00034) exige
 * unicamente es_administrador().
 */
export function puedeAdministrarLotes(rol) {
  return esAdministrador(rol);
}

/**
 * Puede consultar lotes.
 *
 * La politica de SELECT de lotes es de lectura abierta para cualquier autenticado
 * (USING (true)): cualquier rol conocido puede ver el listado completo.
 */
export function puedeVerLotes(rol) {
  return Object.values(ROLES).includes(rol);
}

/**
 * Permisos de un rol, en la forma que consume una pantalla.
 *
 * Sin `puedeEditar` ni `puedeEliminar`: lotes.api.js todavia no expone actualizar ni eliminar un
 * lote, esta issue solo cubre registrar y consultar.
 */
export function permisosDeLotes(rol) {
  return {
    puedeVer: puedeVerLotes(rol),
    puedeCrear: puedeAdministrarLotes(rol),
  };
}
