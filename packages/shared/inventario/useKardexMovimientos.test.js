// Pruebas de la logica pura del hook del kardex de movimientos (issue #687).
//
// El hook en si no se monta: packages/shared corre vitest en environment "node", sin DOM (ver
// vitest.config.js y el mismo criterio en pacientes/useRegistroConsulta.test.js). Lo que se
// puede -y se necesita- probar es que el armado de filas sale de lo que listarMovimientos()
// devuelve, no de constantes escritas a mano como pasaba antes de esta issue.

import { describe, expect, it } from "vitest";

import { filasDeKardex, nombreDe } from "./useKardexMovimientos.js";

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
