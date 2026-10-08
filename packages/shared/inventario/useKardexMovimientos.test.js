// Pruebas de la logica pura del hook del kardex de movimientos (issue #687).
//
// El hook en si no se monta: packages/shared corre vitest en environment "node", sin DOM (ver
// vitest.config.js y el mismo criterio en pacientes/useRegistroConsulta.test.js). Lo que se
// puede -y se necesita- probar es que el armado de filas sale de lo que listarMovimientos()
// devuelve, no de constantes escritas a mano como pasaba antes de esta issue.

import { describe, expect, it } from "vitest";

import { conZonaHorariaDeGuatemala } from "../pruebas/zonaHoraria.js";
import {
  cantidadConSigno,
  conSaldoAcumulado,
  filasDeKardex,
  filtrarPorRangoDeFecha,
  nombreDe,
  resumenDeKardex,
} from "./useKardexMovimientos.js";

describe("conSaldoAcumulado", () => {
  it("acumula del mas antiguo al mas reciente aunque lleguen al reves", () => {
    // listarMovimientos() los devuelve del mas reciente al mas antiguo.
    const filas = conSaldoAcumulado([
      {
        id: "s",
        created_at: "2026-09-20T19:10:00Z",
        tipo: "salida",
        estado: "aprobado",
        cantidad: 200,
      },
      {
        id: "i",
        created_at: "2026-08-31T21:44:00Z",
        tipo: "ingreso",
        estado: "aprobado",
        cantidad: 200,
      },
    ]);

    expect(filas.map((fila) => [fila.id, fila.saldoAcumulado])).toEqual([
      ["i", 200],
      ["s", 0],
    ]);
    expect(resumenDeKardex(filas).saldo).toBe(0);
  });

  it("un movimiento pendiente o rechazado no mueve el saldo", () => {
    const filas = conSaldoAcumulado([
      {
        id: "a",
        created_at: "2026-09-01T00:00:00Z",
        tipo: "ingreso",
        estado: "aprobado",
        cantidad: 50,
      },
      {
        id: "b",
        created_at: "2026-09-02T00:00:00Z",
        tipo: "salida",
        estado: "pendiente",
        cantidad: 10,
      },
      {
        id: "c",
        created_at: "2026-09-03T00:00:00Z",
        tipo: "salida",
        estado: "rechazado",
        cantidad: 5,
      },
    ]);

    expect(filas.map((fila) => fila.saldoAcumulado)).toEqual([50, 50, 50]);
    expect(filas.map((fila) => fila.afectaSaldo)).toEqual([true, false, false]);
  });
});

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

// Issue #925: un traslado registra el ingreso en la destino antes que la salida del origen (00143),
// y el saldo del lote pasaba por un valor que nunca existio (300, 350, 300).
describe("cambio de bodega en el kardex", () => {
  const momento = "2026-10-03T21:53:00.000Z";
  const movimientos = [
    {
      id: "a",
      created_at: "2026-10-03T21:45:00.000Z",
      estado: "aprobado",
      tipo: "ingreso",
      cantidad: 300,
    },
    { id: "b", created_at: momento, estado: "aprobado", tipo: "ingreso", cantidad: 50 },
    { id: "c", created_at: momento, estado: "aprobado", tipo: "salida", cantidad: 50 },
    {
      id: "d",
      created_at: "2026-10-03T22:10:00.000Z",
      estado: "aprobado",
      tipo: "salida",
      cantidad: 10,
    },
  ];

  it("no mueve el saldo del lote", () => {
    const filas = conSaldoAcumulado(movimientos);
    expect(filas.map((fila) => fila.saldoAcumulado)).toEqual([300, 300, 300, 290]);
    expect(filas.filter((fila) => fila.esCambioDeBodega).map((fila) => fila.id)).toEqual([
      "b",
      "c",
    ]);
  });

  it("no cuenta como ingreso ni como salida en el resumen", () => {
    expect(resumenDeKardex(conSaldoAcumulado(movimientos))).toMatchObject({
      ingresos: 300,
      salidas: 10,
      saldo: 290,
    });
  });

  it("un ingreso y una salida distintos en el mismo instante si mueven el saldo", () => {
    const filas = conSaldoAcumulado([
      { id: "x", created_at: momento, estado: "aprobado", tipo: "ingreso", cantidad: 20 },
      { id: "y", created_at: momento, estado: "aprobado", tipo: "salida", cantidad: 5 },
    ]);
    expect(filas.at(-1).saldoAcumulado).toBe(15);
    expect(filas.some((fila) => fila.esCambioDeBodega)).toBe(false);
  });
});

describe("cantidadConSigno", () => {
  it("las salidas llevan signo menos, como los ingresos llevan mas", () => {
    expect(cantidadConSigno({ tipo: "ingreso", cantidad: 30 })).toBe("+30");
    expect(cantidadConSigno({ tipo: "salida", cantidad: 30 })).toBe("−30");
  });
});
