import { describe, expect, it } from "vitest";

import { estadoDeLaCarga } from "./useCargaDeBodegaDeJornada.js";
import { opcionesDeBodegaDeDevolucion } from "./useDevolucionDeBodegaDeJornada.js";

const LOTE = { loteId: "l-1", bodegaId: "b-1", bodega: "Bodega Principal", cantidadDisponible: 30 };

describe("estadoDeLaCarga", () => {
  it("con lote y una cantidad que hay, se puede guardar", () => {
    expect(
      estadoDeLaCarga({ medicamentoId: "m-1", lote: LOTE, cantidad: "20", lotesDeOrigen: [LOTE] }),
    ).toEqual({ sinExistencia: false, avisoCantidad: null, puedeGuardar: true });
  });

  it("dice cuando no hay existencia del articulo en ninguna otra bodega", () => {
    expect(estadoDeLaCarga({ medicamentoId: "m-1", lotesDeOrigen: [] })).toMatchObject({
      sinExistencia: true,
      puedeGuardar: false,
    });
  });

  it("avisa si se pide mas de lo que tiene el lote en su bodega", () => {
    const estado = estadoDeLaCarga({ medicamentoId: "m-1", lote: LOTE, cantidad: 31 });
    expect(estado.avisoCantidad).toBe(
      "No hay existencia suficiente: el lote tiene 30 en Bodega Principal.",
    );
    expect(estado.puedeGuardar).toBe(false);
  });

  it("no acepta cero, negativos ni fracciones", () => {
    for (const cantidad of ["0", "-2", "1.5"]) {
      expect(estadoDeLaCarga({ medicamentoId: "m-1", lote: LOTE, cantidad }).puedeGuardar).toBe(
        false,
      );
    }
  });

  it("mientras carga los lotes no dice que no hay existencia", () => {
    expect(estadoDeLaCarga({ medicamentoId: "m-1", cargando: true }).sinExistencia).toBe(false);
  });
});

describe("opcionesDeBodegaDeDevolucion", () => {
  it("ofrece solo bodegas fijas, la principal primero", () => {
    expect(
      opcionesDeBodegaDeDevolucion([
        { id: "b1", nombre: "Bodega Norte", esMovil: false },
        { id: "b2", nombre: "Botiquin A", esMovil: true },
        { id: "b3", nombre: "Bodega Principal", esMovil: false, esPrincipal: true },
      ]),
    ).toEqual([
      { value: "b3", label: "Bodega Principal" },
      { value: "b1", label: "Bodega Norte" },
    ]);
    expect(opcionesDeBodegaDeDevolucion(null)).toEqual([]);
  });
});
