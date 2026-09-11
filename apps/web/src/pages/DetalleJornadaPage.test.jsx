// Prueba de DetalleJornadaPage (Modulo III: cerrar jornada, issue #778).
//
// La pantalla tiene varias pestañas (Resumen, Equipo, Turnos, Pacientes, Historial, Cierre); esta
// prueba se concentra en "Cierre" -- lo que #778 pide como "cerrar jornada" -- y en la carga
// inicial. Las demas pestañas ya tienen su propia superficie cubierta por otras pruebas de este
// modulo (ModalAsignarPersonal.test.jsx, ModalJornada.test.jsx).
// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";
import { MemoryRouter } from "react-router-dom";

import DetalleJornadaPage from "./DetalleJornadaPage";

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importarOriginal) => ({
  ...(await importarOriginal()),
  useNavigate: () => mockNavigate,
  useParams: () => ({ id: "jor-1" }),
}));

vi.mock("../contexto/SesionProvider", () => ({
  useSesionCompartida: () => ({ rol: "administrador" }),
}));

const JORNADA_EN_CURSO = {
  id: "jor-1",
  nombre: "Jornada Vista Hermosa",
  fecha: "2026-03-01",
  comunidad: { nombre: "Vista Hermosa" },
  estado: "en curso",
  personal: [],
};

const mockEstadoDetalle = {
  jornada: JORNADA_EN_CURSO,
  historial: [],
  pacientesAtendidos: [],
  cargando: false,
  error: null,
  recargar: vi.fn(),
  recargarPersonal: vi.fn(),
  permisos: {
    puedeVer: true,
    puedeCrear: true,
    puedeEditar: true,
    puedeReabrir: true,
    puedeVerHistorial: true,
    puedeVerDatosClinicos: true,
  },
  destinos: ["finalizada"],
  cambiarEstado: vi.fn(),
  moviendo: false,
  errorMovimiento: null,
  descartarErrorMovimiento: vi.fn(),
};

const mockEstadoCuadroTurnos = {
  advertencias: {},
  asignacionesDelDia: {},
  errorAdvertencias: null,
};

const mockEstadoCierre = {
  resumen: {
    indicadores: { pacientesAtendidos: 12, consultasRealizadas: 10, tratamientosEntregados: 8 },
    atencionesIncompletas: 0,
    movimientosPendientes: 0,
  },
  cargando: false,
  hayAdvertencias: false,
  confirmarCierre: vi.fn(async () => ({ ok: true })),
  confirmando: false,
  errorCierre: null,
};

vi.mock("@ecopac/shared", async (importarOriginal) => ({
  ...(await importarOriginal()),
  useDetalleJornada: vi.fn(() => mockEstadoDetalle),
  useCuadroTurnos: vi.fn(() => mockEstadoCuadroTurnos),
  useResumenCierreJornada: vi.fn(() => mockEstadoCierre),
}));

const { useDetalleJornada, useResumenCierreJornada } = await import("@ecopac/shared");

function pantalla() {
  return render(
    <MemoryRouter>
      <DetalleJornadaPage />
    </MemoryRouter>,
  );
}

function irAPestaniaCierre() {
  fireEvent.click(screen.getByText("Cierre"));
}

