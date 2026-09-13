import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react-native";
import { useRecetasPaciente } from "@ecopac/shared";
import RecetasPacienteSeccion from "../RecetasPacienteSeccion";

jest.mock("@ecopac/shared", () => ({
  ...jest.requireActual("@ecopac/shared"),
  useRecetasPaciente: jest.fn(),
}));

describe("RecetasPacienteSeccion", () => {
  const mockRecargar = jest.fn();

  const mockRecetas = [
    {
      id: "receta-01",
      fecha: "2026-09-12",
      medicoNombre: "Dr. Roberto Gómez",
      medicamentos: [
        {
          id: "med-1",
          nombre: "Paracetamol 500mg",
          dosis: "1 tableta",
          indicaciones: "Cada 8 horas por 5 días",
        },
      ],
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("muestra el indicador de carga cuando esta obteniendo las recetas", () => {
    useRecetasPaciente.mockReturnValue({
      recetas: [],
      cargando: true,
      error: null,
      recargar: mockRecargar,
    });

    render(<RecetasPacienteSeccion pacienteId="123" />);

    expect(screen.getByText("Cargando recetas...")).toBeTruthy();
  });

  it("renderiza la lista de recetas correctamente", () => {
    useRecetasPaciente.mockReturnValue({
      recetas: mockRecetas,
      cargando: false,
      error: null,
      recargar: mockRecargar,
    });

    render(<RecetasPacienteSeccion pacienteId="123" />);

    expect(screen.getByText("Recetas Emitidas")).toBeTruthy();
    expect(screen.getByText("2026-09-12")).toBeTruthy();
    expect(screen.getByText("Dr. Roberto Gómez")).toBeTruthy();
    expect(screen.getByText(/Paracetamol 500mg/i)).toBeTruthy();
  });

  it("muestra mensaje cuando no hay recetas disponibles", () => {
    useRecetasPaciente.mockReturnValue({
      recetas: [],
      cargando: false,
      error: null,
      recargar: mockRecargar,
    });

    render(<RecetasPacienteSeccion pacienteId="123" />);

    expect(screen.getByText("Sin recetas emitidas para este paciente.")).toBeTruthy();
  });

  it("muestra alerta de error y permite ejecutar recargar", () => {
    useRecetasPaciente.mockReturnValue({
      recetas: [],
      cargando: false,
      error: "Error al consultar base de datos",
      recargar: mockRecargar,
    });

    render(<RecetasPacienteSeccion pacienteId="123" />);

    expect(screen.getByText("Error al consultar base de datos")).toBeTruthy();

    fireEvent.press(screen.getByText("Reintentar"));
    expect(mockRecargar).toHaveBeenCalledTimes(1);
  });
});
