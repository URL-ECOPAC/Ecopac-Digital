// Que puede hacer cada rol con los lotes de medicamentos.
//
// ESTO DECIDE QUE MUESTRA LA INTERFAZ, NO QUE PROTEGE EL SERVIDOR.
//
// Quien de verdad impide escribir es Row Level Security en la base de datos (politicas de
// INSERT/UPDATE de lotes en 00034_politicas_rls_inventario.sql, reescritas por la
// 00107_lotes_provisionales.sql). Por la misma razon, ninguna funcion de lotes.api.js consulta
// este archivo antes de llamar: el cliente pregunta para dibujar; el servidor decide.
//
// UN LOTE TIENE DOS FORMAS DE NACER (issue #625)
//
// La administradora da de alta lotes firmes. Un medico o un voluntario tambien pueden darlos de
// alta, pero **nacen provisionales** (`lotes.confirmado = FALSE`) y se vuelven firmes cuando ella
// aprueba el ingreso que los trajo. Por eso hay dos permisos y no uno: proponer y administrar no
// son el mismo acto.

import { esAdministrador, ROLES, ROLES_DE_CAMPO } from "../usuarios/roles.js";

/**
 * Puede administrar el catalogo de lotes: darlos de alta ya firmes y editar los que ya lo son.
 *
 * Espejo de la rama `es_administrador()` de las dos politicas de la 00107.
 */
export function puedeAdministrarLotes(rol) {
  return esAdministrador(rol);
}

/**
 * Puede dar de alta el lote que acompania a un ingreso.
 *
 * Para un rol de campo el lote nace provisional y solo lo puede corregir mientras siga asi; para
 * la administradora nace firme. Espejo de la politica de INSERT de la 00107.
 */
export function puedeProponerLote(rol) {
  return esAdministrador(rol) || ROLES_DE_CAMPO.includes(rol);
}

/**
 * Puede consultar lotes.
 *
 * La politica de SELECT de lotes es de lectura abierta para cualquier autenticado: cualquier rol
 * conocido puede ver el listado completo, provisionales incluidos -- quien registro uno tiene que
 * poder encontrarlo, y la administradora tiene que poder revisarlo antes de aprobar.
 */
export function puedeVerLotes(rol) {
  return Object.values(ROLES).includes(rol);
}

/**
 * Permisos de un rol, en la forma que consume una pantalla.
 *
 * `puedeCrear` responde "se le puede ofrecer el formulario de alta"; `puedeAdministrar`, "lo que
 * cree nace firme y ademas puede editar los ajenos". Sin `puedeEliminar`: no hay politica ni
 * GRANT de DELETE sobre lotes para nadie.
 */
export function permisosDeLotes(rol) {
  return {
    puedeVer: puedeVerLotes(rol),
    puedeCrear: puedeProponerLote(rol),
    puedeAdministrar: puedeAdministrarLotes(rol),
  };
}
