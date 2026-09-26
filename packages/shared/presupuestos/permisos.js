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

import { accedeAModuloPorMatriz, tienePermisoFino } from "../usuarios/acceso.js";
import { esAdministrador, ROLES, ROLES_DE_CAMPO } from "../usuarios/roles.js";
import { ESTADOS_DE_GASTO } from "../enums.js";

/**
 * Puede entrar a la pantalla de Presupuestos (resumen y gastos).
 *
 * Desde la 00148 tambien el personal de campo: ve el presupuesto de lo suyo -RLS le entrega las
 * jornadas y los gastos de las jornadas en las que participa, y los totales se calculan sobre eso-.
 * Ademas quien tiene presupuestos.registrar o presupuestos.aprobar delegado, que desde la 00148 ve
 * todos los gastos, y el rol al que la matriz le abrio el modulo (solo lectura).
 */
export function puedeVerTodosLosGastos(rol) {
  return (
    esAdministrador(rol) ||
    ROLES_DE_CAMPO.includes(rol) ||
    tienePermisoFino(rol, "presupuestos.registrar") ||
    tienePermisoFino(rol, "presupuestos.aprobar") ||
    accedeAModuloPorMatriz(rol, "presupuestos")
  );
}

/** Cualquier rol conocido ve los gastos de una jornada; RLS recorta las filas que no le tocan. */
export function puedeVerGastosDeJornada(rol) {
  return Object.values(ROLES).includes(rol);
}

/**
 * Puede registrar un gasto.
 *
 * La politica de INSERT (00089) admite a administrador, a quien tenga presupuestos.registrar, y al
 * personal asignado a la jornada, cuyo gasto entra pendiente y pasa por la aprobacion. Quien tiene
 * el modulo abierto por la matriz solo lee.
 */
export function puedeRegistrarGasto(rol) {
  return (
    esAdministrador(rol) ||
    ROLES_DE_CAMPO.includes(rol) ||
    tienePermisoFino(rol, "presupuestos.registrar")
  );
}

/**
 * Puede aprobar o rechazar un gasto: la administradora o quien tenga presupuestos.aprobar
 * delegado por persona (00052, conectado en el cliente por la 00148). Es la pestana Aprobaciones.
 */
export function puedeAprobarGasto(rol) {
  return tienePermisoFino(rol, "presupuestos.aprobar");
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
 * Que puede hacer un rol con el origen del presupuesto de una jornada (issue #840, 00135).
 *
 * Replica las politicas de jornada_presupuesto_origen (00135): lee administrador -y quien tenga
 * jornadas.gestionar, que no se resuelve desde el rol-, y registran o quitan aportes quienes
 * pueden actualizar la jornada. El personal de campo ve el total en la jornada, no el desglose.
 *
 * ISSUE #864: los consultivos salen de la lectura, aqui y en la politica (00141).
 *
 * @param {string} rol
 * @returns {{ puedeVer: boolean, puedeGestionar: boolean }}
 */
export function permisosDeOrigenDePresupuesto(rol) {
  // 00148: tambien quien gestiona jornadas por delegacion (lee y gestiona) y quien tiene Jornadas o
  // Presupuestos abierto por la matriz (solo lee).
  const gestiona = tienePermisoFino(rol, "jornadas.gestionar");
  return {
    puedeVer:
      gestiona ||
      accedeAModuloPorMatriz(rol, "jornadas") ||
      accedeAModuloPorMatriz(rol, "presupuestos"),
    puedeGestionar: gestiona,
  };
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
