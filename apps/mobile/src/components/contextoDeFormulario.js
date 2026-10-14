import { createContext, createElement, useContext } from "react";

/**
 * Si un boton se dibuja dentro de un formulario de alta o edicion. Espejo de
 * apps/web/src/components/contextoDeFormulario.js.
 *
 * Lo publica Modal.js para su hoja, y `EnFormulario` para una pantalla de alta que no es un modal
 * (registro de paciente, de ingreso, de salida). Con eso el boton verde que confirma lleva el
 * disquete y no el "+" que abre un formulario.
 */
const ContextoDeFormulario = createContext(false);

export function useEnFormulario() {
  return useContext(ContextoDeFormulario);
}

/** Marca como formulario lo que envuelve, para las pantallas de alta que no son un modal. */
export function EnFormulario({ children }) {
  return createElement(ContextoDeFormulario.Provider, { value: true }, children);
}
