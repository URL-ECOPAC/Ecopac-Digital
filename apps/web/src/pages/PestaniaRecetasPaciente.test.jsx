// Prueba de PestaniaRecetasPaciente (Modulo I: receta, viendo en web, issue #776).
// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

import { contarRecetas } from "@ecopac/shared";

import PestaniaRecetasPaciente from "./PestaniaRecetasPaciente";

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

const RECETA_DE_EJEMPLO = {
  id: "r-1",
  folio: "REC-0001",
  estado: "emitida",
  medicoId: "per-medico",
  createdAt: "2026-01-10T09:00:00Z",
  jornada: "Jornada enero",
  medico: "Perez",
  anulada: false,
  detalle: [
    {
      id: "d-1",
      medicamento: "Loratadina",
      concentracion: "10mg",
      dosis: "1 tableta",
      frecuencia: "cada 12 horas",
      cantidadEntregada: 5,
    },
  ],
};

const mockEstadoHook = {
  recetas: [],
  conteo: contarRecetas([]),
  cargando: false,
  error: null,
  recargar: vi.fn(),
};

const mockAnularReceta = vi.fn();

vi.mock("@ecopac/shared", async (importarOriginal) => ({
  ...(await importarOriginal()),
  useRecetasPaciente: vi.fn(() => mockEstadoHook),
  anularReceta: (...args) => mockAnularReceta(...args),
}));

const { useRecetasPaciente } = await import("@ecopac/shared");

function pantalla({ rol = "medico", perfilId = "per-medico" } = {}) {
  return render(
    <PestaniaRecetasPaciente
      paciente={{ id: "p-1", nombres: "Ana" }}
      rol={rol}
      perfilId={perfilId}
    />,
  );
}

