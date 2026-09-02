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
  combinarJornadasConPresupuesto,
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
  it("combina cada proyecto con su presupuesto por id, incluido el responsable", () => {
    const proyectos = [
      { id: "p1", nombre: "Proyecto Uno", responsableNombre: "Ana Lopez" },
      { id: "p2", nombre: "Proyecto Dos", responsableNombre: "Luis Perez" },
    ];
    const presupuestos = {
      p1: { asignado: 1000, gastado: 400, disponible: 600, pendiente: 100 },
      p2: { asignado: 500, gastado: 500, disponible: 0, pendiente: 0 },
    };

    expect(combinarProyectosConPresupuesto(proyectos, presupuestos)).toEqual([
      {
        id: "p1",
        nombre: "Proyecto Uno",
        responsable: "Ana Lopez",
        asignado: 1000,
        gastado: 400,
        disponible: 600,
        porcentaje: 40,
      },
      {
        id: "p2",
        nombre: "Proyecto Dos",
        responsable: "Luis Perez",
        asignado: 500,
        gastado: 500,
        disponible: 0,
        porcentaje: 100,
      },
    ]);
  });

  it("un proyecto sin responsable asignado entra con responsable null, no vacio ni undefined", () => {
    const proyectos = [{ id: "p1", nombre: "Proyecto Sin Responsable", responsableNombre: "" }];

    expect(combinarProyectosConPresupuesto(proyectos, {})[0].responsable).toBeNull();
  });

  it("un proyecto sin presupuesto (la llamada individual fallo) entra en ceros, no se omite", () => {
    const proyectos = [{ id: "p1", nombre: "Proyecto Sin Datos", responsableNombre: "Ana Lopez" }];

    expect(combinarProyectosConPresupuesto(proyectos, {})).toEqual([
      {
        id: "p1",
        nombre: "Proyecto Sin Datos",
        responsable: "Ana Lopez",
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

describe("combinarJornadasConPresupuesto", () => {
  it("combina cada jornada con su presupuesto por id", () => {
    const jornadas = [
      { id: "j1", nombre: "Jornada Uno", fecha: "2026-01-10", estado: "finalizada" },
      { id: "j2", nombre: "Jornada Dos", fecha: "2026-02-15", estado: "planificada" },
    ];
    const presupuestos = {
      j1: { asignado: 1234.56, gastado: 987.65, disponible: 246.91, pendiente: 50.12 },
      j2: { asignado: 2000, gastado: 0, disponible: 2000, pendiente: 0 },
    };

    expect(combinarJornadasConPresupuesto(jornadas, presupuestos)).toEqual([
      {
        id: "j1",
        nombre: "Jornada Uno",
        fecha: "2026-01-10",
        estado: "finalizada",
        asignado: 1234.56,
        gastado: 987.65,
        disponible: 246.91,
        porcentaje: (987.65 / 1234.56) * 100,
      },
      {
        id: "j2",
        nombre: "Jornada Dos",
        fecha: "2026-02-15",
        estado: "planificada",
        asignado: 2000,
        gastado: 0,
        disponible: 2000,
        porcentaje: 0,
      },
    ]);
  });

  it("una jornada sin presupuesto (la llamada individual fallo) entra en ceros, no se omite", () => {
    const jornadas = [
      { id: "j1", nombre: "Sin datos", fecha: "2026-01-01", estado: "planificada" },
    ];

    expect(combinarJornadasConPresupuesto(jornadas, {})[0]).toMatchObject({
      asignado: 0,
      gastado: 0,
      disponible: 0,
      porcentaje: 0,
    });
  });

  it("sin jornadas devuelve una lista vacia, sin reventar", () => {
    expect(combinarJornadasConPresupuesto([], {})).toEqual([]);
    expect(combinarJornadasConPresupuesto()).toEqual([]);
  });
});

describe("criterio 4 de #301: la suma de las jornadas de un proyecto coincide con el total del proyecto", () => {
  // La fuente de verdad es SQL (presupuesto_de_proyecto() suma la misma expresion que
  // presupuesto_de_jornada() evalua por jornada, ver 00040_funciones_presupuesto.sql): el total
  // de un proyecto es la suma de sus jornadas por construccion de la consulta, no por dos
  // calculos independientes. Esta prueba fija esa garantia del lado del cliente: si el total del
  // proyecto que llega de obtenerPresupuestoProyecto() es la suma real de lo que
  // obtenerPresupuestoJornada() devuelve por cada una de sus jornadas, combinarJornadasConPresupuesto()
  // y combinarProyectosConPresupuesto() tienen que reportar exactamente esa misma suma -- con
  // cifras no triviales (decimales, no redondos) para que un error de redondeo o de tipo no
  // pase inadvertido.
  it("el gastado y el asignado de las jornadas suman el mismo total que el proyecto", () => {
    const presupuestosDeJornada = {
      j1: { asignado: 1533.33, gastado: 812.47, disponible: 720.86, pendiente: 0 },
      j2: { asignado: 2466.67, gastado: 2466.67, disponible: 0, pendiente: 133.1 },
      j3: { asignado: 999.01, gastado: 0, disponible: 999.01, pendiente: 0 },
    };
    const jornadas = Object.keys(presupuestosDeJornada).map((id) => ({
      id,
      nombre: id,
      fecha: "2026-01-01",
      estado: "finalizada",
    }));

    // El total del proyecto, calculado exactamente como lo calcula presupuesto_de_proyecto() en
    // SQL: SUM() sobre la misma columna que presupuesto_de_jornada() expone por fila.
    const totalDelProyecto = {
      asignado: Object.values(presupuestosDeJornada).reduce((acc, p) => acc + p.asignado, 0),
      gastado: Object.values(presupuestosDeJornada).reduce((acc, p) => acc + p.gastado, 0),
      disponible: Object.values(presupuestosDeJornada).reduce((acc, p) => acc + p.disponible, 0),
      pendiente: Object.values(presupuestosDeJornada).reduce((acc, p) => acc + p.pendiente, 0),
    };

    const filasDeJornada = combinarJornadasConPresupuesto(jornadas, presupuestosDeJornada);
    const [filaDeProyecto] = combinarProyectosConPresupuesto(
      [{ id: "p1", nombre: "Proyecto", responsableNombre: "Ana Lopez" }],
      { p1: totalDelProyecto },
    );

    const sumaAsignadoDeJornadas = filasDeJornada.reduce((acc, j) => acc + j.asignado, 0);
    const sumaGastadoDeJornadas = filasDeJornada.reduce((acc, j) => acc + j.gastado, 0);

    expect(sumaAsignadoDeJornadas).toBeCloseTo(filaDeProyecto.asignado, 10);
    expect(sumaGastadoDeJornadas).toBeCloseTo(filaDeProyecto.gastado, 10);
  });
});
