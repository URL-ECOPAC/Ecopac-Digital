import React from "react";
import { render, screen } from "@testing-library/react-native";
import { useEvolucionSignos } from "@ecopac/shared";
import SignosPacienteSeccion from "../SignosPacienteSeccion";

// Mock del hook consumido por el componente
jest.mock("@ecopac/shared", () => ({
  ...jest.requireActual("@ecopac/shared"),
  useEvolucionSignos: jest.fn(),
  estaFueraDeRango: jest.fn(() => false),
  formatearFechaCorta: jest.fn((f) => f),
  ultimaMedicion: jest.fn((serie) => ({ fecha: "2026-09-01" })),
}));

describe("SignosPacienteSeccion", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("muestra la informacion de signos vitales cuando estan presentes", () => {
    useEvolucionSignos.mockReturnValue({
      series: [
        {
          id: "pa",
          label: "Presión Arterial",
          sufijo: "mmHg",
          mediciones: 1,
          lineas: [
            {
              id: "pas",
              label: "PAS / PAD",
              normal: [90, 120],
              puntos: [{ valor: "120/80", fecha: "2026-09-01" }],
            },
          ],
        },
      ],
      hayMediciones: true,
      cargando: false,
      error: null,
      recargar: jest.fn(),
    });

    render(<SignosPacienteSeccion pacienteId="123" rol="medico" />);

    expect(screen.getByText(/120\/80/i)).toBeTruthy();
  });

  it("maneja el estado sin signos registrados", () => {
    useEvolucionSignos.mockReturnValue({
      series: [],
      hayMediciones: false,
      cargando: false,
      error: null,
      recargar: jest.fn(),
    });

    render(<SignosPacienteSeccion pacienteId="123" rol="medico" />);

    expect(
      screen.getByText("Este paciente todavía no tiene signos vitales registrados.")
    ).toBeTruthy();
  });
});