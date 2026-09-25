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
//
// El doble se amplio con la issue #850, que agrega el alta a esta seccion: `campos`, `valores`,
// `catalogos` y el bloque de alta en linea del catalogo. Los descriptores no se inventan, se
// importan de @ecopac/shared, para que un cambio en CAMPOS_CONDICION_CRONICA se note aqui.

import React from "react";
import { Alert } from "react-native";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import {
  CAMPOS_CONDICION_CRONICA,
  OPCIONES_ESTADO_CONDICION,
  useCondicionesPaciente,
} from "@ecopac/shared";

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

const CATALOGO = [
  { value: "cc-1", label: "Hipertensión" },
  { value: "cc-2", label: "Diabetes" },
];

function estado(extra = {}) {
  return {
    condiciones: [CONDICION_ACTIVA],
    campos: CAMPOS_CONDICION_CRONICA,
    valores: { condicion: "", fechaDiagnostico: "", estado: "", notas: "" },
    errores: {},
    errorDeAlta: null,
    cargando: false,
    error: null,
    enviando: false,
    permisos: PERMISOS_DE_MEDICO,
    setCampo: jest.fn(),
    agregar: jest.fn(async () => ({ ok: true })),
    marcarResuelta: jest.fn(async () => ({ ok: true })),
    recargar: jest.fn(),
    catalogos: {
      condicionesCronicas: CATALOGO,
      estadosCondicionCronica: OPCIONES_ESTADO_CONDICION,
    },
    puedeCrearCondicion: true,
    registrarCondicion: jest.fn(async () => ({
      condicion: { id: "cc-3" },
      errores: {},
      error: null,
    })),
    erroresCondicionNueva: {},
    creandoCondicion: false,
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

  it("si resolver falla no avisa al padre ni abre un segundo dialogo", async () => {
    // Issue #762: un error de escritura no se reporta en un dialogo que se cierra y no deja
    // rastro. El motivo lo deja el hook en `errorDeAlta` y se pinta en la tarjeta (prueba de abajo).
    const marcarResuelta = jest.fn(async () => ({ ok: false }));
    const alActualizar = jest.fn();
    useCondicionesPaciente.mockReturnValue(estado({ marcarResuelta }));

    render(
      <CondicionesPacienteSeccion pacienteId="p-1" rol="medico" alActualizar={alActualizar} />,
    );
    fireEvent.press(screen.getByText("Resolver"));

    const [, , botones] = Alert.alert.mock.calls[0];
    await botones.find((boton) => boton.text === "Resolver").onPress();

    await waitFor(() => expect(marcarResuelta).toHaveBeenCalledWith("condicion-101"));
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(alActualizar).not.toHaveBeenCalled();
  });

  it("el motivo de un resolver fallido se ve aunque no se pueda registrar", () => {
    // Quien solo puede resolver no ve el bloque de alta, asi que el error no puede vivir ahi.
    useCondicionesPaciente.mockReturnValue(
      estado({
        permisos: { ...PERMISOS_DE_MEDICO, puedeRegistrar: false },
        errorDeAlta: { mensaje: "No tienes permiso para modificar esta condicion" },
      }),
    );

    render(<CondicionesPacienteSeccion pacienteId="p-1" rol="medico" />);

    expect(screen.queryByText("Agregar una condición")).toBeNull();
    expect(screen.getByText("No tienes permiso para modificar esta condicion")).toBeTruthy();
  });
});

