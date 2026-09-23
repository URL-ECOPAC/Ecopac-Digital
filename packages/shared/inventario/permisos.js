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

import { esAdministrador, esConsultivo, ROLES } from "../usuarios/roles.js";

/**
 * Puede corregir la cantidad realmente entregada de un renglon de receta (issue #764).
 *
 * Espejo exacto de la guarda interna de fn_ajustar_entrega_receta() (00128, SECURITY DEFINER):
 * solo administrador o medico -un voluntario puede ver la receta y la pantalla de entrega, pero
 * no ajustarla-. La funcion valida el rol a mano porque, al ser SECURITY DEFINER, RLS no se
 * evalua; este reflejo evita que la pantalla ofrezca un campo editable que el servidor va a
 * rechazar de todas formas.
 */
export function puedeAjustarEntregaReceta(rol) {
  return esAdministrador(rol) || rol === ROLES.MEDICO;
}

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

/**
 * Puede consultar la valorizacion monetaria del inventario (issue #752).
 *
 * Espejo de la guarda interna de fn_valor_de_inventario_disponible() (00122): administrador y
 * los roles consultivos (junta directiva, socio fundador), la misma regla que ya protege el
 * resto de reportes financieros (presupuesto_de_jornada/proyecto/sistema, obtenerIndicadoresImpacto).
 * costo_unitario es informacion financiera que ni medico ni voluntario general necesitan para
 * hacer su trabajo, aunque los dos vean el resto de un lote.
 */
export function puedeVerValorizacion(rol) {
  return esAdministrador(rol) || esConsultivo(rol);
}

/**
 * Las pestanas de la pantalla de inventario que ve cada rol (issue #864, extendida por #859).
 *
 * El criterio 6 de la issue #864 le acota el inventario al medico a "solo catalogo, principios
 * activos y Mis movimientos", conservando el registro de ingresos y salidas -que son acciones de
 * la cabecera, no una pestana-. Lo que se le quita es lo que no le corresponde mirar ni decidir:
 *
 * - Lotes, Kardex y Bodegas y proveedores son la administracion de la bodega.
 * - Alertas de caducidad las atiende la administracion (fn_atender_alerta_caducidad, 00138, es
 *   `es_administrador()` en su propio cuerpo), y la notificacion le llega a ella (00138).
 * - Validacion es la bandeja donde se aprueban movimientos, y aprobar es `inventario.aprobar`:
 *   solo la administracion puede hacer algo con un pendiente (puedeAprobarMovimiento), asi que
 *   la #859 le retira la pestana a cualquier otro rol -antes solo se le quitaba al medico-, no
 *   solo el contador de pendientes que no puede resolver.
 *
 * Presentaciones (#859) se suma a la lista de todos: su politica de SELECT es de lectura abierta
 * (presentaciones.permisos.js, puedeVerPresentaciones), el mismo caso que principios activos.
 *
 * Vive aqui y no en la pantalla porque es una decision de negocio -- que le toca a cada rol --,
 * que es justo lo que packages/shared declara. La web la consume en InventarioPage.jsx.
 *
 * NO es una barrera: quien protege es RLS. Un medico que escriba la ruta a mano sigue viendo lo
 * que la base le entregue; lo que esto evita es ofrecerle pestanas que no va a poder usar.
 *
 * @param {string} rol
 * @returns {string[]} ids de pestana, en el orden en que se dibujan.
 */
export function pestanasDeInventario(rol) {
  if (rol === ROLES.MEDICO) {
    return ["catalogo", "principios-activos", "presentaciones", "mis-movimientos"];
  }

  const pestanas = [
    "catalogo",
    "lotes",
    "alertas",
    "kardex",
    "administracion",
    "principios-activos",
    "presentaciones",
  ];

  if (puedeRegistrarMovimiento(rol)) {
    pestanas.push("mis-movimientos");
  }

  if (esAdministrador(rol)) {
    pestanas.push("validacion");
  }

  return pestanas;
}

/**
 * Puede dar de alta un medicamento en el catalogo (issue #864).
 *
 * Administrador y medico. Es el espejo de la politica de INSERT de `medicamentos` y
 * `medicamento_principio` que amplia la 00141: un medico que registra un ingreso de algo que el
 * catalogo todavia no tiene se quedaba trabado, porque el alta en linea existia (la #851 la
 * puso en el formulario de donacion) pero la politica seguia siendo solo `es_administrador()`.
 *
 * Solo el alta: editar y desactivar siguen siendo de la administracion
 * (medicamentos.permisos.js, puedeAdministrarMedicamentos).
 */
export function puedeDarDeAltaMedicamento(rol) {
  return esAdministrador(rol) || rol === ROLES.MEDICO;
}
