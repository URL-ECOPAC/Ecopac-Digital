// Aviso entre el buzon y el contador de la cabecera (issue #755).
//
// Son dos hooks montados en sitios distintos -el contador en el layout, el buzon en el perfil- y
// sin este aviso, marcar una notificacion como leida dejaria el contador desactualizado hasta su
// siguiente consulta. Es un emisor minimo en memoria: sin window ni eventos del DOM, para que
// valga igual en la web y en el movil.

const suscriptores = new Set();

/**
 * @param {() => void} alCambiar
 * @returns {() => void} Cancela la suscripcion.
 */
export function suscribirCambiosDelBuzon(alCambiar) {
  suscriptores.add(alCambiar);
  return () => suscriptores.delete(alCambiar);
}

/**
 * Avisa a cada suscriptor de que el buzon cambio (se leyo o llego una notificacion), para que el
 * contador de no leidas se vuelva a pedir sin esperar al siguiente intervalo.
 *
 * @returns {void}
 */
export function avisarCambioDelBuzon() {
  suscriptores.forEach((alCambiar) => alCambiar());
}
