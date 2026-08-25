// Que puede hacer cada rol con el catalogo de medicamentos.
//
// ESTO DECIDE QUE MUESTRA LA INTERFAZ, NO QUE PROTEGE EL SERVIDOR.
//
// Quien de verdad impide escribir es Row Level Security en la base de datos (politicas de
// INSERT/UPDATE de medicamentos en 00034_politicas_rls_inventario.sql; el GRANT EXECUTE de las
// funciones de registro y desactivacion en 00050_catalogo_medicamentos.sql). Por la misma
// razon, ninguna funcion de medicamentos.api.js consulta este archivo antes de llamar: el
// cliente pregunta para dibujar; el servidor decide.

import { esAdministrador, ROLES } from "../usuarios/roles.js";

/**
 * Puede crear, editar o desactivar medicamentos del catalogo.
 *
 * Espejo de puedeAdministrarPrincipiosActivos: las politicas de escritura de medicamentos
 * (00034) exigen unicamente es_administrador(), sin el permiso fino que si existe en jornadas
 * (jornadas.gestionar).
 */
export function puedeAdministrarMedicamentos(rol) {
  return esAdministrador(rol);
}

/**
 * Puede ver el catalogo.
 *
 * La politica de SELECT de medicamentos es de lectura abierta para cualquier autenticado
 * (USING (true)): cualquier rol conocido puede ver el listado completo.
 */
export function puedeVerMedicamentos(rol) {
  return Object.values(ROLES).includes(rol);
}

/**
 * Permisos de un rol, en la forma que consume una pantalla.
 *
 * Se devuelven juntos para que un hook no tenga que llamar a las funciones sueltas ni acordarse
 * de cuales existen. `puedeEliminar` gatea la accion de desactivar: medicamentos no tiene
 * DELETE fisico ni politica de DELETE (00034), a diferencia de principios_activos.
 */
export function permisosDeMedicamentos(rol) {
  const puedeAdministrar = puedeAdministrarMedicamentos(rol);

  return {
    puedeVer: puedeVerMedicamentos(rol),
    puedeCrear: puedeAdministrar,
    puedeEditar: puedeAdministrar,
    puedeEliminar: puedeAdministrar,
  };
}
