import { describe, expect, it } from "vitest";

import { buscarOpcionPorEtiqueta, filtrarOpcionesPorTexto, textoComparable } from "./opciones.js";

// Issue #840, G4: en diagnosticos hay que poder buscar, no solo mirar.
describe("filtrarOpcionesPorTexto", () => {
  const DIAGNOSTICOS = [
    { value: "1", label: "Faringitis aguda" },
    { value: "2", label: "Gastritis crónica" },
    { value: "3", label: "Diarrea" },
  ];

  it("encuentra por un pedazo, sin importar acentos ni mayusculas", () => {
    expect(filtrarOpcionesPorTexto(DIAGNOSTICOS, "CRONICA").map((o) => o.value)).toEqual(["2"]);
  });

  it("cada palabra tiene que aparecer, en cualquier orden", () => {
    expect(filtrarOpcionesPorTexto(DIAGNOSTICOS, "aguda farin").map((o) => o.value)).toEqual(["1"]);
  });

  it("sin texto devuelve todas", () => {
    expect(filtrarOpcionesPorTexto(DIAGNOSTICOS, "  ")).toHaveLength(3);
  });
});

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
