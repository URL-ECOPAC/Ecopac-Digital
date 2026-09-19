// Pruebas de las funciones puras de useExistenciasPorLote (issue #838).
//
// El hook en si no se monta: packages/shared corre vitest con environment "node", sin DOM, mismo
// criterio que el resto del monorepo. Lo que importa -- que estado le toca a cada lote, como se
// suma su existencia y como filtran la busqueda, la bodega y el estado -- vive en tres funciones
// exportadas aparte, y es lo que se prueba aqui.
//
// Ningun dato real: medicamentos, lotes y bodegas son inventados.

import { describe, expect, it } from "vitest";

import { fechaLocalISO } from "../formato/fechas.js";
import {
  ESTADOS_DE_LOTE,
  armarFilasDeExistencias,
  estadoDeLote,
  sumarExistenciasPorLote,
} from "./useExistenciasPorLote.js";

/**
 * Una fecha a N dias de hoy, en el formato AAAA-MM-DD que guarda lotes.fecha_vencimiento. Dia
 * LOCAL: con toISOString() el "hoy" de la tarde en Guatemala ya era manana (issue #840).
 */
function enDias(dias) {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  return fechaLocalISO(fecha);
}

describe("estadoDeLote", () => {
  it("un lote ya vencido es vencido, aunque le quede existencia", () => {
    expect(estadoDeLote(-1, 50)).toBe(ESTADOS_DE_LOTE.VENCIDO);
  });

  it("sin existencia es agotado, no disponible", () => {
    expect(estadoDeLote(200, 0)).toBe(ESTADOS_DE_LOTE.AGOTADO);
  });

  it("vencer HOY no es vencido: todavia se entrega (regla de la 00044), pero es critico", () => {
    expect(estadoDeLote(0, 10)).toBe(ESTADOS_DE_LOTE.CRITICO);
    expect(estadoDeLote(0, 10)).not.toBe(ESTADOS_DE_LOTE.VENCIDO);
  });

  it("a siete dias o menos es critico; entre ocho y treinta, por vencer", () => {
    expect(estadoDeLote(7, 10)).toBe(ESTADOS_DE_LOTE.CRITICO);
    expect(estadoDeLote(8, 10)).toBe(ESTADOS_DE_LOTE.POR_VENCER);
    expect(estadoDeLote(30, 10)).toBe(ESTADOS_DE_LOTE.POR_VENCER);
    expect(estadoDeLote(31, 10)).toBe(ESTADOS_DE_LOTE.DISPONIBLE);
  });

  it("un lote sin fecha de vencimiento se juzga solo por su existencia", () => {
    expect(estadoDeLote(null, 10)).toBe(ESTADOS_DE_LOTE.DISPONIBLE);
    expect(estadoDeLote(null, 0)).toBe(ESTADOS_DE_LOTE.AGOTADO);
  });
});

describe("sumarExistenciasPorLote", () => {
  const EXISTENCIAS = [
    { loteId: "lote-1", bodegaId: "bodega-a", cantidadDisponible: 10 },
    { loteId: "lote-1", bodegaId: "bodega-b", cantidadDisponible: 5 },
    { loteId: "lote-2", bodegaId: "bodega-b", cantidadDisponible: 7 },
  ];

  it("suma entre bodegas cuando no se pide ninguna", () => {
    const total = sumarExistenciasPorLote(EXISTENCIAS);

    expect(total.get("lote-1")).toBe(15);
    expect(total.get("lote-2")).toBe(7);
  });

  it("con una bodega elegida cuenta solo la de esa bodega", () => {
    const total = sumarExistenciasPorLote(EXISTENCIAS, "bodega-a");

    expect(total.get("lote-1")).toBe(10);
    expect(total.has("lote-2")).toBe(false);
  });
});

describe("armarFilasDeExistencias", () => {
  const LOTES = [
    { id: "lote-1", medicamento: "Loratadina", numeroLote: "L-001", fechaVencimiento: enDias(90) },
    { id: "lote-2", medicamento: "Amoxicilina", numeroLote: "L-002", fechaVencimiento: enDias(3) },
    { id: "lote-3", medicamento: "Ibuprofeno", numeroLote: "L-003", fechaVencimiento: enDias(-5) },
  ];

  const EXISTENCIAS = [
    { loteId: "lote-1", bodegaId: "bodega-a", cantidadDisponible: 40 },
    { loteId: "lote-2", bodegaId: "bodega-b", cantidadDisponible: 12 },
  ];

  it("un lote sin fila de existencia igual aparece, marcado como agotado (issue #270)", () => {
    const filas = armarFilasDeExistencias(LOTES, EXISTENCIAS);
    const ibuprofeno = filas.find((fila) => fila.id === "lote-3");

    expect(ibuprofeno.cantidadDisponible).toBe(0);
    // Vencido gana sobre agotado: es la razon por la que no se puede entregar.
    expect(ibuprofeno.estado).toBe(ESTADOS_DE_LOTE.VENCIDO);
  });

  it("ordena por vencimiento, lo mas urgente primero", () => {
    const filas = armarFilasDeExistencias(LOTES, EXISTENCIAS);

    expect(filas.map((fila) => fila.id)).toEqual(["lote-3", "lote-2", "lote-1"]);
  });

  it("la busqueda mira el medicamento y el numero de lote", () => {
    expect(armarFilasDeExistencias(LOTES, EXISTENCIAS, { busqueda: "amoxi" })).toHaveLength(1);
    expect(armarFilasDeExistencias(LOTES, EXISTENCIAS, { busqueda: "L-003" })).toHaveLength(1);
    expect(armarFilasDeExistencias(LOTES, EXISTENCIAS, { busqueda: "nada" })).toHaveLength(0);
  });

  it("el filtro de estado deja solo los lotes de ese estado", () => {
    const vencidos = armarFilasDeExistencias(LOTES, EXISTENCIAS, {
      estado: ESTADOS_DE_LOTE.VENCIDO,
    });

    expect(vencidos.map((fila) => fila.id)).toEqual(["lote-3"]);
  });

  it("con una bodega elegida, un lote que no esta en ella no se lista como agotado: no esta", () => {
    const filas = armarFilasDeExistencias(LOTES, EXISTENCIAS, { bodega: "bodega-a" });

    expect(filas.map((fila) => fila.id)).toEqual(["lote-1"]);
    expect(filas[0].cantidadDisponible).toBe(40);
  });
});
