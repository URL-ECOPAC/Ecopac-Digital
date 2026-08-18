// Adaptador de almacenamiento de la sesion para la web.
//
// Implementa el contrato documentado en packages/shared/api/almacenamiento.js usando
// localStorage, que es lo que hace que la sesion sobreviva a recargar la pagina.
//
// localStorage no siempre esta: el modo privado de algunos navegadores y las politicas que
// bloquean almacenamiento de terceros hacen que acceder lance. En ese caso se cae al
// respaldo en memoria de shared: se pierde la persistencia, pero la aplicacion arranca en
// vez de quedarse en blanco.

import { crearAlmacenamientoEnMemoria } from "@ecopac/shared";

/** Comprueba de una vez si se puede leer y escribir, en lugar de fallar en cada llamada. */
function hayLocalStorage() {
  try {
    const clave = "__ecopac_prueba__";
    window.localStorage.setItem(clave, "1");
    window.localStorage.removeItem(clave);
    return true;
  } catch {
    return false;
  }
}

function crearAlmacenamientoWeb() {
  if (!hayLocalStorage()) {
    console.warn(
      "localStorage no esta disponible: la sesion se guardara solo en memoria y se perdera " +
        "al recargar la pagina. Suele pasar en ventanas privadas o con el almacenamiento " +
        "bloqueado por el navegador.",
    );
    return crearAlmacenamientoEnMemoria();
  }

  return {
    getItem(clave) {
      return window.localStorage.getItem(clave);
    },
    setItem(clave, valor) {
      window.localStorage.setItem(clave, valor);
    },
    removeItem(clave) {
      window.localStorage.removeItem(clave);
    },
  };
}

export const almacenamientoWeb = crearAlmacenamientoWeb();
