// CampoDeFormulario de movil: espejo del de web (issue #840, B1). Lo que importa aqui es el campo
// de solo lectura, que es lo que faltaba en movil.

import { fireEvent, render, screen } from "@testing-library/react-native";
import { TIPOS_DE_CAMPO } from "@ecopac/shared";

import CampoDeFormulario from "./CampoDeFormulario";

const OPCIONES = [
  { value: "entrada", label: "Entrada" },
  { value: "salida", label: "Salida" },
];

describe("CampoDeFormulario (movil)", () => {
  it("un campo de solo lectura muestra la etiqueta de su valor y no se puede escribir", () => {
    render(
      <CampoDeFormulario
        campo={{
          id: "tipo",
          label: "Tipo",
          tipo: TIPOS_DE_CAMPO.SELECT,
          opciones: OPCIONES,
          soloLectura: true,
        }}
        valor="salida"
        onChange={jest.fn()}
      />,
    );

    const campo = screen.getByDisplayValue("Salida");
    expect(campo.props.editable).toBe(false);
  });

  it("un campo de texto editable avisa cada cambio", () => {
    const onChange = jest.fn();
    render(
      <CampoDeFormulario
        campo={{ id: "motivo", label: "Motivo", tipo: TIPOS_DE_CAMPO.TEXTO_LARGO }}
        valor=""
        onChange={onChange}
      />,
    );

    fireEvent.changeText(screen.getByDisplayValue(""), "Recuento");
    expect(onChange).toHaveBeenCalledWith("Recuento");
  });
});
