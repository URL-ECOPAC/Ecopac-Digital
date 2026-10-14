// Prueba del menu lateral de una seccion (Inventario, Pacientes): un boton "Opciones" que abre un
// panel desde la derecha con las opciones agrupadas.

import { fireEvent, render, screen } from "@testing-library/react-native";

import MenuLateral from "./MenuLateral";

const GRUPOS = [
  {
    titulo: "Movimientos",
    opciones: [
      { id: "ingreso", etiqueta: "Registrar ingreso", ruta: "RegistroIngreso" },
      { id: "aprobar", etiqueta: "Por aprobar", ruta: "Validacion", visible: false },
    ],
  },
  { titulo: "Vacio", opciones: [{ id: "x", etiqueta: "Oculta", visible: false }] },
];

describe("MenuLateral", () => {
  it("abre el panel con las opciones visibles, sin las ocultas ni los grupos vacios", () => {
    render(<MenuLateral grupos={GRUPOS} onElegir={() => {}} />);

    fireEvent.press(screen.getByLabelText("Opciones"));

    expect(screen.getByText("Registrar ingreso")).toBeTruthy();
    expect(screen.queryByText("Por aprobar")).toBeNull();
    expect(screen.queryByText("Vacio")).toBeNull();
  });

  it("elegir una opcion avisa con la opcion entera", () => {
    const onElegir = jest.fn();
    render(<MenuLateral grupos={GRUPOS} onElegir={onElegir} />);

    fireEvent.press(screen.getByLabelText("Opciones"));
    fireEvent.press(screen.getByText("Registrar ingreso"));

    expect(onElegir).toHaveBeenCalledWith(expect.objectContaining({ ruta: "RegistroIngreso" }));
  });

  it("sin ninguna opcion visible no dibuja el boton", () => {
    render(<MenuLateral grupos={[GRUPOS[1]]} onElegir={() => {}} />);
    expect(screen.queryByLabelText("Opciones")).toBeNull();
  });
});
