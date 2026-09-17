// Pruebas de FichaPacienteScreen (issues #753 y #818).
//
// POR QUE ESTA PRUEBA SE REESCRIBIO ENTERA
//
// La anterior simulaba `useSignosVitales` y `useRecetas`, dos hooks que NO EXISTEN en
// @ecopac/shared, y montaba la pantalla con `route.params.paciente = { nombre, edad, genero,
// historial, consultas }`, un objeto que la API real nunca devuelve: el modelo tiene `nombres`,
// `apellidos` y `dpi` (migracion 00009). Pasaba en verde mientras la pantalla mostraba el nombre
// en blanco y "CUI/DPI: N/A" a todo el mundo.
//
// Ahora simula el contrato real -usePaciente() devolviendo `{ paciente, cargando, error,
// recargar }`- de modo que romper la pantalla ponga esto en rojo.

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { usePaciente } from "@ecopac/shared";

import FichaPacienteScreen from "./FichaPacienteScreen";

jest.mock("@ecopac/shared", () => ({
  ...jest.requireActual("@ecopac/shared"),
  usePaciente: jest.fn(),
  // Los hooks de las tres secciones: cada una tiene su propia prueba, aqui solo se las calla.
  useCondicionesCronicas: jest.fn(() => ({
    condiciones: [],
    cargando: false,
    error: null,
    recargar: jest.fn(),
  })),
  useEvolucionSignos: jest.fn(() => ({
    series: [],
    hayMediciones: false,
    cargando: false,
    error: null,
    recargar: jest.fn(),
  })),
  useRecetasPaciente: jest.fn(() => ({
    recetas: [],
    cargando: false,
    error: null,
    recargar: jest.fn(),
  })),
}));

jest.mock("../contexto/SesionProvider", () => ({
  useSesionCompartida: () => ({ rol: "medico", perfil: { id: "perfil-1" } }),
}));

const PACIENTE = {
  id: "paciente-123",
  nombres: "Juan",
  apellidos: "Perez Demo",
  dpi: "1234567890101",
  fechaNacimiento: "1996-01-15",
};

const navegacion = { navigate: jest.fn(), goBack: jest.fn() };
const ruta = { params: { pacienteId: PACIENTE.id } };

function montar() {
  return render(<FichaPacienteScreen route={ruta} navigation={navegacion} />);
}

beforeEach(() => {
  jest.clearAllMocks();
  usePaciente.mockReturnValue({
    paciente: PACIENTE,
    cargando: false,
    error: null,
    recargar: jest.fn(),
  });
});

describe("FichaPacienteScreen", () => {
  it("pide el paciente por su id, no por el objeto que le pasen", () => {
    montar();

    expect(usePaciente).toHaveBeenCalledWith("paciente-123", { rol: "medico" });
  });

  it("la cabecera muestra el nombre y el DPI reales del modelo", () => {
    montar();

    expect(screen.getByText("Juan Perez Demo")).toBeTruthy();
    expect(screen.getByText(/1234567890101/)).toBeTruthy();
  });

  it("mientras carga muestra el estado de carga y no la ficha", () => {
    usePaciente.mockReturnValue({
      paciente: null,
      cargando: true,
      error: null,
      recargar: jest.fn(),
    });
    montar();

    expect(screen.queryByText("Juan Perez Demo")).toBeNull();
  });

  it("si la consulta falla lo dice, en vez de quedarse en blanco", () => {
    usePaciente.mockReturnValue({
      paciente: null,
      cargando: false,
      error: { mensaje: "No hay conexion con el servidor" },
      recargar: jest.fn(),
    });
    montar();

    expect(screen.getByText("No hay conexion con el servidor")).toBeTruthy();
  });

  it("sin pacienteId lo dice, que es el caso de una navegacion mal armada", () => {
    render(<FichaPacienteScreen route={{}} navigation={navegacion} />);

    expect(screen.getByText(/No se proporciono el paciente/)).toBeTruthy();
  });

  it("se puede cambiar de pestania", () => {
    montar();

    fireEvent.press(screen.getByText("Recetas"));

    expect(screen.getByText("Recetas")).toBeTruthy();
  });

  // Las dos pantallas de destino leen `params.pacienteId`: navegar con el objeto entero las
  // dejaba sin paciente, que es el defecto que esta prueba impide que vuelva.
  it("los botones de triaje y consulta navegan con el id del paciente", () => {
    montar();

    fireEvent.press(screen.getByText("Nuevo Triaje"));
    expect(navegacion.navigate).toHaveBeenCalledWith("Triaje", { pacienteId: "paciente-123" });

    fireEvent.press(screen.getByText("Nueva Consulta"));
    expect(navegacion.navigate).toHaveBeenCalledWith("Consulta", { pacienteId: "paciente-123" });
  });
});
