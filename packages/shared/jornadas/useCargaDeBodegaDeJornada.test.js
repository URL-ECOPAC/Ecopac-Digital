import { describe, expect, it } from "vitest";

import {
  conJornadaDeOrigen,
  estadoDeLaCarga,
  mensajeDeCargaSinExistencia,
} from "./useCargaDeBodegaDeJornada.js";
import { lotesDevolviblesDeJornada } from "./useInsumosDeJornada.js";
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

// Issue #925 (B08): sin lotes que cargar, no es lo mismo "no hay" que "lo que hay esta vencido".
describe("mensajeDeCargaSinExistencia", () => {
  it("si lo que hay esta vencido, lo dice y no manda a registrarlo de nuevo", () => {
    expect(mensajeDeCargaSinExistencia({ vencida: true })).toMatch(/vencido/);
    expect(mensajeDeCargaSinExistencia({ vencida: true })).not.toMatch(/regístrala/);
  });

  it("si no hay nada, manda a registrarlo en Inventario", () => {
    expect(mensajeDeCargaSinExistencia()).toMatch(/regístrala primero en Inventario/);
  });
});

// 3B (00186): cargar desde la bodega de otra jornada en curso queda registrado en las dos.
describe("conJornadaDeOrigen", () => {
  it("nombra la jornada en curso que tiene la bodega del lote", () => {
    const [lote] = conJornadaDeOrigen([LOTE], { "b-1": { id: "j-9", nombre: "Visita norte" } });
    expect(lote.jornadaDeOrigen).toEqual({ id: "j-9", nombre: "Visita norte" });
  });

  it("una bodega fija o libre no tiene jornada de origen", () => {
    expect(conJornadaDeOrigen([LOTE], {})[0].jornadaDeOrigen).toBeNull();
  });
});

// 2A (00186): se devuelve solo lo que le queda a la jornada, no lo que hay en la bodega.
describe("lotesDevolviblesDeJornada", () => {
  const contenido = [
    { loteId: "l-1", cantidadDisponible: 30 },
    { loteId: "l-2", cantidadDisponible: 10 },
    { loteId: "l-3", cantidadDisponible: 5, vencido: true },
  ];

  it("recorta cada lote a lo que le queda a la jornada", () => {
    const lotes = lotesDevolviblesDeJornada(contenido, [
      { loteId: "l-1", queda: 12 },
      { loteId: "l-3", queda: 5 },
    ]);
    expect(lotes).toEqual([{ loteId: "l-1", cantidadDisponible: 12 }]);
  });

  it("sin consumo de la jornada no hay nada que devolver", () => {
    expect(lotesDevolviblesDeJornada(contenido, [])).toEqual([]);
  });
});
