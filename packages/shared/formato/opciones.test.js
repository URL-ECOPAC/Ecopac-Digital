import { describe, expect, it } from "vitest";

import { buscarOpcionPorEtiqueta, textoComparable } from "./opciones.js";

const OPCIONES = [
  { value: "d-1", label: "Pediatría" },
  { value: "d-2", label: "Cirujano" },
];

describe("textoComparable", () => {
  it("ignora mayusculas, acentos y espacios de mas", () => {
    expect(textoComparable("  Pediatría  General ")).toBe("pediatria general");
  });
});

describe("buscarOpcionPorEtiqueta", () => {
  it("encuentra la opcion existente aunque se escriba distinto", () => {
    expect(buscarOpcionPorEtiqueta(OPCIONES, "pediatria")).toEqual(OPCIONES[0]);
    expect(buscarOpcionPorEtiqueta(OPCIONES, "CIRUJANO")).toEqual(OPCIONES[1]);
  });

  it("devuelve null si no coincide o no se escribio nada", () => {
    expect(buscarOpcionPorEtiqueta(OPCIONES, "Cardiologia")).toBeNull();
    expect(buscarOpcionPorEtiqueta(OPCIONES, "   ")).toBeNull();
    expect(buscarOpcionPorEtiqueta(undefined, "x")).toBeNull();
  });
});
