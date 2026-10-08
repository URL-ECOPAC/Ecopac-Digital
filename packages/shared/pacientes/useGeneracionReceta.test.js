import { describe, expect, it } from "vitest";

import {
  anotarDisponibilidad,
  describirExistencia,
  describirReparto,
  renglonIncompleto,
  repartirEntreLotes,
} from "./useGeneracionReceta.js";

const CATALOGO = [
  {
    id: "m-1",
    nombre: "Amoxicilina",
    concentracion: "500 mg",
    presentacion: "capsula",
    marca: "X",
  },
  { id: "m-2", nombre: "Ibuprofeno", concentracion: "400 mg", presentacion: "tableta" },
];

describe("anotarDisponibilidad", () => {
  it("marca seleccionable solo lo que tiene existencia", () => {
    const anotado = anotarDisponibilidad(CATALOGO, [
      { medicamentoId: "m-1", cantidadDisponible: 20, fechaVencimientoProxima: "2027-01-01" },
    ]);

    expect(anotado[0].seleccionable).toBe(true);
    expect(anotado[0].cantidadDisponible).toBe(20);
    expect(anotado[1].seleccionable).toBe(false);
  });

  it("explica por que no se puede seleccionar, en vez de esconderlo", () => {
    const [, sinStock] = anotarDisponibilidad(CATALOGO, []);

    expect(sinStock.motivoNoSeleccionable).toBeTruthy();
    expect(sinStock.motivoNoSeleccionable).toContain("Sin existencia");
  });

  it("un medicamento sin existencia queda en cero, no en undefined", () => {
    expect(anotarDisponibilidad(CATALOGO, [])[0].cantidadDisponible).toBe(0);
  });

  it("no falla sin catalogo ni existencias", () => {
    expect(anotarDisponibilidad()).toEqual([]);
  });
});

describe("describirExistencia", () => {
  it("junta nombre, concentracion, presentacion y marca", () => {
    expect(describirExistencia(CATALOGO[0])).toBe("Amoxicilina 500 mg capsula X");
  });

  it("omite lo que falta sin dejar espacios sueltos", () => {
    expect(describirExistencia(CATALOGO[1])).toBe("Ibuprofeno 400 mg tableta");
  });
});

describe("renglonIncompleto", () => {
  const completo = {
    medicamentoId: "m-1",
    loteId: "l-1",
    dosis: "1 capsula",
    frecuencia: "cada 8 horas",
    duracion: "7 dias",
    cantidadEntregada: 21,
  };

  it("un renglon completo no reporta problema", () => {
    expect(renglonIncompleto(completo)).toBeNull();
  });

  it("nombra el primer dato que falta", () => {
    expect(renglonIncompleto({ ...completo, loteId: null })).toContain("lote");
    expect(renglonIncompleto({ ...completo, dosis: "" })).toContain("dosis");
  });

  it("rechaza cantidad cero o negativa", () => {
    expect(renglonIncompleto({ ...completo, cantidadEntregada: 0 })).toContain("mayor que cero");
    expect(renglonIncompleto({ ...completo, cantidadEntregada: -3 })).toContain("mayor que cero");
  });
});

describe("repartirEntreLotes", () => {
  // Ordenados por vencimiento, como los entrega consultarLotesDisponibles().
  const LOTES = {
    "m-1": [
      { loteId: "l-1", bodegaId: "b-1", numeroLote: "LOT1", cantidadDisponible: 10 },
      { loteId: "l-2", bodegaId: "b-1", numeroLote: "LOT2", cantidadDisponible: 300 },
      { loteId: "l-3", bodegaId: "b-1", numeroLote: "LOT3", cantidadDisponible: 50 },
    ],
  };
  const renglon = (cambios) => ({
    clave: "r-1",
    medicamentoId: "m-1",
    loteId: "l-1",
    bodegaId: "b-1",
    cantidadEntregada: 20,
    ...cambios,
  });

  it("si el lote elegido alcanza, todo sale de ahi", () => {
    const { "r-1": reparto } = repartirEntreLotes([renglon({ cantidadEntregada: 8 })], LOTES);
    expect(reparto.partes).toEqual([
      { loteId: "l-1", bodegaId: "b-1", numeroLote: "LOT1", cantidad: 8 },
    ]);
    expect(reparto.faltante).toBe(0);
  });

  it("si no alcanza, pone lo que tiene y pasa al siguiente que vence", () => {
    const { "r-1": reparto } = repartirEntreLotes([renglon()], LOTES);
    expect(reparto.partes.map((parte) => [parte.numeroLote, parte.cantidad])).toEqual([
      ["LOT1", 10],
      ["LOT2", 10],
    ]);
  });

  it("empieza por el lote elegido aunque no sea el primero en vencer", () => {
    const { "r-1": reparto } = repartirEntreLotes(
      [renglon({ loteId: "l-3", cantidadEntregada: 60 })],
      LOTES,
    );
    expect(reparto.partes.map((parte) => [parte.numeroLote, parte.cantidad])).toEqual([
      ["LOT3", 50],
      ["LOT1", 10],
    ]);
  });

  it("dos renglones del mismo medicamento no cuentan dos veces la misma existencia", () => {
    const repartos = repartirEntreLotes(
      [renglon({ cantidadEntregada: 6 }), renglon({ clave: "r-2", cantidadEntregada: 6 })],
      LOTES,
    );
    expect(repartos["r-2"].partes.map((parte) => [parte.numeroLote, parte.cantidad])).toEqual([
      ["LOT1", 4],
      ["LOT2", 2],
    ]);
  });

  it("lo que no cubre ningun lote queda como faltante", () => {
    const { "r-1": reparto } = repartirEntreLotes([renglon({ cantidadEntregada: 400 })], LOTES);
    expect(reparto.faltante).toBe(40);
    expect(reparto.disponible).toBe(360);
  });
});

describe("describirReparto", () => {
  it("de un solo lote no hay nada que avisar", () => {
    expect(describirReparto({ partes: [{ numeroLote: "LOT1", cantidad: 5 }] })).toBeNull();
  });

  it("de varios lotes dice cuanto sale de cada uno", () => {
    expect(
      describirReparto({
        partes: [
          { numeroLote: "LOT1", cantidad: 10 },
          { numeroLote: "LOT2", cantidad: 10 },
        ],
      }),
    ).toBe("El lote elegido no alcanza: se entregan 10 del lote LOT1 y 10 del lote LOT2.");
  });
});
