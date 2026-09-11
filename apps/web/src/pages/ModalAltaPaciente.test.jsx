// Prueba de ModalAltaPaciente (Modulo I: registrar paciente, issue #776).
// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

import { CAMPOS_REGISTRO_PACIENTE } from "@ecopac/shared";

import ModalAltaPaciente from "./ModalAltaPaciente";

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

const CATALOGOS_VACIOS = {
  departamentos: [],
  municipios: [],
  comunidades: [],
  idiomas: [],
  sexo: [],
};

const mockEstadoHook = {
  campos: CAMPOS_REGISTRO_PACIENTE,
  valores: {},
  errores: {},
  error: null,
  enviando: false,
  edad: null,
  advertenciaDuplicado: null,
  registrado: null,
  departamentoId: null,
  municipioId: null,
  setCampo: vi.fn(),
  setDepartamento: vi.fn(),
  setMunicipio: vi.fn(),
  registrar: vi.fn(),
  reiniciar: vi.fn(),
  puedeCrearComunidad: false,
  registrarComunidad: vi.fn(),
  erroresComunidad: {},
  creandoComunidad: false,
  catalogos: CATALOGOS_VACIOS,
};

vi.mock("@ecopac/shared", async (importarOriginal) => ({
  ...(await importarOriginal()),
  useRegistroPaciente: vi.fn(() => mockEstadoHook),
}));

const { useRegistroPaciente } = await import("@ecopac/shared");

function pantalla() {
  return render(
    <ModalAltaPaciente onClose={vi.fn()} onRegistrado={vi.fn()} rol="voluntario general" />,
  );
}

describe("ModalAltaPaciente", () => {
  afterEach(() => {
    mockEstadoHook.valores = {};
    mockEstadoHook.errores = {};
    mockEstadoHook.error = null;
    mockEstadoHook.advertenciaDuplicado = null;
    mockEstadoHook.registrado = null;
    mockEstadoHook.enviando = false;
    mockEstadoHook.catalogos = CATALOGOS_VACIOS;
    useRegistroPaciente.mockClear();
    mockEstadoHook.registrar.mockClear();
    mockEstadoHook.setCampo.mockClear();
  });

  it("pinta el formulario con los campos de registro", () => {
    pantalla();

    expect(screen.getByText("Nuevo paciente")).toBeInTheDocument();
    expect(screen.getByText("Nombres")).toBeInTheDocument();
    expect(screen.getByText("Apellidos")).toBeInTheDocument();
  });

  it("el boton Registrar paciente dispara registrar()", () => {
    pantalla();

    fireEvent.click(screen.getByText("Registrar paciente"));

    expect(mockEstadoHook.registrar).toHaveBeenCalled();
  });

  it("escribir en un campo de texto llama a setCampo con el id correcto", () => {
    pantalla();

    fireEvent.change(screen.getByLabelText("Nombres"), { target: { value: "Ana" } });

    expect(mockEstadoHook.setCampo).toHaveBeenCalledWith("nombres", "Ana");
  });

  // Camino de error (issue #759/#776): si registrar() falla, la pantalla tiene que mostrar el
  // error, no una lista vacia ni quedarse en silencio como si nada hubiera pasado.
  it("camino de error: si la consulta falla, se muestra el mensaje de error", () => {
    mockEstadoHook.error = { mensaje: "No se pudo registrar el paciente. Intenta de nuevo." };
    pantalla();

    expect(
      screen.getByText("No se pudo registrar el paciente. Intenta de nuevo."),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("una advertencia de posible duplicado se muestra, sin bloquear el formulario", () => {
    mockEstadoHook.advertenciaDuplicado = "Ya existe un paciente con datos parecidos.";
    pantalla();

    expect(screen.getByText("Ya existe un paciente con datos parecidos.")).toBeInTheDocument();
    // No bloquea: el boton de registrar sigue presente y habilitado.
    expect(screen.getByText("Registrar paciente")).toBeInTheDocument();
  });

  it("un error de un campo especifico se muestra junto a ese campo", () => {
    mockEstadoHook.errores = { nombres: "El nombre es obligatorio." };
    pantalla();

    expect(screen.getByText("El nombre es obligatorio.")).toBeInTheDocument();
  });

  it("tras registrar con exito, muestra el numero de ficha en vez del formulario", () => {
    mockEstadoHook.registrado = {
      nombres: "Ana",
      apellidos: "Perez",
      expediente: { numeroFicha: "0001-2026" },
    };
    pantalla();

    expect(screen.getByText("Paciente registrado")).toBeInTheDocument();
    expect(screen.getByText("0001-2026")).toBeInTheDocument();
    expect(screen.queryByText("Registrar paciente")).not.toBeInTheDocument();
  });
});
