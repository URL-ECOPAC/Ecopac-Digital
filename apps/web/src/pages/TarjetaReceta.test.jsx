// Prueba de TarjetaReceta: una receta con su detalle, su impresion y su anulacion.
// @vitest-environment jsdom
//
// La tarjeta vivia dentro de PestaniaRecetasPaciente (issues #756, #776), la pestana hermana del
// historial que la #840 retira: ahora cada receta se ve dentro de su visita. Las pruebas de anular
// y de mostrar la anulacion se conservan tal cual, porque lo que hace la tarjeta no cambio.

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

import TarjetaReceta from "./TarjetaReceta";

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

function pantalla({ receta = RECETA_DE_EJEMPLO, puedeAnular = true, onAnular = vi.fn() } = {}) {
  const onImprimir = vi.fn();
  render(
    <TarjetaReceta
      receta={receta}
      onImprimir={onImprimir}
      puedeAnular={puedeAnular}
      onAnular={onAnular}
    />,
  );
  return { onImprimir, onAnular };
}

describe("TarjetaReceta", () => {
  it("pinta el folio y muestra el detalle al expandir", () => {
    pantalla();

    expect(screen.getByText("REC-0001")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Ver detalle"));
    expect(screen.getByText(/Loratadina/)).toBeInTheDocument();
  });

  it("imprimir entrega la receta a quien la imprime", () => {
    const { onImprimir } = pantalla();

    fireEvent.click(screen.getByText("Imprimir o guardar PDF"));
    expect(onImprimir).toHaveBeenCalledWith(RECETA_DE_EJEMPLO);
  });

  it("una receta anulada se marca y dice quien la anulo y por que", () => {
    pantalla({
      receta: {
        ...RECETA_DE_EJEMPLO,
        anulada: true,
        anuladaEn: "2026-01-12",
        anuladaPorNombre: "Dra. Lopez",
        motivoAnulacion: "Error de digitacion",
      },
    });

    expect(screen.getByText("Receta anulada")).toBeInTheDocument();
    expect(screen.getByText(/por Dra\. Lopez/)).toBeInTheDocument();
    expect(screen.getByText(/Error de digitacion/)).toBeInTheDocument();
    expect(screen.queryByText("Anular")).not.toBeInTheDocument();
  });

  it("sin permiso no ofrece anular", () => {
    pantalla({ puedeAnular: false });
    expect(screen.queryByText("Anular")).not.toBeInTheDocument();
  });

  it("pide el motivo antes de anular y lo entrega", async () => {
    const onAnular = vi.fn().mockResolvedValue({ error: null });
    pantalla({ onAnular });

    fireEvent.click(screen.getByText("Anular"));
    expect(screen.getByText("Confirmar anulacion").closest("button")).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Motivo de la anulacion"), {
      target: { value: "Error de dosis" },
    });
    fireEvent.click(screen.getByText("Confirmar anulacion"));

    await screen.findByText("Anular");
    expect(onAnular).toHaveBeenCalledWith("r-1", "Error de dosis");
  });

  it("si anular falla, muestra el error", async () => {
    const onAnular = vi.fn().mockResolvedValue({ error: { mensaje: "No se pudo anular." } });
    pantalla({ onAnular });

    fireEvent.click(screen.getByText("Anular"));
    fireEvent.change(screen.getByLabelText("Motivo de la anulacion"), {
      target: { value: "Error de dosis" },
    });
    fireEvent.click(screen.getByText("Confirmar anulacion"));

    expect(await screen.findByText("No se pudo anular.")).toBeInTheDocument();
  });
});
