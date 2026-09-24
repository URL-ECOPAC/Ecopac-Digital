// Pruebas de la logica pura del hook del kardex de movimientos (issue #687).
//
// El hook en si no se monta: packages/shared corre vitest en environment "node", sin DOM (ver
// vitest.config.js y el mismo criterio en pacientes/useRegistroConsulta.test.js). Lo que se
// puede -y se necesita- probar es que el armado de filas sale de lo que listarMovimientos()
// devuelve, no de constantes escritas a mano como pasaba antes de esta issue.

import { describe, expect, it } from "vitest";

import { conZonaHorariaDeGuatemala } from "../pruebas/zonaHoraria.js";
import {
  filasDeKardex,
  filtrarPorRangoDeFecha,
  nombreDe,
  resumenDeKardex,
} from "./useKardexMovimientos.js";

describe("resumenDeKardex", () => {
  it("suma solo los movimientos aprobados y toma el saldo de la ultima fila", () => {
    const resumen = resumenDeKardex([
      { tipo: "ingreso", cantidad: 10, afectaSaldo: true, saldoAcumulado: 10 },
      { tipo: "salida", cantidad: 3, afectaSaldo: true, saldoAcumulado: 7 },
      { tipo: "salida", cantidad: 5, afectaSaldo: false, saldoAcumulado: 7 },
    ]);
    expect(resumen).toEqual({ movimientos: 3, ingresos: 10, salidas: 3, saldo: 7 });
  });

  it("sin movimientos todo es cero", () => {
    expect(resumenDeKardex([])).toEqual({ movimientos: 0, ingresos: 0, salidas: 0, saldo: 0 });
  });
});

describe("nombreDe", () => {
  it("junta nombres y apellidos del perfil embebido", () => {
    expect(nombreDe({ nombres: "Ana", apellidos: "Lopez" })).toBe("Ana Lopez");
  });

  it("devuelve null sin perfil, no una cadena vacia ni 'undefined undefined'", () => {
    // RLS deja el embed en null cuando quien consulta no es administrador ni el propio perfil
    // (00038): un medico o voluntario mirando el kardex de otra persona ve esto, no un error.
    expect(nombreDe(null)).toBeNull();
    expect(nombreDe(undefined)).toBeNull();
  });
});

describe("filasDeKardex", () => {
  const filaBase = {
    id: "mov-1",
    tipo: "ingreso",
    cantidad: 100,
    estado: "aprobado",
    lote: { medicamento_id: "med-1" },
    bodega: { nombre: "Central" },
    registradoPor: { nombres: "Ana", apellidos: "Lopez" },
    aprobadoPor: null,
  };

  it("resuelve los nombres y la bodega desde las filas reales de listarMovimientos()", () => {
    const [fila] = filasDeKardex([filaBase], null);

    expect(fila.registrado_por_nombre).toBe("Ana Lopez");
    expect(fila.aprobado_por_nombre).toBeNull();
    expect(fila.bodega_nombre).toBe("Central");
    // No es un objeto inventado: conserva el resto de columnas de la fila original.
    expect(fila.id).toBe("mov-1");
    expect(fila.estado).toBe("aprobado");
  });

  it("filtra por medicamento usando el lote embebido, no una columna propia", () => {
    const otraFila = { ...filaBase, id: "mov-2", lote: { medicamento_id: "med-2" } };

    const filas = filasDeKardex([filaBase, otraFila], "med-1");

    expect(filas).toHaveLength(1);
    expect(filas[0].id).toBe("mov-1");
  });

  it("sin medicamentoId no filtra nada", () => {
    const otraFila = { ...filaBase, id: "mov-2", lote: { medicamento_id: "med-2" } };

    expect(filasDeKardex([filaBase, otraFila], null)).toHaveLength(2);
  });

  it("una lista vacia se dibuja vacia, no con movimientos de mentira", () => {
    expect(filasDeKardex([], null)).toEqual([]);
  });
});

describe("filtrarPorRangoDeFecha", () => {
  function movimiento(id, createdAt) {
    return { id, created_at: createdAt };
  }

  it("sin filtros devuelve todo", () => {
    const movimientos = [movimiento("m1", "2026-06-15T12:00:00Z")];
    expect(filtrarPorRangoDeFecha(movimientos, "", "")).toEqual(movimientos);
  });

  it("excluye lo anterior a fechaDesde y lo posterior a fechaHasta", () => {
    const movimientos = [
      movimiento("antes", "2026-06-09T12:00:00Z"),
      movimiento("dentro", "2026-06-15T12:00:00Z"),
      movimiento("despues", "2026-06-21T12:00:00Z"),
    ];

    const filtrados = filtrarPorRangoDeFecha(movimientos, "2026-06-10", "2026-06-20");

    expect(filtrados.map((m) => m.id)).toEqual(["dentro"]);
  });

  describe("el borde de las 18:00 en Guatemala (issue #725)", () => {
    conZonaHorariaDeGuatemala();

    it("un movimiento registrado ya entrada la noche local sigue cayendo en fechaHasta de ese dia", () => {
      // 15 de junio de 2026, 20:00 en Guatemala (UTC-6) = 16 de junio, 02:00 UTC. El bug que
      // corrigio esta issue leia fechaHasta con new Date(cadena) -medianoche UTC- y comparaba
      // contra new Date(m.created_at) sin pasar por aFechaLocal(): un movimiento de esta noche
      // quedaba fuera de "hasta el 15 de junio".
      const movimientos = [movimiento("de-noche", "2026-06-16T02:00:00Z")];

      const filtrados = filtrarPorRangoDeFecha(movimientos, "", "2026-06-15");

      expect(filtrados.map((m) => m.id)).toEqual(["de-noche"]);
    });
  });
});