describe("DetalleJornadaPage", () => {
  afterEach(() => {
    mockEstadoDetalle.jornada = JORNADA_EN_CURSO;
    mockEstadoDetalle.cargando = false;
    mockEstadoDetalle.error = null;
    mockEstadoCierre.resumen = {
      indicadores: { pacientesAtendidos: 12, consultasRealizadas: 10, tratamientosEntregados: 8 },
      atencionesIncompletas: 0,
      movimientosPendientes: 0,
    };
    mockEstadoCierre.hayAdvertencias = false;
    mockEstadoCierre.errorCierre = null;
    mockEstadoCierre.confirmando = false;
    mockEstadoCierre.confirmarCierre = vi.fn(async () => ({ ok: true }));
    useDetalleJornada.mockClear();
    useResumenCierreJornada.mockClear();
  });

  it("mientras carga sin jornada previa, muestra el estado de carga", () => {
    mockEstadoDetalle.jornada = null;
    mockEstadoDetalle.cargando = true;
    pantalla();

    expect(screen.getByText("Cargando...")).toBeInTheDocument();
  });

  it("sin jornada (no existe o RLS la esconde), muestra la pagina de no encontrado", () => {
    mockEstadoDetalle.jornada = null;
    pantalla();

    expect(screen.getByText(/no existe/i)).toBeInTheDocument();
  });

  it("con jornada, pinta el encabezado con nombre, fecha y comunidad", () => {
    pantalla();

    expect(screen.getByText("Jornada Vista Hermosa")).toBeInTheDocument();
    expect(screen.getByText("01/03/2026 · Vista Hermosa")).toBeInTheDocument();
  });

  it("la pestaña Cierre muestra los indicadores del resumen de cierre", () => {
    pantalla();
    irAPestaniaCierre();

    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("Consultas registradas")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
  });

  it("sin advertencias y en curso, muestra el aviso de que todo esta completo", () => {
    pantalla();
    irAPestaniaCierre();

    expect(
      screen.getByText("No hay atenciones sin consulta ni movimientos pendientes de validar."),
    ).toBeInTheDocument();
  });

  it("con atenciones sin consulta, avisa la cantidad sin bloquear el cierre", () => {
    mockEstadoCierre.resumen = {
      ...mockEstadoCierre.resumen,
      atencionesIncompletas: 3,
    };
    mockEstadoCierre.hayAdvertencias = true;
    pantalla();
    irAPestaniaCierre();

    expect(
      screen.getByText("Hay 3 atenciones registradas sin consulta todavia."),
    ).toBeInTheDocument();
    expect(screen.getByText("Confirmar cierre")).toBeInTheDocument();
  });

  it("un rol sin acceso a datos clinicos ve el aviso de que no se pudo comprobar, no un cero enganoso", () => {
    mockEstadoCierre.resumen = { ...mockEstadoCierre.resumen, atencionesIncompletas: null };
    pantalla();
    irAPestaniaCierre();

    expect(
      screen.getByText(/No se pudo comprobar si hay atenciones sin consulta/),
    ).toBeInTheDocument();
  });

  it("Confirmar cierre dispara confirmarCierre()", () => {
    pantalla();
    irAPestaniaCierre();

    fireEvent.click(screen.getByText("Confirmar cierre"));

    expect(mockEstadoCierre.confirmarCierre).toHaveBeenCalled();
  });

  it("una jornada finalizada ya no ofrece Confirmar cierre", () => {
    mockEstadoDetalle.jornada = { ...JORNADA_EN_CURSO, estado: "finalizada" };
    pantalla();
    irAPestaniaCierre();

    expect(screen.queryByText("Confirmar cierre")).not.toBeInTheDocument();
  });

  // Camino de error, carga (issue #759/#778): si la jornada no carga, se muestra el error con
  // boton de reintentar.
  it("camino de error: si la jornada no carga, muestra el error con boton de reintentar", () => {
    mockEstadoDetalle.jornada = null;
    mockEstadoDetalle.error = { mensaje: "No se pudo cargar la jornada." };
    pantalla();

    expect(screen.getByText("No se pudo cargar la jornada.")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Reintentar"));
    expect(mockEstadoDetalle.recargar).toHaveBeenCalled();
  });

  // Camino de error, cierre (issue #759/#778): si confirmarCierre() falla, el error se muestra
  // en la propia pestaña, sin cambiar de estado en silencio.
  it("camino de error: si confirmarCierre() falla, muestra el error de cierre", () => {
    mockEstadoCierre.errorCierre = "No se pudo confirmar el cierre de la jornada.";
    pantalla();
    irAPestaniaCierre();

    expect(screen.getByText("No se pudo confirmar el cierre de la jornada.")).toBeInTheDocument();
  });
});
