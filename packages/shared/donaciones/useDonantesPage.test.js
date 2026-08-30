import { describe, it, expect } from "vitest";

import { TIPOS_DE_DONANTE } from "../enums.js";
import { TIPO_DONANTE_TODOS, filtrarDonantes } from "./useDonantesPage.js";

const DONANTES = [
  { id: "1", nombre: "Farmacia Galeno", tipo: TIPOS_DE_DONANTE.ORGANIZACION },
  { id: "2", nombre: "Ana Perez", tipo: TIPOS_DE_DONANTE.PERSONA },
  { id: "3", nombre: "Fundacion Vida", tipo: TIPOS_DE_DONANTE.ORGANIZACION },
];

describe("filtrarDonantes (#598)", () => {
  it("devuelve la lista entera cuando no hay busqueda ni filtro", () => {
    expect(filtrarDonantes(DONANTES, "", TIPO_DONANTE_TODOS)).toHaveLength(3);
  });

  it("busca por una parte del nombre sin importar mayusculas", () => {
    const resultado = filtrarDonantes(DONANTES, "FUNDA", TIPO_DONANTE_TODOS);

    expect(resultado.map((donante) => donante.id)).toEqual(["3"]);
  });

  it("ignora los espacios sobrantes del termino", () => {
    expect(filtrarDonantes(DONANTES, "   ana   ", TIPO_DONANTE_TODOS)).toHaveLength(1);
  });

  it("filtra por tipo de donante", () => {
    const resultado = filtrarDonantes(DONANTES, "", TIPOS_DE_DONANTE.ORGANIZACION);

    expect(resultado.map((donante) => donante.id)).toEqual(["1", "3"]);
  });

  it("combina busqueda y tipo", () => {
    const resultado = filtrarDonantes(DONANTES, "a", TIPOS_DE_DONANTE.PERSONA);

    expect(resultado.map((donante) => donante.id)).toEqual(["2"]);
  });

  it("devuelve vacio cuando nada coincide", () => {
    expect(filtrarDonantes(DONANTES, "no existe", TIPO_DONANTE_TODOS)).toEqual([]);
  });

  // La version anterior comparaba siempre con includes() sobre `donante.nombre?.toLowerCase()`.
  // Con un donante sin nombre eso da undefined, y `undefined.includes` habria reventado; el
  // encadenamiento opcional lo salvaba devolviendo undefined, que es falso, asi que el donante
  // desaparecia de la lista incluso con la busqueda vacia.
  it("no esconde a un donante sin nombre cuando la busqueda esta vacia", () => {
    const conAnonimo = [...DONANTES, { id: "4", tipo: TIPOS_DE_DONANTE.PERSONA }];

    expect(filtrarDonantes(conAnonimo, "", TIPO_DONANTE_TODOS)).toHaveLength(4);
  });

  it("aguanta una lista vacia o ausente", () => {
    expect(filtrarDonantes([], "algo", TIPO_DONANTE_TODOS)).toEqual([]);
    expect(filtrarDonantes(undefined, "algo", TIPO_DONANTE_TODOS)).toEqual([]);
  });
});
