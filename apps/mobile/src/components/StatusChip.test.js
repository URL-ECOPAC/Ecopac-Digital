// Prueba del chip de estado del movil, centrada en `uppercase` (issue #864).
//
// La caja alta se pide desde fuera y se hace con `textTransform`, no con `.toUpperCase()` sobre
// el texto: el chip del historial de jornadas tiene que leerse "EN CURSO", pero el que muestra el
// rol de una persona o una especialidad no, y el lector de pantalla debe seguir anunciando el
// texto tal cual.

import { render, screen } from "@testing-library/react-native";

import StatusChip from "./StatusChip";

/** Aplana el `style` de un Text, que puede ser un objeto o un arreglo con falsos dentro. */
function estiloDe(nodo) {
  return Object.assign({}, ...[nodo.props.style].flat(Infinity).filter(Boolean));
}

describe("StatusChip (movil)", () => {
  it("por defecto no cambia la caja del texto", () => {
    render(<StatusChip status="en curso" label="En curso" />);

    expect(estiloDe(screen.getByText("En curso")).textTransform).toBeUndefined();
  });

  it("con uppercase lo pinta en caja alta sin tocar el texto", () => {
    render(<StatusChip status="en curso" label="En curso" uppercase />);

    // El texto sigue siendo el original: es lo que lee un lector de pantalla.
    const nodo = screen.getByText("En curso");
    expect(estiloDe(nodo).textTransform).toBe("uppercase");
  });

  it("un estado vacio no dibuja chip", () => {
    render(<StatusChip status="" label="En curso" />);

    expect(screen.queryByText("En curso")).toBeNull();
  });
});
