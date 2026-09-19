// Permisos de la bitacora de auditoria (issue #643).
//
// Esto es solo para la UI -mostrar u ocultar el enlace del menu-, no la autorizacion real: quien
// protege de verdad es la politica RLS "Solo administrador lee eventos_auditoria" de la
// migracion 00026. Mismo disclaimer que el resto de los permisos.js de modulo.

import { esAdministrador } from "../usuarios/roles.js";

/** Si `rol` puede ver la bitacora de auditoria. */
export function puedeVerBitacoraAuditoria(rol) {
  return esAdministrador(rol);
}
