// Que puede hacer cada rol con los movimientos de inventario.
//
// ESTO DECIDE QUE MUESTRA LA INTERFAZ, NO QUE PROTEGE EL SERVIDOR.
//
// Quien de verdad impide escribir es Row Level Security en la base de datos: las politicas de
// movimientos_inventario en 00034_politicas_rls_inventario.sql (SELECT abierto, INSERT) y la
// de UPDATE en 00048_administrador_aprueba_lo_que_registra.sql, que reemplazo a la de 00034. Por
// la misma razon, ninguna funcion de movimientos.api.js ni de validacion.api.js consulta este
// archivo antes de llamar: el cliente pregunta para dibujar; el servidor decide.
//
// Es la unica pieza de permisos que le faltaba al modulo (ver el encabezado de
// inventario/index.js): bodegas, proveedores, medicamentos, lotes y principios activos ya
// tenian su propio *.permisos.js.
//
// NOTA (issue #396): packages/shared/inventario/validacion.api.js todavia bloquea en JS que
// alguien apruebe o rechace un movimiento que registro el mismo. 00048 (issue #410) le quito
// esa restriccion a la politica de UPDATE -- hoy un administrador SI puede aprobar lo que el
// mismo registro. No se toca ese comportamiento aqui: es una regla de negocio de la API, no un
// permiso por rol, y cambiarla es una decision de producto que esta issue no pidio. Queda
// anotado para quien la revise.

import { esAdministrador, ROLES } from "../usuarios/roles.js";

/** Puede consultar movimientos. Espejo de la politica de SELECT (00034): abierta a cualquiera. */
export function puedeVerMovimientos(rol) {
  return Object.values(ROLES).includes(rol);
}

/**
 * Puede registrar un movimiento.
 *
 * Espejo de la politica de INSERT (00034): administrador, medico y voluntario general. Un
 * no-administrador solo puede insertar en estado 'pendiente' y como registrado_por = auth.uid(),
 * pero eso lo exige el servidor con los datos de la fila, no algo que el cliente decida por rol.
 */
export function puedeRegistrarMovimiento(rol) {
  return esAdministrador(rol) || rol === ROLES.MEDICO || rol === ROLES.VOLUNTARIO;
}

/**
 * Puede aprobar o rechazar un movimiento pendiente.
 *
 * Espejo de la politica de UPDATE vigente (00048): solo administrador, sin excepcion de "nunca
 * lo que uno mismo registro" (esa restriccion la tenia la politica anterior de 00034 y 00048 la
 * quito a proposito, issue #410).
 */
export function puedeAprobarMovimiento(rol) {
  return esAdministrador(rol);
}

/** Espejo de puedeAprobarMovimiento: la misma politica de UPDATE gobierna aprobar y rechazar. */
export function puedeRechazarMovimiento(rol) {
  return puedeAprobarMovimiento(rol);
}

/**
 * Permisos de un rol, en la forma que consume una pantalla.
 *
 * Se devuelven juntos para que un hook no tenga que llamar a las funciones sueltas ni acordarse
 * de cuales existen.
 */
export function permisosDeMovimientos(rol) {
  return {
    puedeVer: puedeVerMovimientos(rol),
    puedeRegistrar: puedeRegistrarMovimiento(rol),
    puedeAprobar: puedeAprobarMovimiento(rol),
    puedeRechazar: puedeRechazarMovimiento(rol),
  };
}
