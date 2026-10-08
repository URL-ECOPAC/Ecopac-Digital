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

import { accedeAModuloPorMatriz, tienePermisoFino } from "../usuarios/acceso.js";
import { esAdministrador, esConsultivo, ROLES, ROLES_DE_CAMPO } from "../usuarios/roles.js";

/**
 * Puede corregir la cantidad realmente entregada de un renglon de receta (issue #764).
 *
 * Espejo exacto de la guarda interna de fn_ajustar_entrega_receta() (00128, SECURITY DEFINER):
 * solo administrador o medico -un voluntario puede ver la receta y la pantalla de entrega, pero
 * no ajustarla-. La funcion valida el rol a mano porque, al ser SECURITY DEFINER, RLS no se
 * evalua; este reflejo evita que la pantalla ofrezca un campo editable que el servidor va a
 * rechazar de todas formas.
 *
 * @param {string} rol
 * @returns {boolean}
 */
export function puedeAjustarEntregaReceta(rol) {
  return esAdministrador(rol) || rol === ROLES.MEDICO;
}

/**
 * Puede consultar movimientos. Espejo de la politica de SELECT (00034): abierta a cualquiera.
 *
 * @param {string} rol
 * @returns {boolean}
 */
export function puedeVerMovimientos(rol) {
  return Object.values(ROLES).includes(rol);
}

/**
 * Puede registrar un movimiento.
 *
 * Espejo de la politica de INSERT (00034): administrador, medico y voluntario general. Un
 * no-administrador solo puede insertar en estado 'pendiente' y como registrado_por = auth.uid(),
 * pero eso lo exige el servidor con los datos de la fila, no algo que el cliente decida por rol.
 *
 * @param {string} rol
 * @returns {boolean}
 */
export function puedeRegistrarMovimiento(rol) {
  return esAdministrador(rol) || rol === ROLES.MEDICO || rol === ROLES.VOLUNTARIO;
}

/**
 * Puede aprobar o rechazar un movimiento pendiente.
 *
 * Espejo de la politica de UPDATE vigente (00086/00106): la administradora, o quien tenga
 * inventario.aprobar delegado por persona (usuarios/acceso.js). Sin excepcion de "nunca lo que uno
 * mismo registro" (esa restriccion la tenia la politica de la 00034 y la 00048 la quito, #410).
 *
 * @param {string} rol
 * @returns {boolean}
 */
export function puedeAprobarMovimiento(rol) {
  return tienePermisoFino(rol, "inventario.aprobar");
}

/**
 * Espejo de puedeAprobarMovimiento: la misma politica de UPDATE gobierna aprobar y rechazar.
 *
 * @param {string} rol
 * @returns {boolean}
 */
export function puedeRechazarMovimiento(rol) {
  return puedeAprobarMovimiento(rol);
}

/**
 * Permisos de un rol, en la forma que consume una pantalla.
 *
 * Se devuelven juntos para que un hook no tenga que llamar a las funciones sueltas ni acordarse
 * de cuales existen.
 *
 * @param {string} rol
 * @returns {{ puedeVer: boolean, puedeRegistrar: boolean, puedeAprobar: boolean, puedeRechazar: boolean }}
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
 *
 * @param {string} rol
 * @returns {boolean}
 */
export function puedeVerValorizacion(rol) {
  // Espejo de puede_consultar_reportes() (00148), que es la guarda de la funcion desde entonces.
  return (
    esAdministrador(rol) ||
    esConsultivo(rol) ||
    tienePermisoFino(rol, "reportes.exportar") ||
    accedeAModuloPorMatriz(rol, "reportes")
  );
}

/**
 * Las pestanas de la pantalla de inventario que ve cada rol (issue #864, #859, 00148).
 *
 * Desde la 00148 medico y colaborador ven el inventario entero salvo la Validacion: registran
 * movimientos -que siguen pasando por la validacion- y crean y corrigen catalogos. Hasta ahi el
 * medico solo veia catalogo, principios activos, presentaciones y sus movimientos.
 *
 * Validacion es la bandeja donde se aprueban movimientos, y aprobar es `inventario.aprobar`: la
 * ve la administradora y quien lo tenga delegado (puedeAprobarMovimiento). Quien tiene el modulo
 * abierto por la matriz lo ve en solo lectura: sin Mis movimientos, porque no registra.
 *
 * Vive aqui y no en la pantalla porque es una decision de negocio -- que le toca a cada rol --,
 * que es justo lo que packages/shared declara. La web la consume en InventarioPage.jsx.
 *
 * NO es una barrera: quien protege es RLS. Lo que esto evita es ofrecer pestanas que no se van a
 * poder usar.
 *
 * @param {string} rol
 * @returns {string[]} ids de pestana, en el orden en que se dibujan.
 */
export function pestanasDeInventario(rol) {
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

  if (puedeAprobarMovimiento(rol)) {
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
 *
 * @param {string} rol
 * @returns {boolean}
 */
export function puedeDarDeAltaMedicamento(rol) {
  // 00148: tambien el colaborador, que crea en los catalogos de inventario.
  return esAdministrador(rol) || ROLES_DE_CAMPO.includes(rol);
}

/**
 * Puede atender una alerta de vencimiento (issue #899). Espejo de la guarda de
 * fn_atender_alerta_caducidad (00143), que rechaza a cualquier otro rol con 42501.
 *
 * @param {string} rol
 * @returns {boolean}
 */
export function puedeAtenderAlertasVencimiento(rol) {
  return esAdministrador(rol);
}

/**
 * Puede cambiar las antelaciones de los avisos de vencimiento (issue #899): la administracion, o
 * quien tenga el permiso fino inventario.configurar_alertas (se delega en Colaboradores). Espejo de
 * la politica "Administracion o permiso configura alertas de caducidad" (00162). Solo desde la web.
 *
 * @param {string} rol
 * @returns {boolean}
 */
export function puedeConfigurarAlertasVencimiento(rol) {
  return tienePermisoFino(rol, "inventario.configurar_alertas");
}
