// Almacenamiento de la sesion de Supabase.
//
// El cliente necesita guardar la sesion en algun lado, pero shared no puede tocar
// localStorage ni AsyncStorage (regla de la frontera, ver docs/ARQUITECTURA-FRONTEND.md).
// Por eso el almacenamiento entra por parametro: cada app entrega el suyo.
//
// La forma que debe cumplir un adaptador es la que espera supabase-js:
//
//   getItem(clave)          -> string | null            (puede ser asincrono)
//   setItem(clave, valor)   -> void                     (puede ser asincrono)
//   removeItem(clave)       -> void                     (puede ser asincrono)
//
// El contrato formal y las implementaciones por plataforma (localStorage en web,
// AsyncStorage en movil) son la issue #46. Aqui solo vive lo que el cliente necesita para
// arrancar: un respaldo en memoria y la verificacion de que el adaptador recibido sirve.

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
