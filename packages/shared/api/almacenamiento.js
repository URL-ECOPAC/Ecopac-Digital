// Almacenamiento de la sesion de Supabase.
//
// El cliente necesita guardar la sesion en algun lado, pero shared no puede tocar
// localStorage ni AsyncStorage (regla de la frontera, ver docs/ARQUITECTURA-FRONTEND.md).
// Por eso el almacenamiento entra por parametro: cada app entrega el suyo.
//
// Este archivo es el contrato. Las implementaciones viven en cada app:
// apps/web/src/almacenamiento.js (localStorage) y apps/mobile/src/almacenamiento.js
// (AsyncStorage).

/**
 * Adaptador de almacenamiento de la sesion.
 *
 * Es la forma que espera supabase-js. Los tres metodos pueden ser sincronos o devolver una
 * promesa: supabase-js siempre hace await, asi que localStorage (sincrono) y AsyncStorage
 * (asincrono) encajan igual sin adaptar nada mas.
 *
 * Quien elige las claves es supabase-js, no la app: son de la forma sb-<proyecto>-auth-token.
 * Una app nunca debe escribir ni borrar esas claves por su cuenta.
 *
 * Un adaptador tiene que ser duradero para que la sesion sobreviva a recargar la pagina o a
 * cerrar la app. Si la plataforma no puede garantizarlo, es preferible caer al respaldo en
 * memoria de este archivo -la sesion se pierde, pero nada se rompe- que dejar a supabase-js
 * escribiendo en un sitio que falla.
 *
 * @typedef {object} AdaptadorDeAlmacenamiento
 * @property {(clave: string) => string | null | Promise<string | null>} getItem Valor
 *   guardado, o null si esa clave no existe. Nunca debe lanzar.
 * @property {(clave: string, valor: string) => void | Promise<void>} setItem Guarda el valor.
 * @property {(clave: string) => void | Promise<void>} removeItem Borra la clave. No es error
 *   que la clave no exista.
 */

import { ErrorDeCliente, CODIGOS_DE_ERROR_DE_CLIENTE } from "./errores.js";

/** Metodos que supabase-js va a llamar sobre el adaptador. */
export const METODOS_DE_ALMACENAMIENTO = ["getItem", "setItem", "removeItem"];

/**
 * Adaptador respaldado por un Map, sin persistencia.
 *
 * Es el respaldo cuando nadie entrega un adaptador y la pieza que usan las pruebas. La
 * sesion vive lo que viva el proceso: al recargar la pagina o cerrar la app se pierde.
 */
export function crearAlmacenamientoEnMemoria() {
  const datos = new Map();

  return {
    getItem(clave) {
      return datos.has(clave) ? datos.get(clave) : null;
    },
    setItem(clave, valor) {
      datos.set(clave, valor);
    },
    removeItem(clave) {
      datos.delete(clave);
    },
  };
}

/**
 * Verifica que el adaptador implemente los tres metodos.
 *
 * Un adaptador a medias no falla al crear el cliente: falla despues, como una sesion que no
 * se guarda y a nadie se le ocurre atribuir al almacenamiento. Mejor descartarlo aqui.
 */
export function validarAlmacenamiento(almacenamiento) {
  const faltantes = METODOS_DE_ALMACENAMIENTO.filter(
    (metodo) => typeof almacenamiento?.[metodo] !== "function",
  );

  if (faltantes.length > 0) {
    throw new ErrorDeCliente(
      `El adaptador de almacenamiento no implementa: ${faltantes.join(", ")}. ` +
        `Debe exponer ${METODOS_DE_ALMACENAMIENTO.join(", ")}.`,
      { codigo: CODIGOS_DE_ERROR_DE_CLIENTE.ALMACENAMIENTO_INVALIDO },
    );
  }

  return almacenamiento;
}
