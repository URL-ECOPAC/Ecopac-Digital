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
  catalogoDeTablas,
} from "./useBitacoraAuditoria.js";
import { TABLAS_AUDITADAS, etiquetaDeTablaAuditada } from "./filtros.js";

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

describe("etiquetaDeTablaAuditada", () => {
  it("usa la etiqueta de TABLAS_AUDITADAS", () => {
    expect(etiquetaDeTablaAuditada("perfiles")).toBe("Perfiles de usuario");
    expect(etiquetaDeTablaAuditada("rol_permiso")).toBe("Permisos por rol");
  });

  it("una tabla fuera de la lista se lee sin guiones bajos, no cruda", () => {
    expect(etiquetaDeTablaAuditada("tabla_nueva_auditada")).toBe("Tabla nueva auditada");
  });
});

describe("catalogoDeTablas", () => {
  it("sin tablas desconocidas devuelve TABLAS_AUDITADAS tal cual", () => {
    expect(catalogoDeTablas(EVENTOS)).toBe(TABLAS_AUDITADAS);
  });

  it("agrega una sola vez cada tabla que no esta en la lista", () => {
    const catalogo = catalogoDeTablas([
      ...EVENTOS,
      { id: 4, tablaAfectada: "tabla_nueva" },
      { id: 5, tablaAfectada: "tabla_nueva" },
    ]);

    expect(catalogo).toHaveLength(TABLAS_AUDITADAS.length + 1);
    expect(catalogo.at(-1)).toEqual({ value: "tabla_nueva", label: "Tabla nueva" });
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
