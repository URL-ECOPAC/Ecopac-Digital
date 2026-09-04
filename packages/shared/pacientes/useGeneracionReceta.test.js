import { describe, expect, it } from "vitest";

import {
  anotarDisponibilidad,
  describirExistencia,
  renglonIncompleto,
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
