// Prueba de ModalGasto: "Crear categoria nueva" guarda la categoria en el catalogo (00158) y el
// gasto que pasa el presupuesto se bloquea (00159).
// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

import ModalGasto from "./ModalGasto";

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

function estado(cambios = {}) {
  return {
    valores: {
      jornada_id: "",
      concepto: "",
      categoria: "",
      monto: "",
      fecha: "",
      responsable_id: "",
      estado: "pendiente",
    },
    errores: [],
    error: null,
    enviando: false,
    esEdicion: false,
    sucio: false,
    catalogos: {
      jornadas: [],
      perfiles: [],
      categorias: [{ value: "Logistica", label: "Logistica" }],
    },
    esExcedente: false,
    mensajeExcedente: null,
    setCampo: vi.fn(),
    enviar: vi.fn(async () => ({ ok: false })),
    puedeCrearCategoria: true,
    crearCategoria: vi.fn(async () => true),
    creandoCategoria: false,
    errorCategoria: null,
    limpiarErrorCategoria: vi.fn(),
    ...cambios,
  };
}

let mockEstado = estado();

vi.mock("@ecopac/shared", async (importarOriginal) => ({
  ...(await importarOriginal()),
  useFormularioGasto: vi.fn(() => mockEstado),
}));

function pantalla() {
  return render(<ModalGasto usuarioId="perfil-1" rol="administrador" onClose={vi.fn()} />);
}

describe("ModalGasto", () => {
  it("Crear categoria nueva la guarda con crearCategoria()", async () => {
    mockEstado = estado();
    pantalla();

    fireEvent.click(screen.getByRole("button", { name: /Crear categoría nueva/ }));
    fireEvent.change(screen.getByLabelText("Nueva categoría"), {
      target: { value: "Transporte" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Guardar/ }));

    await waitFor(() => expect(mockEstado.crearCategoria).toHaveBeenCalledWith("Transporte"));
    await waitFor(() => expect(screen.queryByLabelText("Nueva categoría")).not.toBeInTheDocument());
  });

  it("si la categoria no se pudo crear, el alta sigue abierta con el error", async () => {
    mockEstado = estado({
      crearCategoria: vi.fn(async () => false),
      errorCategoria: { mensaje: "Ese registro ya existe." },
    });
    pantalla();

    fireEvent.click(screen.getByRole("button", { name: /Crear categoría nueva/ }));
    fireEvent.change(screen.getByLabelText("Nueva categoría"), {
      target: { value: "Logistica" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Guardar/ }));

    await waitFor(() => expect(mockEstado.crearCategoria).toHaveBeenCalled());
    expect(screen.getByLabelText("Nueva categoría")).toBeInTheDocument();
    expect(screen.getByText("Ese registro ya existe.")).toBeInTheDocument();
  });

  it("sin permiso no ofrece crear categorias", () => {
    mockEstado = estado({ puedeCrearCategoria: false });
    pantalla();

    expect(screen.queryByRole("button", { name: /Crear categoría nueva/ })).not.toBeInTheDocument();
  });

  it("con la jornada fija (alta desde el detalle de la jornada), la jornada no se cambia", () => {
    mockEstado = estado({
      jornadaFija: true,
      valores: { ...estado().valores, jornada_id: "j-1" },
      catalogos: { ...estado().catalogos, jornadas: [{ value: "j-1", label: "Jornada Uno" }] },
    });
    pantalla();

    expect(screen.getByLabelText("Jornada")).toBeDisabled();
    expect(screen.getByLabelText("Jornada")).toHaveValue("j-1");
  });

  it("sin jornada fija, la jornada se elige", () => {
    mockEstado = estado({
      catalogos: { ...estado().catalogos, jornadas: [{ value: "j-1", label: "Jornada Uno" }] },
    });
    pantalla();

    expect(screen.getByLabelText("Jornada")).toBeEnabled();
  });

  it("un gasto que pasa el presupuesto muestra el aviso como error", () => {
    mockEstado = estado({
      esExcedente: true,
      mensajeExcedente: "Este gasto pasa el presupuesto de la jornada por Q100.00.",
    });
    pantalla();

    expect(screen.getByText(/pasa el presupuesto de la jornada/).closest(".alert")).toHaveClass(
      "alert-danger",
    );
  });
});
