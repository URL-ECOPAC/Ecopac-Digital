/**
 * Accion "Volver" de las pantallas internas de donaciones (registro, historial, donantes y
 * constancia), para PageHeader.
 *
 * Las cuatro se abren desde el resumen de donaciones y ninguna tenia como regresar a el: el
 * sidebar lleva a /donaciones, pero no se lee como "atras" y en pantalla estrecha esta oculto. Es
 * un enlace (`to`), no un navigate(-1): quien entro por un enlace directo tambien tiene a donde
 * volver.
 *
 * La flecha ya no se pasa a mano: desde la #834 la pone iconoDeAccion() para cualquier rotulo que
 * empiece por "Volver", que es lo que hace que el resto de pantallas se vean como esta.
 */
export const ACCION_VOLVER_A_DONACIONES = Object.freeze({
  key: "volver-a-donaciones",
  label: "Volver a donaciones",
  to: "/donaciones",
  variant: "neutra",
});
