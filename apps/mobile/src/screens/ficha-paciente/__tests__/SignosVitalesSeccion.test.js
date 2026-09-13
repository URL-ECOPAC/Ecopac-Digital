import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react-native";
import { obtenerTriajes } from "@ecopac/shared";
import SignosVitalesSeccion from "../SignosVitalesSeccion";

jest.mock("@ecopac/shared", () => ({
  ...jest.requireActual("@ecopac/shared"),
  obtenerTriajes: jest.fn(),
}));

describe("SignosVitalesSeccion", () => {
  const mockTriajes = [
    {
      id: "triaje-01",
      fecha: "2026-09-10 10:30",
      presionSistolica: 120,
      presionDiastolica: 80,
      frecuenciaCardiaca: 72,
      frecuenciaRespiratoria: 16,
      temperatura: 36.5,
      saturacionOxigeno: 98,
      peso: 70,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("muestra el indicador de carga mientras obtiene los datos", () => {
    obtenerTriajes.mockReturnValue(new Promise(() => {}));

    render(<SignosVitalesSeccion pacienteId="paciente-123" />);

    expect(screen.getByText("Cargando signos vitales...")).toBeTruthy();
  });

  it("muestra la lista de signos vitales al cargar exitosamente", async () => {
    obtenerTriajes.mockResolvedValueOnce(mockTriajes);

    render(<SignosVitalesSeccion pacienteId="paciente-123" />);

    await waitFor(() => {
      expect(screen.getByText("Historial de Signos Vitales")).toBeTruthy();
      expect(screen.getByText("2026-09-10 10:30")).toBeTruthy();
      expect(screen.getByText("120/80 mmHg")).toBeTruthy();
      expect(screen.getByText("72 bpm")).toBeTruthy();
    });

    expect(obtenerTriajes).toHaveBeenCalledWith("paciente-123");
  });

  it("muestra mensaje de estado vacio cuando no hay registros de triaje", async () => {
    obtenerTriajes.mockResolvedValueOnce([]);

    render(<SignosVitalesSeccion pacienteId="paciente-123" />);

    await waitFor(() => {
      expect(
        screen.getByText("Sin registros de signos vitales.")
      ).toBeTruthy();
    });
  });

  it("muestra mensaje de error y permite reintentar si falla la API", async () => {
    obtenerTriajes.mockResolvedValueOnce({
      error: { mensaje: "Error de conexión con el servidor." },
    });

    render(<SignosVitalesSeccion pacienteId="paciente-123" />);

    await waitFor(() => {
      expect(
        screen.getByText("Error de conexión con el servidor.")
      ).toBeTruthy();
    });

    // Simula reintento exitoso
    obtenerTriajes.mockResolvedValueOnce(mockTriajes);
    fireEvent.press(screen.getByText("Reintentar"));

    await waitFor(() => {
      expect(screen.getByText("120/80 mmHg")).toBeTruthy();
    });
  });
});