// Pruebas de FichaPacienteScreen (issues #753, #818 y #838).
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
  useCondicionesPaciente: jest.fn(() => ({
    condiciones: [],
    cargando: false,
    error: null,
    errorDeAlta: null,
    errores: {},
    enviando: false,
    permisos: { puedeVer: true, puedeRegistrar: false, puedeEditar: false, puedeQuitar: false },
    valores: {},
    setCampo: jest.fn(),
    agregar: jest.fn(),
    marcarResuelta: jest.fn(),
    recargar: jest.fn(),
    catalogos: { condicionesCronicas: [], estadosCondicionCronica: [] },
  })),
  useVisitasPaciente: jest.fn(() => ({
    visitas: [
      {
        atencionId: "at-1",
        jornadaId: "jor-1",
        jornada: "Jornada Inventada",
        fecha: "2026-09-01",
        signos: { id: "t-1", temperatura: 37 },
        consulta: { id: "c-1", motivoConsulta: "Tos", diagnosticos: [] },
        recetas: [],
        diagnosticoPrincipal: null,
      },
    ],
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
  // Los campos que la fila del listado de busqueda no trae y que la pestania "Datos generales"
  // tiene que mostrar (issue #838).
  telefonoContacto: "55551234",
  nombreResponsable: "Persona Inventada",
  parentescoResponsable: "Madre",
  catalogoIdioma: { nombre: "Español" },
  comunidad: { nombre: "Comunidad Inventada", municipio: { nombre: "Municipio Inventado" } },
  expediente: { numeroFicha: "000123" },
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

    expect(screen.getByText(/No se proporcionó el paciente/)).toBeTruthy();
  });

  // Issue #838: la pestania de datos generales se quitaba de la lista, asi que en movil faltaba
  // la mitad del expediente y solo se podia ver abriendo el formulario de edicion.
  it("la pestania de datos generales muestra lo que la fila del listado no trae", () => {
    montar();

    fireEvent.press(screen.getByText("Datos generales"));

    expect(screen.getByText("Español")).toBeTruthy();
    expect(screen.getByText("Persona Inventada")).toBeTruthy();
    expect(screen.getByText("Madre")).toBeTruthy();
    expect(screen.getByText("Municipio Inventado")).toBeTruthy();
    expect(screen.getByText("000123")).toBeTruthy();
  });

  // Issue #840 (F, G3): dos pestanas, no cuatro. Signos y recetas viven dentro de cada visita.
  it("tiene dos pestanas, y el historial es la lista de visitas con sus partes dentro", () => {
    montar();

    // "Signos vitales" y "Receta" siguen apareciendo, pero como partes de la visita abierta; lo
    // que ya no hay es la pestana "Recetas".
    expect(screen.queryByText("Recetas")).toBeNull();

    fireEvent.press(screen.getByText("Historial clínico"));
    expect(screen.getByText("Signos vitales")).toBeTruthy();
    // Sin diagnostico, la jornada es el titulo de la visita y tambien su linea de lugar.
    expect(screen.getAllByText("Jornada Inventada").length).toBeGreaterThan(0);
    expect(screen.getByText("Motivo: Tos")).toBeTruthy();
    expect(screen.getByText("Sin receta.")).toBeTruthy();
  });

  // No hay "Nuevo triaje": los signos son un paso de la consulta. La pantalla de destino lee
  // `params.pacienteId`: navegar con el objeto entero la dejaba sin paciente.
  it("la unica accion de captura es Nueva consulta, y navega con el id del paciente", () => {
    montar();

    expect(screen.queryByText(/Nuevo Triaje/i)).toBeNull();
    fireEvent.press(screen.getByText("Nueva consulta"));
    expect(navegacion.navigate).toHaveBeenCalledWith("Consulta", { pacienteId: "paciente-123" });
  });

  it("abrir una visita del historial lleva a su consulta, en su jornada", () => {
    montar();

    fireEvent.press(screen.getByText("Historial clínico"));
    fireEvent.press(screen.getByText("Abrir la consulta"));
    expect(navegacion.navigate).toHaveBeenCalledWith("Consulta", {
      pacienteId: "paciente-123",
      jornadaId: "jor-1",
    });
  });
});
