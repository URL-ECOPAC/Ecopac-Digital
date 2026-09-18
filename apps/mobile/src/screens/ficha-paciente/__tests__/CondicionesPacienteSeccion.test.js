// Prueba de CondicionesPacienteSeccion (issue #838).
//
// La version anterior de esta prueba mockeaba `useCondicionesCronicas` y
// `actualizarCondicionCronica`, dos nombres que @ecopac/shared NUNCA exporto: por eso pasaba en
// verde mientras la pestana, en un telefono de verdad, no mostraba ni una sola condicion. El
// mock es lo unico que sostenia la ilusion. Ahora se mockea el hook que existe,
// useCondicionesPaciente, con la forma que de verdad devuelve.

import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";

import CondicionesPacienteSeccion from "../CondicionesPacienteSeccion";

const mockUseCondicionesPaciente = jest.fn();

jest.mock("@ecopac/shared", () => ({
  ...jest.requireActual("@ecopac/shared"),
  useCondicionesPaciente: (...argumentos) => mockUseCondicionesPaciente(...argumentos),
}));

const marcarResuelta = jest.fn(async () => ({ ok: true }));
const agregar = jest.fn(async () => ({ ok: true }));
const recargar = jest.fn();
const setCampo = jest.fn();

// obtenerCondicionesDelPaciente() devuelve el nombre en `condicion`, no en `nombre`.
const CONDICION_ACTIVA = {
  id: "padecimiento-101",
  condicion: "Hipertensión arterial",
  estado: "activa",
  fechaDiagnostico: "2024-03-01",
  notas: "Toma medicación diaria",
};

function estado(cambios = {}) {
  return {
    condiciones: [CONDICION_ACTIVA],
    cargando: false,
    error: null,
    errorDeAlta: null,
    errores: {},
    enviando: false,
    permisos: { puedeVer: true, puedeRegistrar: true, puedeEditar: true, puedeQuitar: true },
    valores: {},
    setCampo,
    agregar,
    marcarResuelta,
    recargar,
    catalogos: { condicionesCronicas: [], estadosCondicionCronica: [] },
    ...cambios,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseCondicionesPaciente.mockReturnValue(estado());
});

describe("CondicionesPacienteSeccion", () => {
  it("consulta el hook que existe, con el paciente y el rol", () => {
    render(<CondicionesPacienteSeccion pacienteId="paciente-1" rol="medico" />);

    expect(mockUseCondicionesPaciente).toHaveBeenCalledWith("paciente-1", { rol: "medico" });
  });

  it("muestra cada condicion con su nombre y su estado", () => {
    render(<CondicionesPacienteSeccion pacienteId="paciente-1" rol="medico" />);

    expect(screen.getByText("Hipertensión arterial · Activa")).toBeTruthy();
    expect(screen.getByText("Toma medicación diaria")).toBeTruthy();
  });

  it("sin condiciones lo dice, en vez de dejar la tarjeta vacia", () => {
    mockUseCondicionesPaciente.mockReturnValue(estado({ condiciones: [] }));
    render(<CondicionesPacienteSeccion pacienteId="paciente-1" rol="medico" />);

    expect(screen.getByText("Sin condiciones crónicas registradas.")).toBeTruthy();
  });

  it("Resolver llama a marcarResuelta con el id del padecimiento y avisa a la ficha", async () => {
    const alActualizar = jest.fn();
    render(
      <CondicionesPacienteSeccion
        pacienteId="paciente-1"
        rol="medico"
        alActualizar={alActualizar}
      />,
    );

    fireEvent.press(screen.getByText("Resolver"));

    await waitFor(() => expect(marcarResuelta).toHaveBeenCalledWith("padecimiento-101"));
    expect(alActualizar).toHaveBeenCalled();
  });

  it("un rol que no puede editar no ve Resolver ni el alta", () => {
    mockUseCondicionesPaciente.mockReturnValue(
      estado({
        permisos: { puedeVer: true, puedeRegistrar: false, puedeEditar: false, puedeQuitar: false },
      }),
    );
    render(<CondicionesPacienteSeccion pacienteId="paciente-1" rol="voluntario general" />);

    expect(screen.queryByText("Resolver")).toBeNull();
    expect(screen.queryByText("Agregar condición")).toBeNull();
  });

  it("deja agregar una condicion sin salir de la ficha (issue #838)", () => {
    render(<CondicionesPacienteSeccion pacienteId="paciente-1" rol="medico" />);

    fireEvent.press(screen.getByText("Agregar condición"));

    expect(screen.getByText("Condición")).toBeTruthy();
    expect(screen.getByText("Fecha de diagnóstico")).toBeTruthy();
  });

  it("propaga el error de carga con su boton de reintentar", () => {
    mockUseCondicionesPaciente.mockReturnValue(
      estado({ error: { mensaje: "No se pudieron cargar las condiciones." } }),
    );
    render(<CondicionesPacienteSeccion pacienteId="paciente-1" rol="medico" />);

    expect(screen.getByText("No se pudieron cargar las condiciones.")).toBeTruthy();
    fireEvent.press(screen.getByText("Reintentar"));
    expect(recargar).toHaveBeenCalled();
  });
});
