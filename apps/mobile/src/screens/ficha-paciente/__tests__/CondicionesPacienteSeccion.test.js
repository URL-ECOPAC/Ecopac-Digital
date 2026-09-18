// Pruebas de CondicionesPacienteSeccion (issue #818).
//
// POR QUE SE REESCRIBIO
//
// La version anterior simulaba `useCondicionesCronicas` y `actualizarCondicionCronica`, dos
// nombres que **no existen en @ecopac/shared**. `jest.mock` acepta simular lo que sea, exista o
// no, asi que la prueba pasaba en verde mientras la pantalla mostraba una lista vacia para
// siempre y el boton "Resolver" habria reventado al pulsarlo.
//
// Ahora simula el hook real, `useCondicionesPaciente`, con la forma que devuelve de verdad: el
// nombre de la condicion viaja en `condicion` -lo aplana aCondicionDelPaciente()-, y los permisos
// y `marcarResuelta` los resuelve el propio hook.

import React from "react";
import { Alert } from "react-native";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { useCondicionesPaciente } from "@ecopac/shared";

import CondicionesPacienteSeccion from "../CondicionesPacienteSeccion";

jest.mock("@ecopac/shared", () => ({
  ...jest.requireActual("@ecopac/shared"),
  useCondicionesPaciente: jest.fn(),
}));

const CONDICION_ACTIVA = {
  id: "condicion-101",
  condicion: "Hipertensión Arterial",
  estado: "activa",
  notas: "Toma Enalapril",
};

const PERMISOS_DE_MEDICO = {
  puedeVer: true,
  puedeRegistrar: true,
  puedeEditar: true,
  puedeQuitar: true,
};

function estado(extra = {}) {
  return {
    condiciones: [CONDICION_ACTIVA],
    cargando: false,
    error: null,
    enviando: false,
    permisos: PERMISOS_DE_MEDICO,
    marcarResuelta: jest.fn(async () => ({ ok: true })),
    recargar: jest.fn(),
    ...extra,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, "alert");
});

describe("CondicionesPacienteSeccion", () => {
  it("pide las condiciones con el rol de la sesion", () => {
    useCondicionesPaciente.mockReturnValue(estado());

    render(<CondicionesPacienteSeccion pacienteId="p-1" rol="medico" />);

    expect(useCondicionesPaciente).toHaveBeenCalledWith("p-1", { rol: "medico" });
  });

  it("muestra el nombre de la condicion tal como lo devuelve la API", () => {
    useCondicionesPaciente.mockReturnValue(estado());

    render(<CondicionesPacienteSeccion pacienteId="p-1" rol="medico" />);

    expect(screen.getByText(/Hipertensión Arterial/)).toBeTruthy();
    expect(screen.getByText("Toma Enalapril")).toBeTruthy();
  });

  it("sin condiciones lo dice", () => {
    useCondicionesPaciente.mockReturnValue(estado({ condiciones: [] }));

    render(<CondicionesPacienteSeccion pacienteId="p-1" rol="medico" />);

    expect(screen.getByText("Sin condiciones crónicas registradas.")).toBeTruthy();
  });

  it("si la consulta falla muestra el error, no una lista vacia", () => {
    useCondicionesPaciente.mockReturnValue(
      estado({ error: { mensaje: "No hay conexion" }, condiciones: [] }),
    );

    render(<CondicionesPacienteSeccion pacienteId="p-1" rol="medico" />);

    expect(screen.getByText("No hay conexion")).toBeTruthy();
  });

  it("quien no puede quitar no ve el boton de resolver", () => {
    useCondicionesPaciente.mockReturnValue(
      estado({ permisos: { ...PERMISOS_DE_MEDICO, puedeQuitar: false } }),
    );

    render(<CondicionesPacienteSeccion pacienteId="p-1" rol="voluntario general" />);

    expect(screen.queryByText("Resolver")).toBeNull();
  });

  it("resolver una condicion llama al hook y avisa al padre", async () => {
    const marcarResuelta = jest.fn(async () => ({ ok: true }));
    const alActualizar = jest.fn();
    useCondicionesPaciente.mockReturnValue(estado({ marcarResuelta }));

    render(
      <CondicionesPacienteSeccion pacienteId="p-1" rol="medico" alActualizar={alActualizar} />,
    );
    fireEvent.press(screen.getByText("Resolver"));

    // La confirmacion es un Alert nativo: se dispara el boton "Resolver" del propio Alert.
    const [, , botones] = Alert.alert.mock.calls[0];
    await botones.find((boton) => boton.text === "Resolver").onPress();

    await waitFor(() => expect(marcarResuelta).toHaveBeenCalledWith("condicion-101"));
    expect(alActualizar).toHaveBeenCalled();
  });

  it("si resolver falla lo dice y no avisa al padre", async () => {
    const marcarResuelta = jest.fn(async () => ({ ok: false }));
    const alActualizar = jest.fn();
    useCondicionesPaciente.mockReturnValue(estado({ marcarResuelta }));

    render(
      <CondicionesPacienteSeccion pacienteId="p-1" rol="medico" alActualizar={alActualizar} />,
    );
    fireEvent.press(screen.getByText("Resolver"));

    const [, , botones] = Alert.alert.mock.calls[0];
    await botones.find((boton) => boton.text === "Resolver").onPress();

    await waitFor(() => expect(Alert.alert).toHaveBeenCalledTimes(2));
    expect(alActualizar).not.toHaveBeenCalled();
  });
});