describe("PestaniaRecetasPaciente", () => {
  afterEach(() => {
    mockEstadoHook.recetas = [];
    mockEstadoHook.conteo = contarRecetas([]);
    mockEstadoHook.cargando = false;
    mockEstadoHook.error = null;
    useRecetasPaciente.mockClear();
    mockEstadoHook.recargar.mockClear();
    mockAnularReceta.mockReset();
  });

  it("mientras carga, muestra el estado de carga", () => {
    mockEstadoHook.cargando = true;
    pantalla();

    expect(screen.getByText("Cargando...")).toBeInTheDocument();
  });

  it("sin recetas, muestra el vacio", () => {
    pantalla();

    expect(
      screen.getByText("Este paciente todavia no tiene recetas emitidas."),
    ).toBeInTheDocument();
  });

  it("con una receta, pinta el folio, el conteo y el detalle al expandir", () => {
    mockEstadoHook.recetas = [RECETA_DE_EJEMPLO];
    mockEstadoHook.conteo = contarRecetas([RECETA_DE_EJEMPLO]);
    pantalla();

    expect(screen.getByText("REC-0001")).toBeInTheDocument();
    expect(screen.getByText("1 receta")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Ver detalle"));
    expect(screen.getByText(/Loratadina/)).toBeInTheDocument();
  });

  it("una receta anulada se marca y muestra el motivo", () => {
    const anulada = {
      ...RECETA_DE_EJEMPLO,
      id: "r-2",
      folio: "REC-0002",
      anulada: true,
      anuladaEn: "2026-01-12",
      motivoAnulacion: "Error de digitacion",
    };
    mockEstadoHook.recetas = [anulada];
    mockEstadoHook.conteo = contarRecetas([anulada]);
    pantalla();

    expect(screen.getByText("Receta anulada")).toBeInTheDocument();
    expect(screen.getByText(/Error de digitacion/)).toBeInTheDocument();
  });

  // Camino de error (issue #759/#776): si la consulta de recetas falla, la pantalla tiene que
  // mostrar el error, no el mensaje de "no tiene recetas emitidas" (que diria algo falso).
  it("camino de error: si la consulta falla, muestra el error y no el vacio", () => {
    mockEstadoHook.error = { mensaje: "No se pudieron cargar las recetas." };
    pantalla();

    expect(screen.getByText("No se pudieron cargar las recetas.")).toBeInTheDocument();
    expect(
      screen.queryByText("Este paciente todavia no tiene recetas emitidas."),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Reintentar"));
    expect(mockEstadoHook.recargar).toHaveBeenCalled();
  });

  // issue #756: anularReceta() existia en shared, probada y sin ningun boton que la llamara.
  describe("anular receta", () => {
    it("el medico que firmo su propia receta emitida ve el boton Anular", () => {
      mockEstadoHook.recetas = [RECETA_DE_EJEMPLO];
      mockEstadoHook.conteo = contarRecetas([RECETA_DE_EJEMPLO]);
      pantalla({ rol: "medico", perfilId: "per-medico" });

      expect(screen.getByText("Anular")).toBeInTheDocument();
    });

    it("un medico que no firmo la receta no ve el boton Anular", () => {
      mockEstadoHook.recetas = [RECETA_DE_EJEMPLO];
      mockEstadoHook.conteo = contarRecetas([RECETA_DE_EJEMPLO]);
      pantalla({ rol: "medico", perfilId: "otro-medico" });

      expect(screen.queryByText("Anular")).not.toBeInTheDocument();
    });

    it("pide el motivo, llama a anularReceta y recarga cuando confirma", async () => {
      mockEstadoHook.recetas = [RECETA_DE_EJEMPLO];
      mockEstadoHook.conteo = contarRecetas([RECETA_DE_EJEMPLO]);
      mockAnularReceta.mockResolvedValue({ receta: { id: "r-1" }, error: null });
      pantalla({ rol: "medico", perfilId: "per-medico" });

      fireEvent.click(screen.getByText("Anular"));

      const boton = screen.getByText("Confirmar anulacion");
      expect(boton).toBeDisabled();

      fireEvent.change(screen.getByLabelText("Motivo de la anulacion"), {
        target: { value: "Error de dosis" },
      });
      fireEvent.click(screen.getByText("Confirmar anulacion"));

      await screen.findByText("Anular");
      expect(mockAnularReceta).toHaveBeenCalledWith("r-1", {
        motivo: "Error de dosis",
        anuladaPor: "per-medico",
      });
      expect(mockEstadoHook.recargar).toHaveBeenCalled();
    });

    it("si anularReceta falla, muestra el error y no recarga", async () => {
      mockEstadoHook.recetas = [RECETA_DE_EJEMPLO];
      mockEstadoHook.conteo = contarRecetas([RECETA_DE_EJEMPLO]);
      mockAnularReceta.mockResolvedValue({
        receta: null,
        error: { mensaje: "No se pudo anular la receta." },
      });
      pantalla({ rol: "medico", perfilId: "per-medico" });

      fireEvent.click(screen.getByText("Anular"));
      fireEvent.change(screen.getByLabelText("Motivo de la anulacion"), {
        target: { value: "Error de dosis" },
      });
      fireEvent.click(screen.getByText("Confirmar anulacion"));

      expect(await screen.findByText("No se pudo anular la receta.")).toBeInTheDocument();
      expect(mockEstadoHook.recargar).not.toHaveBeenCalled();
    });

    it("una receta anulada muestra quien la anulo", () => {
      const anulada = {
        ...RECETA_DE_EJEMPLO,
        id: "r-2",
        folio: "REC-0002",
        anulada: true,
        anuladaEn: "2026-01-12",
        anuladaPorNombre: "Dra. Lopez",
        motivoAnulacion: "Error de digitacion",
      };
      mockEstadoHook.recetas = [anulada];
      mockEstadoHook.conteo = contarRecetas([anulada]);
      pantalla();

      expect(screen.getByText(/por Dra\. Lopez/)).toBeInTheDocument();
    });
  });
});
