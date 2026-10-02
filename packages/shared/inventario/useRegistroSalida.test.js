// Pruebas de lo puro de useRegistroSalida (issue #911): cuando se puede registrar una salida y
// como se identifica un lote del desplegable.

import { describe, expect, it } from "vitest";

import { claveDeLoteDeSalida, estadoDeLaSalida, motivosDeSalida } from "./useRegistroSalida.js";

const LOTE = { loteId: "l-1", bodegaId: "b-1", cantidadDisponible: 40 };

describe("claveDeLoteDeSalida", () => {
  it("distingue el mismo lote en dos bodegas", () => {
    expect(claveDeLoteDeSalida(LOTE)).not.toBe(claveDeLoteDeSalida({ ...LOTE, bodegaId: "b-2" }));
  });

  it("sin lote es una cadena vacia, la opcion de 'elegir'", () => {
    expect(claveDeLoteDeSalida(null)).toBe("");
  });
});

describe("estadoDeLaSalida", () => {
  const completo = {
    motivo: "baja",
    medicamentoId: "m-1",
    loteSeleccionado: LOTE,
    cantidad: "10",
    lotesDisponibles: [LOTE],
  };

  it("con motivo, lote y una cantidad que alcanza, se puede guardar", () => {
    expect(estadoDeLaSalida(completo)).toEqual({
      sinExistencia: false,
      avisoCantidad: null,
      puedeGuardar: true,
    });
  });

  it("un medicamento sin lotes es 'sin existencia' y no se puede guardar", () => {
    const estado = estadoDeLaSalida({
      ...completo,
      loteSeleccionado: null,
      lotesDisponibles: [],
    });

    expect(estado.sinExistencia).toBe(true);
    expect(estado.puedeGuardar).toBe(false);
  });

  it("mientras se cargan los lotes no se dice que no hay existencia", () => {
    expect(
      estadoDeLaSalida({ ...completo, lotesDisponibles: [], cargando: true }).sinExistencia,
    ).toBe(false);
  });

  it("una cantidad mayor a la del lote lo dice y no deja guardar", () => {
    const estado = estadoDeLaSalida({ ...completo, cantidad: "41" });

    expect(estado.avisoCantidad).toContain("40");
    expect(estado.puedeGuardar).toBe(false);
  });

  it("sin motivo, sin cantidad o con una cantidad no entera, no deja guardar", () => {
    expect(estadoDeLaSalida({ ...completo, motivo: "" }).puedeGuardar).toBe(false);
    expect(estadoDeLaSalida({ ...completo, cantidad: "" }).puedeGuardar).toBe(false);
    expect(estadoDeLaSalida({ ...completo, cantidad: "2.5" }).puedeGuardar).toBe(false);
    expect(estadoDeLaSalida({ ...completo, cantidad: "0" }).puedeGuardar).toBe(false);
  });
});

// 00179: un traslado mueve el lote a otra bodega; antes solo salia del origen.
describe("traslado entre bodegas", () => {
  const LOTE = { loteId: "l-1", bodegaId: "b-1", cantidadDisponible: 10 };

  it("sin bodega destino no se puede guardar", () => {
    const base = { motivo: "traslado", medicamentoId: "m-1", loteSeleccionado: LOTE, cantidad: 2 };
    expect(estadoDeLaSalida(base).puedeGuardar).toBe(false);
    expect(estadoDeLaSalida({ ...base, bodegaDestinoId: "b-2" }).puedeGuardar).toBe(true);
  });

  it("solo la administradora ve el motivo traslado", () => {
    expect(motivosDeSalida("administrador").map((opcion) => opcion.value)).toContain("traslado");
    expect(motivosDeSalida("medico").map((opcion) => opcion.value)).not.toContain("traslado");
  });
});
