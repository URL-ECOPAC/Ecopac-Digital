// Prueba de ModalSalidaMedicamento (Modulo II: salida, issue #777).
// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

import { ModalSalidaMedicamento } from "./ModalSalidaMedicamento";

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

const MEDICAMENTOS = [{ id: "med-1", nombre: "Loratadina", concentracion: "10mg" }];

const LOTE_DE_EJEMPLO = {
  loteId: "lote-1",
  numeroLote: "LOTE-1",
  bodega: "Bodega Principal",
  fechaVencimiento: "2027-01-01",
  cantidadDisponible: 40,
};

const mockEstadoHook = {
  motivos: [
    { value: "entrega", label: "Entrega a paciente" },
    { value: "traslado", label: "Traslado entre bodegas" },
  ],
  motivo: "",
  setMotivo: vi.fn(),
  bodegasDestino: [{ value: "b-2", label: "Botiquin Norte" }],
  bodegaDestinoId: "",
  setBodegaDestinoId: vi.fn(),
  medicamentoId: "",
  setMedicamentoId: vi.fn(),
  loteSeleccionado: null,
  seleccionarLote: vi.fn(),
  claveLoteSeleccionado: "",
  seleccionarLotePorClave: vi.fn(),
  cantidad: "",
  setCantidad: vi.fn(),
  lotesDisponibles: [],
  sinExistencia: false,
  avisoCantidad: null,
  puedeGuardar: false,
  error: null,
  cargando: false,
  guardarSalida: vi.fn((evento) => evento?.preventDefault?.()),
};

vi.mock("../../../../packages/shared/inventario/useRegistroSalida", () => ({
  MOTIVO_TRASLADO: "traslado",
  claveDeLoteDeSalida: (lote) => (lote ? `${lote.loteId}|${lote.bodegaId ?? ""}` : ""),
  motivosDeSalida: () => [],
  useRegistroSalida: vi.fn(() => mockEstadoHook),
}));

const { useRegistroSalida } =
  await import("../../../../packages/shared/inventario/useRegistroSalida");

function pantalla(props = {}) {
  return render(
    <ModalSalidaMedicamento
      abierto
      onClose={vi.fn()}
      medicamentos={MEDICAMENTOS}
      usuarioId="u-1"
      {...props}
    />,
  );
}

