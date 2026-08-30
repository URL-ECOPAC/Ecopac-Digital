// Que puede hacer cada rol con los gastos de una jornada.
//
// ESTO DECIDE QUE MUESTRA LA INTERFAZ, NO QUE PROTEGE EL SERVIDOR.
//
// Quien de verdad decide es Row Level Security: las politicas de gastos de
// 00052_politicas_rls_gastos.sql. Este archivo replica esa matriz para que la pantalla no ofrezca
// botones que el servidor va a rechazar; ninguna funcion de presupuestos/api.js lo consulta antes
// de llamar.
//
// El modulo no tenia permisos.js: era el unico archivo de la estructura estandar que faltaba
// (ver el encabezado de presupuestos/index.js).

import { esAdministrador, ROLES, ROLES_CONSULTIVOS } from "../usuarios/roles.js";
import { ESTADOS_DE_GASTO } from "../enums.js";

/**
 * Puede ver la bandeja de gastos completa.
 *
 * La politica de SELECT (00052) deja leer todo a administrador, junta directiva y socio fundador.
 * El personal de campo tambien lee, pero solo los gastos de las jornadas en las que participa, y
 * eso no se puede saber desde el rol: lo filtra participa_en_jornada() en el servidor. Por eso
 * `puedeVerTodosLosGastos` es lo que gobierna la pantalla global, y el listado por jornada se
 * dibuja para cualquier rol conocido.
 */
export function puedeVerTodosLosGastos(rol) {
  return esAdministrador(rol) || ROLES_CONSULTIVOS.includes(rol);
}

/** Cualquier rol conocido ve los gastos de una jornada; RLS recorta las filas que no le tocan. */
export function puedeVerGastosDeJornada(rol) {
  return Object.values(ROLES).includes(rol);
}

/**
 * Puede registrar un gasto.
 *
 * La politica de INSERT admite a administrador, a quien tenga el permiso presupuestos.registrar, y
 * al personal asignado a la jornada. Los roles consultivos quedan fuera: leen sin modificar.
 */
export function puedeRegistrarGasto(rol) {
  return esAdministrador(rol) || [ROLES.MEDICO, ROLES.VOLUNTARIO].includes(rol);
}

/**
 * Puede aprobar o rechazar un gasto.
 *
 * Solo administrador o quien tenga presupuestos.aprobar (sembrado en 00037). El permiso fino no se
 * puede resolver desde el rol, asi que aqui se cubre el caso por rol y el resto lo decide el
 * servidor.
 */
export function puedeAprobarGasto(rol) {
  return esAdministrador(rol);
}

/**
 * Puede editar un gasto concreto.
 *
 * tr_bloquear_gasto_finalizado (00052) deja inmutable cualquier gasto que ya esta aprobado o
 * rechazado, sin importar el rol. Por eso esta funcion recibe el estado y no solo el rol.
 */
export function puedeEditarGasto(rol, estadoDelGasto) {
  if (estadoDelGasto !== ESTADOS_DE_GASTO.PENDIENTE) return false;
  return puedeRegistrarGasto(rol);
}

/**
 * Permisos de un rol, en la forma que consume una pantalla.
 *
 * Sin `puedeEliminar`: gastos no tiene politica de DELETE ni GRANT de DELETE (00052), asi que
 * borrar un gasto no es una operacion del sistema.
 */
export function permisosDeGastos(rol) {
  return {
    puedeVer: puedeVerGastosDeJornada(rol),
    puedeVerTodo: puedeVerTodosLosGastos(rol),
    puedeCrear: puedeRegistrarGasto(rol),
    puedeAprobar: puedeAprobarGasto(rol),
  };
}
