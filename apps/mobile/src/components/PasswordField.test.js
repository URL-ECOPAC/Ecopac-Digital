// Prueba del campo de contrasena con icono de ojo en movil (issue #864).
//
// Lo que importa aqui no es que el icono cambie, sino las dos cosas que estaban mal antes:
// que el valor se pudiera ver, y que cada campo se viera POR SU CUENTA. Hasta esta issue
// AjustesScreen llevaba un unico `verContrasena` para sus tres campos y NuevaContrasenaScreen
// uno para los dos suyos, asi que mostrar uno los mostraba todos.

import { fireEvent, render, screen } from "@testing-library/react-native";

import PasswordField from "./PasswordField";

describe("PasswordField (movil)", () => {
  it("nace oculto", () => {
    render(<PasswordField label="Contraseña" value="secreta" onChangeText={() => {}} />);

    expect(screen.getByLabelText("Mostrar contraseña")).toBeTruthy();
    expect(screen.getByDisplayValue("secreta").props.secureTextEntry).toBe(true);
  });

  it("el ojo alterna entre mostrar y ocultar", () => {
    render(<PasswordField label="Contraseña" value="secreta" onChangeText={() => {}} />);

    fireEvent.press(screen.getByLabelText("Mostrar contraseña"));
    expect(screen.getByDisplayValue("secreta").props.secureTextEntry).toBe(false);

    fireEvent.press(screen.getByLabelText("Ocultar contraseña"));
    expect(screen.getByDisplayValue("secreta").props.secureTextEntry).toBe(true);
  });

  it("cada campo tiene su propia visibilidad: mostrar uno no descubre el otro", () => {
    render(
      <>
        <PasswordField label="Nueva" value="una" onChangeText={() => {}} />
        <PasswordField label="Confirmar" value="otra" onChangeText={() => {}} />
      </>,
    );

    fireEvent.press(screen.getAllByLabelText("Mostrar contraseña")[0]);

    expect(screen.getByDisplayValue("una").props.secureTextEntry).toBe(false);
    expect(screen.getByDisplayValue("otra").props.secureTextEntry).toBe(true);
  });

  it("con el campo deshabilitado el ojo tampoco se puede pulsar", () => {
    render(
      <PasswordField label="Contraseña" value="secreta" onChangeText={() => {}} editable={false} />,
    );

    const ojo = screen.getByLabelText("Mostrar contraseña");
    fireEvent.press(ojo);

    expect(screen.getByDisplayValue("secreta").props.secureTextEntry).toBe(true);
  });

  it("muestra el error del campo", () => {
    render(
      <PasswordField
        label="Contraseña"
        value=""
        onChangeText={() => {}}
        error="Mínimo 8 caracteres"
      />,
    );

    expect(screen.getByText("Mínimo 8 caracteres")).toBeTruthy();
  });
});
