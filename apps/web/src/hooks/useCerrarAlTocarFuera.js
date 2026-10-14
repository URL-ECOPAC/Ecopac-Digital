import { useEffect, useRef } from "react";

/**
 * Cierra un dialogo dibujado a mano al tocar fuera de el o al pulsar Escape.
 *
 * Los dialogos del catalogo (Modal, sobre react-bootstrap) ya lo hacen. Los que se escribieron con
 * un <div> de posicion fija -alta de lote, salida, ingreso, bodega, proveedor- no, y era la
 * diferencia que se notaba: unos se cerraban al tocar fuera y otros no.
 *
 * Devuelve las props para el FONDO (el <div> que cubre la pantalla). Se decide en mousedown y se
 * comprueba en click que los dos ocurrieron sobre el fondo: arrastrar para seleccionar texto dentro
 * de un campo y soltar fuera del dialogo no puede cerrarlo y perder lo escrito.
 *
 * @param {() => void} onClose
 * @param {{ activo?: boolean }} [opciones]
 */
export function useCerrarAlTocarFuera(onClose, { activo = true } = {}) {
  const empezoEnElFondo = useRef(false);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!activo) return undefined;
    const alPulsar = (evento) => {
      if (evento.key === "Escape") onCloseRef.current?.();
    };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [activo]);

  return {
    onMouseDown: (evento) => {
      empezoEnElFondo.current = evento.target === evento.currentTarget;
    },
    onClick: (evento) => {
      if (empezoEnElFondo.current && evento.target === evento.currentTarget) {
        onCloseRef.current?.();
      }
      empezoEnElFondo.current = false;
    },
  };
}
