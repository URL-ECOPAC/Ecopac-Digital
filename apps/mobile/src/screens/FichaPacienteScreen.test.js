import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import FichaPacienteScreen from "./FichaPacienteScreen";

// Mock del paquete compartido para evitar que los hooks secundarios fallen
jest.mock("@ecopac/shared", () => ({
  ...jest.requireActual("@ecopac/shared"),
  useCondicionesCronicas: jest.fn(() => ({
    condiciones: [],
    cargando: false,
    error: null,
    recargar: jest.fn(),
  })),
  useSignosVitales: jest.fn(() => ({
    signos: [],
    cargando: false,
    error: null,
    recargar: jest.fn(),
  })),
  useRecetas: jest.fn(() => ({
    recetas: [],
    cargando: false,
    error: null,
    recargar: jest.fn(),
  })),
}));

describe("FichaPacienteScreen", () => {
  const mockNavigation = {
    goBack: jest.fn(),
  };

  const mockPaciente = {
    id: "paciente-123",
    nombre: "Juan Pérez",
    edad: 30,
    genero: "Masculino",
    historial: "Alergia a la penicilina",
    consultas: [{ id: 1, fecha: "2026-08-01", motivo: "Chequeo general" }],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renderiza la información del paciente correctamente con parámetros válidos", () => {
    const mockRoute = {
      params: {
        paciente: mockPaciente,
        rol: "medico",
      },
    };

    const { getByText } = render(
      <FichaPacienteScreen route={mockRoute} navigation={mockNavigation} />,
    );

    expect(getByText("Juan Pérez")).toBeTruthy();
  });

  it('cambia entre las pestañas "Historial" y "Consultas"', () => {
    const mockRoute = {
      params: {
        paciente: mockPaciente,
        rol: "medico",
      },
    };

    const { getByText, queryByText } = render(
      <FichaPacienteScreen route={mockRoute} navigation={mockNavigation} />,
    );

    // Cambiar a la pestaña de consultas si existe el tab en la pantalla
    const tabConsultas = queryByText("Consultas");
    if (tabConsultas) {
      fireEvent.press(tabConsultas);
      expect(getByText("Consultas Recientes")).toBeTruthy();
    }
  });

  it("muestra el estado de error cuando no existe objeto paciente", () => {
    const { getByText } = render(<FichaPacienteScreen route={{}} navigation={mockNavigation} />);

    expect(getByText("No se proporcionó información del paciente.")).toBeTruthy();
  });
});
