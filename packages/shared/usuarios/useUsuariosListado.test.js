// Pruebas de la logica pura del listado de personal.
//
// No se monta el hook: packages/shared corre vitest con environment "node" a proposito, sin
// DOM. Por eso armarFilas, calcularPaginas y nombreCompletoDe son funciones exportadas y no
// codigo suelto dentro de useUsuariosListado, mismo criterio que haVencidoPorInactividad() en
// hooks/useExpiracionPorInactividad.js.
//
// Ningun dato real: los nombres son inventados.

import { describe, expect, it } from "vitest";

import {
  USUARIOS_POR_PAGINA,
  armarFilas,
  calcularPaginas,
  nombreCompletoDe,
} from "./useUsuariosListado.js";

const PERFILES = [
  { id: "p1", nombres: "Ana", apellidos: "Lopez", rol: "medico", activo: true },
  { id: "p2", nombres: "Luis", apellidos: "Perez", rol: "voluntario general", activo: false },
];

describe("nombreCompletoDe", () => {
  it("junta nombres y apellidos", () => {
    expect(nombreCompletoDe({ nombres: "Ana", apellidos: "Lopez" })).toBe("Ana Lopez");
  });

  it.each([
    ["solo nombres", { nombres: "Ana" }, "Ana"],
    ["solo apellidos", { apellidos: "Lopez" }, "Lopez"],
    ["perfil vacio", {}, ""],
    ["sin argumento", undefined, ""],
  ])("%s -> '%s'", (_caso, perfil, esperado) => {
    expect(nombreCompletoDe(perfil)).toBe(esperado);
  });

  it("no deja espacios sueltos cuando falta una parte", () => {
    expect(nombreCompletoDe({ nombres: "Ana", apellidos: "" })).toBe("Ana");
  });
});

describe("armarFilas", () => {
  it("agrega el nombre completo y el conteo de jornadas", () => {
    const filas = armarFilas(PERFILES, { p1: 3 });

    expect(filas[0].nombreCompleto).toBe("Ana Lopez");
    expect(filas[0].jornadas).toBe(3);
  });

  it("una persona sin jornadas queda en cero, no en undefined", () => {
    const filas = armarFilas(PERFILES, { p1: 3 });

    expect(filas[1].jornadas).toBe(0);
  });

  it("conserva el resto de campos del perfil intactos", () => {
    const filas = armarFilas(PERFILES, {});

    expect(filas[0].rol).toBe("medico");
    expect(filas[0].activo).toBe(true);
    expect(filas[0].id).toBe("p1");
  });

  it("sin conteos todas quedan en cero", () => {
    const filas = armarFilas(PERFILES);

    expect(filas.map((fila) => fila.jornadas)).toEqual([0, 0]);
  });

  it("una lista vacia devuelve una lista vacia", () => {
    expect(armarFilas([], { p1: 3 })).toEqual([]);
    expect(armarFilas()).toEqual([]);
  });
});

describe("calcularPaginas", () => {
  it.each([
    ["division exacta", 40, 20, 2],
    ["con resto", 45, 20, 3],
    ["menos que una pagina", 5, 20, 1],
    ["justo una pagina", 20, 20, 1],
    ["uno mas que una pagina", 21, 20, 2],
  ])("%s: %i filas de %i por pagina -> %i", (_caso, total, porPagina, esperado) => {
    expect(calcularPaginas(total, porPagina)).toBe(esperado);
  });

  it("una lista vacia sigue siendo una pagina, no cero", () => {
    expect(calcularPaginas(0, 20)).toBe(1);
  });

  it.each([
    ["total ausente", undefined, 20],
    ["porPagina cero", 40, 0],
    ["porPagina ausente", 40, undefined],
  ])("%s no revienta y devuelve al menos 1", (_caso, total, porPagina) => {
    expect(calcularPaginas(total, porPagina)).toBeGreaterThanOrEqual(1);
  });

  it("el tamano por defecto es el que usa la pantalla", () => {
    expect(calcularPaginas(USUARIOS_POR_PAGINA + 1, USUARIOS_POR_PAGINA)).toBe(2);
  });
});
