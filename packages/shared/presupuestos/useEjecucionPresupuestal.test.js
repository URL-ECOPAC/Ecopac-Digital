// Pruebas de las funciones puras de useEjecucionPresupuestal.js (issue #300).
//
// El hook en si no se prueba con renderHook: vitest.config.js de packages/shared corre en
// environment "node", sin DOM, mismo motivo por el que jornadas/useJornadasKanban.test.js solo
// prueba sus funciones puras y no monta el hook. Las decisiones no triviales de este archivo
// -el calculo de porcentaje, la combinacion de proyectos con su presupuesto- viven en funciones
// exportadas aparte justamente para poder probarlas asi.

import { describe, expect, it } from "vitest";

import {
  calcularPorcentajeEjecutado,
  combinarProyectosConPresupuesto,
} from "./useEjecucionPresupuestal.js";

describe("calcularPorcentajeEjecutado", () => {
  it("calcula el porcentaje normal", () => {
    expect(calcularPorcentajeEjecutado(1000, 250)).toBe(25);
  });

  it("asignado en 0 da 0, no NaN ni Infinity", () => {
    expect(calcularPorcentajeEjecutado(0, 0)).toBe(0);
    expect(calcularPorcentajeEjecutado(0, 500)).toBe(0);
  });

  it("un gasto mayor al asignado no se recorta a 100: el proyecto se sobregiro de verdad", () => {
    expect(calcularPorcentajeEjecutado(1000, 1500)).toBe(150);
  });

  it("valores no numericos se tratan como 0", () => {
    expect(calcularPorcentajeEjecutado(undefined, undefined)).toBe(0);
    expect(calcularPorcentajeEjecutado(1000, undefined)).toBe(0);
  });
});

describe("combinarProyectosConPresupuesto", () => {
  it("combina cada proyecto con su presupuesto por id", () => {
    const proyectos = [
      { id: "p1", nombre: "Proyecto Uno" },
      { id: "p2", nombre: "Proyecto Dos" },
    ];
    const presupuestos = {
      p1: { asignado: 1000, gastado: 400, disponible: 600, pendiente: 100 },
      p2: { asignado: 500, gastado: 500, disponible: 0, pendiente: 0 },
    };

    expect(combinarProyectosConPresupuesto(proyectos, presupuestos)).toEqual([
      {
        id: "p1",
        nombre: "Proyecto Uno",
        asignado: 1000,
        gastado: 400,
        disponible: 600,
        porcentaje: 40,
      },
      {
        id: "p2",
        nombre: "Proyecto Dos",
        asignado: 500,
        gastado: 500,
        disponible: 0,
        porcentaje: 100,
      },
    ]);
  });

  it("un proyecto sin presupuesto (la llamada individual fallo) entra en ceros, no se omite", () => {
    const proyectos = [{ id: "p1", nombre: "Proyecto Sin Datos" }];

    expect(combinarProyectosConPresupuesto(proyectos, {})).toEqual([
      {
        id: "p1",
        nombre: "Proyecto Sin Datos",
        asignado: 0,
        gastado: 0,
        disponible: 0,
        porcentaje: 0,
      },
    ]);
  });

  it("sin proyectos devuelve una lista vacia, sin reventar", () => {
    expect(combinarProyectosConPresupuesto([], {})).toEqual([]);
    expect(combinarProyectosConPresupuesto()).toEqual([]);
  });
});
