import React from "react";
import { Alert } from "react-native";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import {
  useCondicionesCronicas,
  actualizarCondicionCronica,
  ESTADOS_CONDICION_CRONICA,
} from "@ecopac/shared";
import CondicionesPacienteSeccion from "../CondicionesPacienteSeccion";

jest.mock("@ecopac/shared", () => ({
  ...jest.requireActual("@ecopac/shared"),
  useCondicionesCronicas: jest.fn(),
  actualizarCondicionCronica: jest.fn(),
  ESTADOS_CONDICION_CRONICA: {
    ACTIVA: "activa",
    RESUELTA: "resuelta",
  },
}));

describe("CondicionesPacienteSeccion", () => {
  const mockRecargar = jest.fn();
  const mockAlActualizar = jest.fn();

  const mockCondicionActiva = {
    id: "condicion-101",
    nombre: "Hipertensión Arterial",
    estado: "activa",
    etiquetaEstado: "Activa",
    notas: "Toma Enalapril",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, "alert");
  });

  it("muestra la lista de condiciones cronicas registradas", () => {
    useCondicionesCronicas.mockReturnValue({
      condiciones: [mockCondicionActiva],
      cargando: false,
      error: null,
      recargar: mockRecargar,
    });

    render(<CondicionesPacienteSeccion pacienteId="123" rol="medico" />);

    expect(screen.getByText(/Hipertensión Arterial/i)).toBeTruthy();
  });

  it("maneja el estado sin condiciones registradas", () => {
    useCondicionesCronicas.mockReturnValue({
      condiciones: [],
      cargando: false,
      error: null,
      recargar: mockRecargar,
    });

    render(<CondicionesPacienteSeccion pacienteId="123" rol="medico" />);

    expect(
      screen.getByText("Sin condiciones crónicas registradas.")
    ).toBeTruthy();
  });

  it("muestra el boton Resolver si el rol es medico/administrador y la condicion no esta resuelta", () => {
    useCondicionesCronicas.mockReturnValue({
      condiciones: [mockCondicionActiva],
      cargando: false,
      error: null,
      recargar: mockRecargar,
    });

    render(<CondicionesPacienteSeccion pacienteId="123" rol="medico" />);

    expect(screen.getByText("Resolver")).toBeTruthy();
  });

  it("no muestra el boton Resolver si el rol no tiene permisos", () => {
    useCondicionesCronicas.mockReturnValue({
      condiciones: [mockCondicionActiva],
      cargando: false,
      error: null,
      recargar: mockRecargar,
    });

    render(<CondicionesPacienteSeccion pacienteId="123" rol="paciente" />);

    expect(screen.queryByText("Resolver")).toBeNull();
  });

  it("despliega la alerta de confirmacion al presionar Resolver y actualiza la condicion con exito", async () => {
    actualizarCondicionCronica.mockResolvedValueOnce({ error: null });

    useCondicionesCronicas.mockReturnValue({
      condiciones: [mockCondicionActiva],
      cargando: false,
      error: null,
      recargar: mockRecargar,
    });

    render(
      <CondicionesPacienteSeccion
        pacienteId="123"
        rol="medico"
        alActualizar={mockAlActualizar}
      />
    );

    const botonResolver = screen.getByText("Resolver");
    fireEvent.press(botonResolver);

    // Verifica que se lanzó el Alert.alert con las opciones
    expect(Alert.alert).toHaveBeenCalledWith(
      "Resolver condición",
      '¿Deseas marcar "Hipertensión Arterial" como resuelta?',
      expect.any(Array)
    );

    // Captura la acción del botón 'Resolver' dentro del Alert
    const opcionesAlert = Alert.alert.mock.calls[0][2];
    const botonConfirmar = opcionesAlert.find((opt) => opt.text === "Resolver");

    // Ejecuta el callback asíncrono dentro de act()
    await act(async () => {
      await botonConfirmar.onPress();
    });

    // Verifica la llamada a la API compartida
    expect(actualizarCondicionCronica).toHaveBeenCalledWith("condicion-101", {
      estado: ESTADOS_CONDICION_CRONICA.RESUELTA,
    });

    // Verifica la ejecución de los callbacks de recarga
    await waitFor(() => {
      expect(mockRecargar).toHaveBeenCalledTimes(1);
      expect(mockAlActualizar).toHaveBeenCalledTimes(1);
    });
  });

  it("muestra una alerta de error si la API falla al resolver", async () => {
    actualizarCondicionCronica.mockResolvedValueOnce({
      error: { mensaje: "No se pudo actualizar la condición." },
    });

    useCondicionesCronicas.mockReturnValue({
      condiciones: [mockCondicionActiva],
      cargando: false,
      error: null,
      recargar: mockRecargar,
    });

    render(<CondicionesPacienteSeccion pacienteId="123" rol="medico" />);

    fireEvent.press(screen.getByText("Resolver"));

    const opcionesAlert = Alert.alert.mock.calls[0][2];
    const botonConfirmar = opcionesAlert.find((opt) => opt.text === "Resolver");

    // Ejecuta el callback asíncrono dentro de act()
    await act(async () => {
      await botonConfirmar.onPress();
    });

    // Verifica que se llamó nuevamente a Alert.alert notificando el error de la API
    expect(Alert.alert).toHaveBeenCalledWith(
      "Error",
      "No se pudo actualizar la condición."
    );
    expect(mockRecargar).not.toHaveBeenCalled();
  });
});