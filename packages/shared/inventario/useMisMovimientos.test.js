// Pruebas de la logica pura del hook de "Mis movimientos" (issue #756).
//
// El hook en si no se monta: packages/shared corre vitest en environment "node", sin DOM, mismo
// criterio que useKardexMovimientos.test.js. Lo que se prueba es que filaDeMisMovimientos()
// resuelve los campos planos que pide COLUMNAS_MIS_MOVIMIENTOS a partir de los embeds reales de
// listarMovimientos(), no de datos inventados, y que `puedeEditar` reproduce exactamente la
// condicion que exige editarMovimiento() en el servidor (00106): pendiente y propio.

import { describe, expect, it } from "vitest";

import { filaDeMisMovimientos } from "./useMisMovimientos.js";

describe("filaDeMisMovimientos", () => {
  const movBase = {
    id: "mov-1",
    tipo: "salida",
    cantidad: 5,
    motivo: "Entrega en jornada",
    estado: "pendiente",
    registrado_por: "perfil-1",
    created_at: "2026-09-01T10:00:00Z",
    lote: { numero_lote: "L-100", medicamento: { nombre: "Amoxicilina" } },
    bodega: { nombre: "Bodega Movil" },
    registradoPor: { nombres: "Ana", apellidos: "Lopez" },
  };

  it("resuelve medicamento, lote, bodega y quien lo registro desde los embeds", () => {
    const fila = filaDeMisMovimientos(movBase, "perfil-1");

    expect(fila.medicamentoNombre).toBe("Amoxicilina");
    expect(fila.numeroLote).toBe("L-100");
    expect(fila.bodegaNombre).toBe("Bodega Movil");
    expect(fila.registradoPorNombre).toBe("Ana Lopez");
    expect(fila.createdAt).toBe("2026-09-01T10:00:00Z");
    // No es un objeto inventado: conserva el resto de columnas de la fila original.
    expect(fila.id).toBe("mov-1");
    expect(fila.cantidad).toBe(5);
    expect(fila.motivo).toBe("Entrega en jornada");
  });

  it("sin lote, bodega ni registradoPor embebidos, los campos resueltos quedan en null", () => {
    const fila = filaDeMisMovimientos({ id: "mov-2", lote: null, bodega: null }, "perfil-1");

    expect(fila.medicamentoNombre).toBeNull();
    expect(fila.numeroLote).toBeNull();
    expect(fila.bodegaNombre).toBeNull();
    expect(fila.registradoPorNombre).toBeNull();
  });

  it("puedeEditar es verdadero solo si esta pendiente Y lo registro la misma persona", () => {
    expect(filaDeMisMovimientos(movBase, "perfil-1").puedeEditar).toBe(true);
  });

  it("puedeEditar es falso si el movimiento ya no esta pendiente, aunque sea propio", () => {
    const aprobado = { ...movBase, estado: "aprobado" };
    expect(filaDeMisMovimientos(aprobado, "perfil-1").puedeEditar).toBe(false);
  });

  it("puedeEditar es falso si el movimiento pendiente es de otra persona", () => {
    expect(filaDeMisMovimientos(movBase, "perfil-otro").puedeEditar).toBe(false);
  });
});
