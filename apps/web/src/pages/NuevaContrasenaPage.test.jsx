// Pruebas de NuevaContrasenaPage (issue #864, punto 5).
// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";
import { MemoryRouter } from "react-router-dom";

import NuevaContrasenaPage from "./NuevaContrasenaPage";

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

const mockHook = {
  contrasena: "",
  setContrasena: vi.fn(),
  confirmarContrasena: "",
  setConfirmarContrasena: vi.fn(),
  enviando: false,
  errorGlobal: null,
  erroresDeCampo: {},
  exito: false,
  actualizarContrasena: vi.fn(),
};

const establecerSesion = vi.fn(() => Promise.resolve({ error: null }));

vi.mock("@ecopac/shared", async (importarOriginal) => ({
  ...(await importarOriginal()),
  useNuevaContrasena: vi.fn(() => mockHook),
  establecerSesionDeRecuperacion: (...args) => establecerSesion(...args),
}));

function pantalla(ruta) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <NuevaContrasenaPage />
    </MemoryRouter>,
  );
}

describe("NuevaContrasenaPage - invitacion o restablecimiento (issue #864)", () => {
  // A la misma pantalla se llega por dos caminos que no son lo mismo para quien la lee. Quien
  // estrena su cuenta nunca tuvo contrasena: pedirle que "restablezca" una es pedirle algo que
  // no existio.
  it("con ?origen=invitacion saluda a quien estrena su cuenta", () => {
    pantalla("/nueva-contrasena?origen=invitacion");

    expect(screen.getByRole("heading", { name: "Te damos la bienvenida" })).toBeInTheDocument();
    expect(
      screen.getByText("Elige la contraseña con la que vas a entrar a Ecopac Digital"),
    ).toBeInTheDocument();
  });

  // Sin el parametro: "olvide mi contrasena", y tambien cualquier invitacion enviada antes de
  // este cambio. Se sigue leyendo como restablecimiento, que es el texto que ya estaba.
  it("sin el parametro se lee como un restablecimiento", () => {
    pantalla("/nueva-contrasena");

    // `getByRole("heading")` y no `getByText`: "Nueva contraseña" es tambien la etiqueta del
    // primer campo, asi que un getByText encuentra dos.
    expect(screen.getByRole("heading", { name: "Nueva contraseña" })).toBeInTheDocument();
    expect(screen.getByText("Elige una contraseña para tu cuenta")).toBeInTheDocument();
  });

  it("un valor distinto en origen no se confunde con la invitacion", () => {
    pantalla("/nueva-contrasena?origen=otra-cosa");

    expect(screen.getByRole("heading", { name: "Nueva contraseña" })).toBeInTheDocument();
  });

  it("los dos campos tienen su propio ojito", () => {
    pantalla("/nueva-contrasena?origen=invitacion");

    expect(screen.getAllByRole("button", { name: "Mostrar contraseña" })).toHaveLength(2);
  });
});

// ISSUE #864, el defecto mas serio del punto 5. supabase-js solo lee el fragmento de la URL si
// NO hay una sesion abierta; si la hay, el fragmento se ignora y `updateUser({ password })`
// cambia la contrasena de quien estuviera en sesion. Comprobado en local: la administradora
// invita, abre el enlace sin cerrar su sesion, y la contrasena que cambia es la suya.
describe("NuevaContrasenaPage - la sesion es la del enlace, no la que hubiera (issue #864)", () => {
  it("fija la sesion con los tokens del fragmento antes de dejar guardar", async () => {
    establecerSesion.mockClear();
    window.history.replaceState(
      null,
      "",
      "/nueva-contrasena?origen=invitacion#access_token=tok-acceso&refresh_token=tok-refresco&type=recovery",
    );

    pantalla("/nueva-contrasena?origen=invitacion");

    await waitFor(() => {
      expect(establecerSesion).toHaveBeenCalledWith("tok-acceso", "tok-refresco");
    });
  });

  it("y limpia el fragmento, para no dejar el token en la barra ni en el historial", async () => {
    window.history.replaceState(
      null,
      "",
      "/nueva-contrasena#access_token=tok-acceso&refresh_token=tok-refresco&type=recovery",
    );

    pantalla("/nueva-contrasena");

    await waitFor(() => {
      expect(window.location.hash).toBe("");
    });
  });

  it("sin fragmento no se llama a nada y el formulario queda utilizable", async () => {
    establecerSesion.mockClear();
    window.history.replaceState(null, "", "/nueva-contrasena");

    pantalla("/nueva-contrasena");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Guardar nueva contraseña" })).toBeEnabled();
    });
    expect(establecerSesion).not.toHaveBeenCalled();
  });
});
