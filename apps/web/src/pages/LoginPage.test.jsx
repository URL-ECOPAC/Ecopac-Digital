// Pruebas de LoginPage (issue #864, punto 4).
// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";
import { MemoryRouter } from "react-router-dom";

import LoginPage from "./LoginPage";

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

const mockSesion = {
  estadoRestauracion: "listo",
  haySesion: false,
  error: null,
};

vi.mock("../contexto/SesionProvider", () => ({
  useSesionCompartida: () => mockSesion,
}));

const mockInicioSesion = {
  correo: "",
  setCorreo: vi.fn(),
  contrasena: "",
  setContrasena: vi.fn(),
  erroresDeCampo: {},
  error: null,
  enviando: false,
  handleSubmit: vi.fn(),
  destinoPorDefecto: null,
};

vi.mock("@ecopac/shared", async (importarOriginal) => ({
  ...(await importarOriginal()),
  useInicioSesion: vi.fn(() => mockInicioSesion),
}));

function pantalla(estado = {}, entrada = "/login") {
  Object.assign(mockSesion, { estadoRestauracion: "listo", haySesion: false, error: null }, estado);
  return render(
    <MemoryRouter initialEntries={[entrada]}>
      <LoginPage />
    </MemoryRouter>,
  );
}

afterEach(() => {
  mockInicioSesion.error = null;
});

describe("LoginPage - por que no se pudo entrar (issue #864)", () => {
  // El defecto: con una cuenta desactivada, signInWithPassword acierta (lo desactivado es el
  // perfil, no la cuenta de auth), haySesion pasa a true un instante, el <Navigate> desmonta esta
  // pantalla, y cuando useSesion cierra la sesion y se vuelve a /login el componente se monta de
  // cero -- con el error de useInicioSesion ya perdido. El formulario quedaba vacio y mudo.
  it("muestra el aviso de la sesion cuando el del formulario se perdio en el remonte", () => {
    pantalla({
      error: {
        codigo: "cuenta_desactivada",
        mensaje: "Tu usuario esta desactivado. Pide a la administradora que lo reactive.",
      },
    });

    expect(screen.getByText(/Tu usuario esta desactivado/, { exact: false })).toBeInTheDocument();
  });

  it("el error del formulario gana al de la sesion, que puede ser de un intento anterior", () => {
    mockInicioSesion.error = { mensaje: "El correo o la contrasena no son correctos." };
    pantalla({ error: { mensaje: "Tu sesion expiro." } });

    expect(screen.getByText("El correo o la contrasena no son correctos.")).toBeInTheDocument();
    expect(screen.queryByText("Tu sesion expiro.")).not.toBeInTheDocument();
  });

  // ISSUE #864: cambiar la contrasena cierra la sesion de recuperacion, asi que la sesion queda
  // con un "expiro" que NO es lo que paso. El mensaje que trae la navegacion manda.
  it("el mensaje de la navegacion gana al error de la sesion, y se ve como exito", () => {
    Object.assign(mockSesion, {
      estadoRestauracion: "listo",
      haySesion: false,
      error: { mensaje: "Tu sesion expiro. Inicia sesion de nuevo para continuar." },
    });

    render(
      <MemoryRouter
        initialEntries={[
          { pathname: "/login", state: { mensaje: "Tu contraseña quedó guardada." } },
        ]}
      >
        <LoginPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Tu contraseña quedó guardada.")).toBeInTheDocument();
    expect(screen.queryByText(/sesion expiro/i)).not.toBeInTheDocument();
  });

  it("sin ningun error no se pinta ninguna alerta", () => {
    pantalla();

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  // La otra mitad: mientras el intento esta en vuelo no se navega, aunque Supabase ya haya
  // emitido SIGNED_IN. Es lo que evita que el desmonte se lleve el error del formulario.
  it("no navega mientras el intento esta en vuelo, aunque ya haya sesion", () => {
    mockInicioSesion.enviando = true;
    pantalla({ haySesion: true });

    expect(screen.getByRole("button", { name: /Ingresando|Iniciar Sesión/ })).toBeInTheDocument();
    mockInicioSesion.enviando = false;
  });

  it("con sesion y sin intento en vuelo, si navega fuera del login", () => {
    pantalla({ haySesion: true });

    expect(screen.queryByRole("button", { name: "Iniciar Sesión" })).not.toBeInTheDocument();
  });
});
