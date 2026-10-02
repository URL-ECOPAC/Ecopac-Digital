// Que puede hacer cada rol con los donantes y las donaciones.
//
// ESTO DECIDE QUE MUESTRA LA INTERFAZ, NO QUE PROTEGE EL SERVIDOR.
//
// Quien de verdad impide leer o escribir es Row Level Security: las politicas vigentes de
// donantes, donaciones y donacion_detalle son las de la migracion 00083, que corrigio a la
// 00042. El SELECT de las tres tablas exige `es_administrador() OR es_consultivo()`; el INSERT
// y el UPDATE exigen unicamente `es_administrador()`. Este archivo es el espejo de esas dos
// condiciones, igual que proyectos/permisos.js lo es de la 00039/00080.
//
// Por eso ninguna funcion de donantes.api.js ni de ingreso.api.js consulta este archivo antes
// de llamar: el cliente pregunta para dibujar, el servidor decide.
//
// Nace de la issue #598. Los cuatro hooks del modulo traian su propia lista de roles escrita a
// mano -- `["Administrador", "Junta Directiva", "Socio Fundador"]` -- con las iniciales en
// mayuscula. El enum rol_usuario de la 00001 y usuarios/roles.js los definen en minuscula
// (`administrador`, `junta directiva`, `socio fundador`), asi que ninguna de esas cadenas
// coincidia nunca: `tieneAccesoLectura` era false para todo el mundo y las cuatro pantallas del
// modulo respondian "Acceso denegado" incluso a la administradora. La intencion de esas listas
// si era la correcta y es la que se conserva aqui; lo que estaba mal eran los valores.

import { accedeAModuloPorMatriz, tienePermisoFino } from "../usuarios/acceso.js";
import { esAdministrador } from "../usuarios/roles.js";

/**
 * Puede consultar donantes, donaciones y su detalle.
 *
 * Espejo del SELECT de las tres tablas (00148): la administradora, quien tenga
 * donaciones.registrar delegado, y el rol al que la matriz le abrio Donaciones (solo lectura).
 *
 * @param {string} rol
 * @returns {boolean}
 */
export function puedeVerDonaciones(rol) {
  return tienePermisoFino(rol, "donaciones.registrar") || accedeAModuloPorMatriz(rol, "donaciones");
}

/**
 * Puede registrar un donante o una donacion: la administradora o quien tenga
 * donaciones.registrar delegado por persona (INSERT de las tres tablas, 00086).
 *
 * @param {string} rol
 * @returns {boolean}
 */
export function puedeRegistrarDonaciones(rol) {
  return tienePermisoFino(rol, "donaciones.registrar");
}

/**
 * Puede corregir o dar de baja a un donante: solo la administradora. La politica de UPDATE de
 * donantes no admite el permiso fino: registrar se delega, deshacer no. Una donacion ya no la
 * corrige ni la anula nadie (00173): no tiene politica de UPDATE.
 *
 * @param {string} rol
 * @returns {boolean}
 */
export function puedeCorregirDonaciones(rol) {
  return esAdministrador(rol);
}

/**
 * Permisos de un rol, en la forma que consume una pantalla.
 *
 * Se devuelven juntos para que un hook no tenga que llamar a las dos por separado ni acordarse
 * de cuales existen. Mismo criterio que permisosDeProyectos() y permisosDeReportes().
 *
 * `tieneAccesoLectura` y `puedeEscribir` conservan los nombres con los que ya los leen los
 * hooks del modulo, para no tocar las pantallas desde aqui.
 *
 * @param {string} rol
 * @returns {{ tieneAccesoLectura: boolean, puedeEscribir: boolean, puedeCorregir: boolean }}
 */
export function permisosDeDonaciones(rol) {
  return {
    tieneAccesoLectura: puedeVerDonaciones(rol),
    puedeEscribir: puedeRegistrarDonaciones(rol),
    puedeCorregir: puedeCorregirDonaciones(rol),
  };
}
