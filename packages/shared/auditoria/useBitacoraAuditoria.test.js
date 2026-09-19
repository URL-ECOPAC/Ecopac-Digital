// Pruebas de la logica pura de la bitacora de auditoria.
//
// No se monta el hook: packages/shared corre vitest con environment "node" a proposito, sin
// DOM. Por eso armarFilasDeAuditoria y calcularPaginasDeAuditoria son funciones exportadas y no
// codigo suelto dentro de useBitacoraAuditoria, mismo criterio que armarFilas()/calcularPaginas()
// en usuarios/useUsuariosListado.js.
//
// Ningun dato real: los nombres son inventados.

import { describe, expect, it } from "vitest";

import {
  EVENTOS_POR_PAGINA,
  armarFilasDeAuditoria,
  calcularPaginasDeAuditoria,
} from "./useBitacoraAuditoria.js";

const EVENTOS = [
  { id: 1, realizadoPor: "p1", tablaAfectada: "pacientes", operacion: "insercion" },
  { id: 2, realizadoPor: null, tablaAfectada: "perfiles", operacion: "actualizacion" },
  { id: 3, realizadoPor: "p2", tablaAfectada: "recetas", operacion: "eliminacion" },
];

describe("armarFilasDeAuditoria", () => {
  it("resuelve realizadoPor contra el mapa de nombres", () => {
    const nombresPorId = new Map([["p1", "Ana Lopez"]]);

    const filas = armarFilasDeAuditoria(EVENTOS, nombresPorId);

    expect(filas[0].realizadoPorNombre).toBe("Ana Lopez");
  });

  it("un realizadoPor nulo se muestra como 'Sistema'", () => {
    const filas = armarFilasDeAuditoria(EVENTOS, new Map());

    expect(filas[1].realizadoPorNombre).toBe("Sistema");
  });

  it("un id que ya no esta en el mapa se muestra como 'Usuario eliminado'", () => {
    const filas = armarFilasDeAuditoria(EVENTOS, new Map([["p1", "Ana Lopez"]]));

    expect(filas[2].realizadoPorNombre).toBe("Usuario eliminado");
  });

  it("conserva el resto de campos del evento intactos", () => {
    const filas = armarFilasDeAuditoria(EVENTOS, new Map());

    expect(filas[0].tablaAfectada).toBe("pacientes");
    expect(filas[0].operacion).toBe("insercion");
  });

  it("una lista vacia no revienta", () => {
    expect(armarFilasDeAuditoria([], new Map())).toEqual([]);
    expect(armarFilasDeAuditoria()).toEqual([]);
  });
});

describe("calcularPaginasDeAuditoria", () => {
  it("redondea hacia arriba", () => {
    expect(calcularPaginasDeAuditoria(41, EVENTOS_POR_PAGINA)).toBe(3);
  });

  it("nunca devuelve menos de una pagina", () => {
    expect(calcularPaginasDeAuditoria(0, EVENTOS_POR_PAGINA)).toBe(1);
  });
});