describe("ModalSalidaMedicamento", () => {
  afterEach(() => {
    mockEstadoHook.medicamentoId = "";
    mockEstadoHook.lotesDisponibles = [];
    mockEstadoHook.loteSeleccionado = null;
    mockEstadoHook.sinExistencia = false;
    mockEstadoHook.avisoCantidad = null;
    mockEstadoHook.puedeGuardar = false;
    mockEstadoHook.error = null;
    mockEstadoHook.cargando = false;
    useRegistroSalida.mockClear();
    mockEstadoHook.guardarSalida.mockClear();
  });

  it("cerrado (abierto=false) no renderiza nada", () => {
    pantalla({ abierto: false });

    expect(screen.queryByText("Registro de Salida de Medicamentos")).not.toBeInTheDocument();
  });

  it("pinta el formulario con los motivos y los medicamentos del catalogo", () => {
    pantalla();

    expect(screen.getByText("Entrega a paciente")).toBeInTheDocument();
    expect(screen.getByText("Loratadina (10mg)")).toBeInTheDocument();
    // La bodega destino solo aparece en un traslado (00179).
    expect(screen.queryByLabelText(/Bodega destino/)).not.toBeInTheDocument();
  });

  it("un traslado pide la bodega destino (00179)", () => {
    mockEstadoHook.motivo = "traslado";
    pantalla();
    expect(screen.getByLabelText(/Bodega destino/)).toBeInTheDocument();
    expect(screen.getByText("Botiquin Norte")).toBeInTheDocument();
    mockEstadoHook.motivo = "";
  });

  it("con lotes disponibles, el selector de lote FEFO los lista", () => {
    mockEstadoHook.lotesDisponibles = [LOTE_DE_EJEMPLO];
    pantalla();

    expect(screen.getByText(/Lote: LOTE-1/)).toBeInTheDocument();
  });

  // Issue #859: vista_lotes_disponibles (00047) excluye un lote sin existencias (ingreso todavia
  // pendiente de aprobacion, 00107), vencido, o agotado; sin este aviso la lista salia vacia sin
  // decir por que. Issue #911: el aviso dice que no hay existencia y el boton no se habilita.
  it("sin existencia, lo dice y no deja registrar la salida", () => {
    mockEstadoHook.medicamentoId = "med-1";
    mockEstadoHook.sinExistencia = true;
    pantalla();

    expect(screen.getByText(/No hay existencia de este medicamento/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Registrar salida/ })).toBeDisabled();
  });

  it("sin medicamento elegido todavia, no muestra el aviso de existencia", () => {
    pantalla();

    expect(screen.queryByText(/No hay existencia de este medicamento/)).not.toBeInTheDocument();
  });

  it("si la cantidad no alcanza, lo dice debajo y no deja registrar", () => {
    mockEstadoHook.lotesDisponibles = [LOTE_DE_EJEMPLO];
    mockEstadoHook.loteSeleccionado = LOTE_DE_EJEMPLO;
    mockEstadoHook.avisoCantidad = "No hay existencia suficiente: el lote tiene 40 disponibles.";
    pantalla();

    expect(screen.getByText(/el lote tiene 40 disponibles/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Registrar salida/ })).toBeDisabled();
  });

  it("con todo listo, Registrar salida se habilita", () => {
    mockEstadoHook.puedeGuardar = true;
    pantalla();

    expect(screen.getByRole("button", { name: /Registrar salida/ })).toBeEnabled();
  });

  it("enviar el formulario dispara guardarSalida()", () => {
    pantalla();

    // El Modal del catalogo se monta en un portal sobre document.body, no dentro del contenedor.
    fireEvent.submit(document.querySelector("form"));

    expect(mockEstadoHook.guardarSalida).toHaveBeenCalled();
  });

  // Issue #859: el modal llamaba useRegistroSalida({ usuarioId, onExito: onClose }) directo, asi
  // que una salida exitosa solo cerraba el modal -sin avisarle a InventarioPage que volviera a
  // pedir lotesRaw/existenciasRaw-. La salida SI descontaba el stock en la base (para
  // administracion, en el acto; para medico y voluntario, al aprobarse), pero la pantalla seguia
  // mostrando los numeros de antes de abrir el modal. onExito ahora se encadena: primero el aviso
  // al padre, despues el cierre.
  it("al terminar con exito, avisa a onExito (para recargar datos) y despues cierra con onClose", () => {
    const onExito = vi.fn();
    const onClose = vi.fn();
    pantalla({ onExito, onClose });

    const opciones = useRegistroSalida.mock.calls.at(-1)[0];
    opciones.onExito({ id: "mov-1" });

    expect(onExito).toHaveBeenCalledWith({ id: "mov-1" });
    expect(onClose).toHaveBeenCalled();
    expect(onExito.mock.invocationCallOrder[0]).toBeLessThan(onClose.mock.invocationCallOrder[0]);
  });

  it("sin onExito del padre, terminar con exito igual cierra el modal", () => {
    const onClose = vi.fn();
    pantalla({ onClose });

    const opciones = useRegistroSalida.mock.calls.at(-1)[0];
    expect(() => opciones.onExito({ id: "mov-1" })).not.toThrow();

    expect(onClose).toHaveBeenCalled();
  });

  // El boton es el PrimaryButton del catalogo: mientras carga muestra el indicador de espera
  // (aria-busy) en vez de cambiar el texto a mano.
  it("mientras carga, Registrar salida esta deshabilitado y ocupado", () => {
    mockEstadoHook.cargando = true;
    pantalla();

    const boton = screen.getByRole("button", { busy: true });
    expect(boton).toBeDisabled();
    expect(boton).toHaveAttribute("type", "submit");
  });

  // Camino de error (issue #759/#777): si guardarSalida() falla, el modal se queda abierto con
  // el error visible, no se cierra como si hubiera funcionado.
  it("camino de error: si la consulta falla, muestra el error y el modal sigue abierto", () => {
    mockEstadoHook.error = "La cantidad solicitada supera la existencia disponible.";
    pantalla();

    expect(
      screen.getByText("La cantidad solicitada supera la existencia disponible."),
    ).toBeInTheDocument();
    expect(screen.getByText("Registro de Salida de Medicamentos")).toBeInTheDocument();
  });
});