// El alta que la #840 dejo fuera de alcance y que la #850 trae, junto con la de una condicion que
// el catalogo no tiene todavia (migracion 00140).
describe("CondicionesPacienteSeccion: agregar una condicion", () => {
  it("quien puede registrar ve el formulario de alta", () => {
    useCondicionesPaciente.mockReturnValue(estado());

    render(<CondicionesPacienteSeccion pacienteId="p-1" rol="medico" />);

    expect(screen.getByText("Agregar una condición")).toBeTruthy();
    expect(screen.getByText("Agregar condición")).toBeTruthy();
  });

  it("quien no puede registrar no lo ve", () => {
    useCondicionesPaciente.mockReturnValue(
      estado({ permisos: { ...PERMISOS_DE_MEDICO, puedeRegistrar: false } }),
    );

    render(<CondicionesPacienteSeccion pacienteId="p-1" rol="voluntario general" />);

    expect(screen.queryByText("Agregar una condición")).toBeNull();
  });

  it("agregar llama al hook y avisa al padre", async () => {
    const agregar = jest.fn(async () => ({ ok: true }));
    const alActualizar = jest.fn();
    useCondicionesPaciente.mockReturnValue(estado({ agregar }));

    render(
      <CondicionesPacienteSeccion pacienteId="p-1" rol="medico" alActualizar={alActualizar} />,
    );
    fireEvent.press(screen.getByText("Agregar condición"));

    await waitFor(() => expect(agregar).toHaveBeenCalled());
    expect(alActualizar).toHaveBeenCalled();
  });

  it("si el alta falla no avisa al padre", async () => {
    const agregar = jest.fn(async () => ({ ok: false }));
    const alActualizar = jest.fn();
    useCondicionesPaciente.mockReturnValue(estado({ agregar }));

    render(
      <CondicionesPacienteSeccion pacienteId="p-1" rol="medico" alActualizar={alActualizar} />,
    );
    fireEvent.press(screen.getByText("Agregar condición"));

    await waitFor(() => expect(agregar).toHaveBeenCalled());
    expect(alActualizar).not.toHaveBeenCalled();
  });

  it("el error del alta se muestra, en vez de quedarse callado", () => {
    useCondicionesPaciente.mockReturnValue(
      estado({ errorDeAlta: { mensaje: "Esa condicion ya esta en la ficha" } }),
    );

    render(<CondicionesPacienteSeccion pacienteId="p-1" rol="medico" />);

    expect(screen.getByText("Esa condicion ya esta en la ficha")).toBeTruthy();
  });

  it("ofrece crear una condicion que el catalogo no trae, sin salir de la ficha", () => {
    useCondicionesPaciente.mockReturnValue(estado());

    render(<CondicionesPacienteSeccion pacienteId="p-1" rol="medico" />);

    expect(screen.getByText("Crear una condición")).toBeTruthy();
  });

  it("a quien no puede escribir el catalogo no se lo ofrece", () => {
    // La politica de INSERT de la 00140 deja fuera a los roles consultivos; ofrecer el boton
    // seria prometer algo que el servidor rechaza con 42501.
    useCondicionesPaciente.mockReturnValue(estado({ puedeCrearCondicion: false }));

    render(<CondicionesPacienteSeccion pacienteId="p-1" rol="medico" />);

    expect(screen.queryByText("Crear una condición")).toBeNull();
  });

  it("crear una condicion pasa por registrarCondicion, no por otra ruta", async () => {
    const registrarCondicion = jest.fn(async () => ({
      condicion: { id: "cc-3" },
      errores: {},
      error: null,
    }));
    // `notas` va con texto para que el unico campo vacio de la pantalla sea el del alta: es el
    // otro TextField del formulario, y con los dos vacios getByDisplayValue("") no sabe cual es.
    useCondicionesPaciente.mockReturnValue(
      estado({
        registrarCondicion,
        valores: { condicion: "", fechaDiagnostico: "", estado: "", notas: "Sin novedad" },
      }),
    );

    render(<CondicionesPacienteSeccion pacienteId="p-1" rol="medico" />);
    fireEvent.press(screen.getByText("Crear una condición"));
    fireEvent.changeText(screen.getByDisplayValue(""), "Artritis reumatoide");
    fireEvent.press(screen.getByText("Guardar"));

    await waitFor(() => expect(registrarCondicion).toHaveBeenCalledWith("Artritis reumatoide"));
  });
});
