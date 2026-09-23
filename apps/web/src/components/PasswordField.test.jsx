// Prueba del campo de contrasena con icono de ojo (issue #864).
// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

import PasswordField from "./PasswordField";

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

describe("PasswordField", () => {
  it("nace oculto y el boton ofrece mostrar", () => {
    render(<PasswordField label="Contraseña actual" value="secreta" onChange={() => {}} />);

    expect(screen.getByLabelText("Contraseña actual")).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Mostrar contraseña" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("el ojo alterna entre ver y ocultar el valor", () => {
    render(<PasswordField label="Contraseña actual" value="secreta" onChange={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: "Mostrar contraseña" }));
    expect(screen.getByLabelText("Contraseña actual")).toHaveAttribute("type", "text");

    const ocultar = screen.getByRole("button", { name: "Ocultar contraseña" });
    expect(ocultar).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(ocultar);
    expect(screen.getByLabelText("Contraseña actual")).toHaveAttribute("type", "password");
  });

  // Cada campo lleva su propio estado: en "Cambiar contrasena" hay tres y ver uno no puede
  // destapar los otros dos.
  it("dos campos en la misma pantalla no comparten la visibilidad", () => {
    render(
      <>
        <PasswordField label="Contraseña nueva" value="a" onChange={() => {}} />
        <PasswordField label="Confirmar contraseña nueva" value="b" onChange={() => {}} />
      </>,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Mostrar contraseña" })[0]);

    expect(screen.getByLabelText("Contraseña nueva")).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("Confirmar contraseña nueva")).toHaveAttribute("type", "password");
  });

  it("el boton no se interpone al tabular ni se puede pulsar con el campo deshabilitado", () => {
    render(<PasswordField label="Contraseña actual" value="x" onChange={() => {}} disabled />);

    const boton = screen.getByRole("button", { name: "Mostrar contraseña" });
    expect(boton).toHaveAttribute("tabindex", "-1");
    expect(boton).toBeDisabled();
  });

  it("muestra el error del campo", () => {
    render(
      <PasswordField
        label="Contraseña actual"
        value=""
        onChange={() => {}}
        error="La contraseña actual no es correcta."
      />,
    );

    expect(screen.getByText("La contraseña actual no es correcta.")).toBeInTheDocument();
    expect(screen.getByLabelText("Contraseña actual")).toHaveClass("is-invalid");
  });

  it("pasa el resto de props al input, como hace TextField", () => {
    const onChange = vi.fn();
    render(
      <PasswordField
        label="Contraseña nueva"
        value="abc"
        onChange={onChange}
        autoComplete="new-password"
      />,
    );

    const campo = screen.getByLabelText("Contraseña nueva");
    expect(campo).toHaveAttribute("autocomplete", "new-password");

    fireEvent.change(campo, { target: { value: "abcd" } });
    expect(onChange).toHaveBeenCalled();
  });
});
