import { describe, expect, it } from "vitest";

import { etiquetaDeValor, mayusculaInicial } from "./texto.js";

describe("mayusculaInicial", () => {
  it("sube solo la primera letra y deja el resto como viene", () => {
    expect(mayusculaInicial("consulta general")).toBe("Consulta general");
    expect(mayusculaInicial("triaje OMS")).toBe("Triaje OMS");
    expect(mayusculaInicial("ñame")).toBe("Ñame");
  });

  it("devuelve cadena vacia sin texto", () => {
    expect(mayusculaInicial(null)).toBe("");
    expect(mayusculaInicial(undefined)).toBe("");
    expect(mayusculaInicial("   ")).toBe("");
  });
});

describe("etiquetaDeValor", () => {
  it("convierte un valor de enum en etiqueta", () => {
    expect(etiquetaDeValor("aprobado")).toBe("Aprobado");
    expect(etiquetaDeValor("en_curso")).toBe("En curso");
    expect(etiquetaDeValor("pendiente de validacion")).toBe("Pendiente de validacion");
  });
});
