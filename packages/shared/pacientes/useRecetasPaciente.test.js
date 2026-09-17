import { describe, expect, it } from "vitest";

import {
  contarRecetas,
  describirEntrega,
  describirMedicamento,
  describirPosologia,
} from "./useRecetasPaciente.js";

const RENGLON = {
  medicamento: "Amoxicilina",
  concentracion: "500 mg",
  presentacion: "capsula",
  dosis: "1 capsula",
  frecuencia: "cada 8 horas",
  duracion: "7 dias",
  cantidadEntregada: 21,
};

describe("describirMedicamento", () => {
  it("junta nombre, concentracion y presentacion", () => {
    expect(describirMedicamento(RENGLON)).toBe("Amoxicilina 500 mg capsula");
  });

  it("omite las partes que faltan sin dejar espacios sueltos", () => {
    expect(describirMedicamento({ medicamento: "Ibuprofeno", presentacion: "tableta" })).toBe(
      "Ibuprofeno tableta",
    );
    expect(describirMedicamento({ medicamento: "Ibuprofeno" })).toBe("Ibuprofeno");
  });

  it("devuelve cadena vacia si no hay nada", () => {
    expect(describirMedicamento({})).toBe("");
    expect(describirMedicamento(null)).toBe("");
  });
});

describe("describirPosologia", () => {
  it("junta dosis, frecuencia y duracion", () => {
    expect(describirPosologia(RENGLON)).toBe("1 capsula, cada 8 horas, 7 dias");
  });

  it("tolera una receta sin duracion", () => {
    expect(describirPosologia({ dosis: "10 ml", frecuencia: "cada 12 horas" })).toBe(
      "10 ml, cada 12 horas",
    );
  });

  it("devuelve cadena vacia si no hay posologia", () => {
    expect(describirPosologia({})).toBe("");
    expect(describirPosologia(null)).toBe("");
  });
});

describe("contarRecetas", () => {
  it("separa emitidas de anuladas", () => {
    const conteo = contarRecetas([
      { id: "1", anulada: false },
      { id: "2", anulada: true },
      { id: "3", anulada: false },
    ]);

    expect(conteo).toEqual({ total: 3, emitidas: 2, anuladas: 1 });
  });

  it("cuenta cero sin recetas", () => {
    expect(contarRecetas([])).toEqual({ total: 0, emitidas: 0, anuladas: 0 });
    expect(contarRecetas()).toEqual({ total: 0, emitidas: 0, anuladas: 0 });
  });
});

describe("describirEntrega", () => {
  it("sin correccion, la cantidad entregada es la vigente", () => {
    expect(describirEntrega({ cantidadEntregada: 10 })).toMatchObject({
      vigente: 10,
      corregida: false,
      texto: "entregadas: 10",
    });
  });

  // 00128: mientras cantidad_ajustada exista, ES la cifra vigente.
  it("con correccion, manda la ajustada y se dice de cuanto y por quien", () => {
    expect(
      describirEntrega({
        cantidadEntregada: 10,
        cantidadAjustada: 8,
        ajustadaPorNombre: "Rosa Gomez",
      }),
    ).toMatchObject({
      vigente: 8,
      original: 10,
      corregida: true,
      texto: "entregadas: 8 (corregido de 10 por Rosa Gomez)",
    });
  });

  it("una ajustada igual a la original no se presenta como correccion", () => {
    expect(describirEntrega({ cantidadEntregada: 5, cantidadAjustada: 5 }).corregida).toBe(false);
  });

  it("sin cantidad no hay texto", () => {
    expect(describirEntrega({}).texto).toBe("");
    expect(describirEntrega(undefined).texto).toBe("");
  });
});
