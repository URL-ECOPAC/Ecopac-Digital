import { createContext, createElement, useContext } from "react";

/**
 * Si un boton se dibuja dentro de un formulario de alta o edicion.
 *
 * Lo publica Modal.jsx para todo lo que va en su cuerpo, y `EnFormulario` para una pantalla de
 * alta que no es un modal. Con eso "Registrar donante" o "Crear jornada" se dibujan como la accion
 * que guarda (disquete) y no como el "+" que abre un formulario (tipoDeAccionDeBoton, shared).
 *
 * createElement y no JSX por el mismo motivo que iconosDeAccion.js: este archivo es .js.
 */
const ContextoDeFormulario = createContext(false);

export function useEnFormulario() {
  return useContext(ContextoDeFormulario);
}

/** Marca como formulario lo que envuelve, para las pantallas de alta que no son un modal. */
export function EnFormulario({ children }) {
  return createElement(ContextoDeFormulario.Provider, { value: true }, children);
}
