import { describe, expect, it } from "vitest";

import { COLUMNAS_USUARIO, COLUMNAS_USUARIO_MOVIL } from "./columnas.js";

describe("COLUMNAS_USUARIO_MOVIL", () => {
  it("es exactamente avatar, nombre, rol, especialidades y estado (issue #272, criterio 3)", () => {
    expect(COLUMNAS_USUARIO_MOVIL.map((columna) => columna.id)).toEqual([
      "avatar",
      "nombreCompleto",
      "rol",
      "especialidades",
      "estado",
    ]);
  });

  it("cada columna es la misma referencia que en COLUMNAS_USUARIO, no una copia", () => {
    for (const columna of COLUMNAS_USUARIO_MOVIL) {
      const original = COLUMNAS_USUARIO.find((c) => c.id === columna.id);
      expect(columna).toBe(original);
    }
  });
});
