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

  // La forma que devuelve aReceta() (packages/shared/pacientes/recetas.api.js), no una inventada:
  // `createdAt`, `medico` ya aplanado a texto y los renglones en `detalle` (issue #818). El mock
  // anterior usaba `fecha`, `medicoNombre` y `medicamentos`, que no existen, y por eso la tarjeta
  // mostraba "Fecha N/A" y "Sin detalle de medicamentos" con la prueba en verde.
  const mockRecetas = [
    {
      id: "receta-01",
      folio: "REC-0001",
      estado: "emitida",
      createdAt: "2026-09-12T15:04:00.000Z",
      medico: "Roberto Gómez",
      indicacionesGenerales: "Tomar con alimentos",
      detalle: [
        {
          id: "med-1",
          medicamento: "Paracetamol",
          concentracion: "500mg",
          dosis: "1 tableta",
          frecuencia: "Cada 8 horas",
          duracion: "5 días",
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
    // La fecha se muestra formateada con formatearFechaCorta(), como el resto de la app.
    expect(screen.getByText("12/09/2026")).toBeTruthy();
    expect(screen.getByText("Roberto Gómez")).toBeTruthy();
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
