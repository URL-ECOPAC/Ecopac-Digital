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

import { esAdministrador, esConsultivo } from "../usuarios/roles.js";

/**
 * Puede consultar donantes, donaciones y su detalle.
 *
 * Administrador y los dos roles consultivos (junta directiva, socio fundador): espejo exacto
 * del SELECT de la 00083.
 */
export function puedeVerDonaciones(rol) {
  return esAdministrador(rol) || esConsultivo(rol);
}

/**
 * Puede registrar un donante o una donacion, y anular una donacion.
 *
 * Solo administrador. Los roles consultivos leen pero no escriben, que es lo que dicen el
 * INSERT y el UPDATE de la 00083.
 */
export function puedeRegistrarDonaciones(rol) {
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
 */
export function permisosDeDonaciones(rol) {
  return {
    tieneAccesoLectura: puedeVerDonaciones(rol),
    puedeEscribir: puedeRegistrarDonaciones(rol),
  };
}
