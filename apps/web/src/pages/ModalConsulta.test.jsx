// Prueba de ModalConsulta: la consulta como unidad (issue #840, bloque F) y un solo formulario para
// crear y editar (regla B1).
// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

import { CAMPOS_TRIAJE, NIVELES_DE_AVISO, seccionesConCampos } from "@ecopac/shared";

import ModalConsulta from "./ModalConsulta";

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

function estadoDeConsulta(cambios = {}) {
  return {
    visita: null,
    esNueva: true,
    jornadaId: "j-1",
    bloqueo: { puede: true, motivo: null },
    permisos: { signos: true, consulta: true, receta: true },
    camposDeSignos: CAMPOS_TRIAJE,
    signos: Object.fromEntries(CAMPOS_TRIAJE.map((campo) => [campo.id, ""])),
    setSigno: vi.fn(),
    avisos: {},
    imc: null,
    signosTomadosPor: null,
    seccionesDeConsulta: seccionesConCampos(),
    consulta: { motivoConsulta: "", diagnosticos: [] },
    setCampoDeConsulta: vi.fn(),
    catalogos: { diagnosticos: [] },
    crearDiagnosticoNuevo: null,
    errorDiagnostico: null,
    errores: { signos: {}, consulta: {} },
    error: null,
    enviando: false,
    guardadaAlMenosUnaVez: false,
    guardar: vi.fn().mockResolvedValue({ ok: true }),
    descartarBorrador: vi.fn(),
    hayCambios: true,
    receta: { existentes: [], consultaId: null, puedeAgregar: false },
    ...cambios,
  };
}

let mockEstado = estadoDeConsulta();

vi.mock("@ecopac/shared", async (importarOriginal) => ({
  ...(await importarOriginal()),
  useConsulta: vi.fn(() => mockEstado),
  useCapturaClinica: vi.fn(() => ({
    jornadas: [],
    jornadaId: "j-1",
    jornada: { id: "j-1", estado: "en curso" },
    opcionesDeJornada: [],
    elegirJornada: vi.fn(),
    hayJornadaEnCurso: true,
    motivo: null,
    cargando: false,
    error: null,
  })),
}));

vi.mock("./ModalGeneracionReceta", () => ({ default: () => <div>emitir receta</div> }));
vi.mock("./SelectorDeJornada", () => ({ default: () => <div>selector de jornada</div> }));

const PACIENTE = { id: "p-1", fechaNacimiento: "1990-01-01", expediente: { id: "e-1" } };

function pantalla(props = {}) {
  return render(
    <ModalConsulta paciente={PACIENTE} rol="medico" perfilId="m-1" onClose={vi.fn()} {...props} />,
  );
}

function rotulosDeCampos() {
  return [...document.querySelectorAll("label")].map((label) => label.textContent.trim()).sort();
}

describe("ModalConsulta", () => {
  afterEach(() => {
    mockEstado = estadoDeConsulta();
  });

  it("dentro de la consulta van los signos, la consulta y la receta", () => {
    pantalla();

    expect(screen.getByText("Nueva consulta")).toBeInTheDocument();
    expect(screen.getByText("1. Signos vitales")).toBeInTheDocument();
    expect(screen.getByText("2. Consulta")).toBeInTheDocument();
    expect(screen.getByText("3. Receta")).toBeInTheDocument();
    expect(screen.getByText("selector de jornada")).toBeInTheDocument();
  });

  // B1: "el formulario para crear o editar algo debe ser igual".
  it("editar una visita muestra exactamente los mismos campos que crearla", () => {
    pantalla();
    const alCrear = rotulosDeCampos();
    cleanup();

    mockEstado = estadoDeConsulta({
      esNueva: false,
      visita: { atencionId: "at-1", fecha: "2026-01-10", jornada: "Jornada enero" },
    });
    pantalla({ visita: mockEstado.visita });
    const alEditar = rotulosDeCampos();

    expect(alEditar).toEqual(alCrear);
    expect(screen.queryByText("selector de jornada")).not.toBeInTheDocument();
  });

  // G2: una sola capa por campo. Un valor imposible se ve como error, no como alarma.
  it("un signo imposible se muestra como error y no ademas como alarma", () => {
    mockEstado = estadoDeConsulta({
      avisos: {
        presionSistolica: { nivel: NIVELES_DE_AVISO.IMPOSIBLE, mensaje: "Fuera de lo posible." },
        frecuenciaCardiaca: { nivel: NIVELES_DE_AVISO.ALARMA, mensaje: "Valor de alarma." },
      },
    });
    pantalla();

    expect(screen.getAllByText("Fuera de lo posible.")).toHaveLength(1);
    expect(screen.getByText("Valor de alarma.")).toHaveClass("ec-aviso-alarma");
  });

  it("la receta se ofrece sobre la consulta guardada, y abre su flujo", () => {
    mockEstado = estadoDeConsulta({
      hayCambios: false,
      receta: { existentes: [], consultaId: "con-1", puedeAgregar: true },
    });
    pantalla();

    fireEvent.click(screen.getByText("Agregar receta"));
    expect(screen.getByText("emitir receta")).toBeInTheDocument();
  });

  it("sin consulta guardada, dice que primero hay que guardarla", () => {
    pantalla();
    expect(screen.getByText(/Primero guarda la consulta/)).toBeInTheDocument();
  });

  it("un voluntario toma signos, y la consulta le aparece de solo lectura con el motivo", () => {
    mockEstado = estadoDeConsulta({ permisos: { signos: true, consulta: false, receta: false } });
    pantalla();

    expect(screen.getByText("La consulta la registra el personal medico.")).toBeInTheDocument();
    expect(screen.getByLabelText(/Motivo de consulta/)).toBeDisabled();
  });

  it("Guardar consulta llama a guardar", () => {
    pantalla();
    fireEvent.click(screen.getByText("Guardar consulta"));
    expect(mockEstado.guardar).toHaveBeenCalled();
  });
});
