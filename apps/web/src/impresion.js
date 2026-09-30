// Abre el dialogo de impresion cuando el documento ya esta listo para salir en papel.
//
// Los documentos imprimibles se montan en un portal y se imprimian un fotograma despues. Eso
// alcanzaba para el texto pero no para el logo: la imagen todavia no habia cargado y el reporte
// salia sin el. Aqui se espera a que carguen las imagenes del documento, con un tope para que una
// imagen que no llega no deje la impresion colgada.

/** Cuanto se espera como maximo a las imagenes antes de imprimir igual. */
const ESPERA_MAXIMA_MS = 2000;

function imagenCargada(imagen) {
  if (imagen.complete) return Promise.resolve();
  return new Promise((resolver) => {
    imagen.addEventListener("load", resolver, { once: true });
    imagen.addEventListener("error", resolver, { once: true });
  });
}

/**
 * Imprime cuando cargaron las imagenes de los documentos imprimibles montados.
 *
 * @returns {() => void} Cancela la impresion si todavia no salio (al desmontar).
 */
export function imprimirCuandoEsteListo() {
  let cancelado = false;

  const cuadro = window.requestAnimationFrame(() => {
    const imagenes = [...document.querySelectorAll('[class*="imprimible"] img')];
    const tope = new Promise((resolver) => setTimeout(resolver, ESPERA_MAXIMA_MS));
    Promise.race([Promise.all(imagenes.map(imagenCargada)), tope]).then(() => {
      if (!cancelado) window.print();
    });
  });

  return () => {
    cancelado = true;
    window.cancelAnimationFrame(cuadro);
  };
}
