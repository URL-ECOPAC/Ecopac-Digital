import { describe, expect, it } from "vitest";

import { COLUMNAS_PACIENTE, COLUMNAS_PACIENTE_MOVIL } from "./columnas.js";

describe("COLUMNAS_PACIENTE_MOVIL", () => {
  it("trae los cuatro datos que nombra el criterio 2 de la #133, mas el avatar", () => {
    expect(COLUMNAS_PACIENTE_MOVIL.map((columna) => columna.id)).toEqual([
      "avatar",
      "numeroFicha",
      "nombreCompleto",
      "edad",
      "comunidad",
    ]);
  });

  it("es un subconjunto de COLUMNAS_PACIENTE, no una lista paralela", () => {
    for (const columna of COLUMNAS_PACIENTE_MOVIL) {
      expect(COLUMNAS_PACIENTE).toContain(columna);
    }
  });

  it("conserva el orden y la columna principal del descriptor de web", () => {
    const principal = COLUMNAS_PACIENTE_MOVIL.find((columna) => columna.principal);
    expect(principal.id).toBe("nombreCompleto");
  });

  it("deja fuera lo que no cabe en una tarjeta de telefono", () => {
    const ids = COLUMNAS_PACIENTE_MOVIL.map((columna) => columna.id);
    expect(ids).not.toContain("sexo");
    expect(ids).not.toContain("condiciones");
    expect(ids).not.toContain("ultimaAtencion");
  });
});
