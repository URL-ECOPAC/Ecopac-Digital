// Pruebas del renglon de una donacion por tipo y del recibo legible (issue #840, bloques C y
// A10).

import { describe, expect, it } from "vitest";

import { TIPOS_DE_DONACION } from "../enums.js";
import { opcionDeMedicamento } from "../inventario/catalogoMedicamentos.js";
import { camposDeRenglonDeDonacion } from "./campos.js";
import { resumenLegibleDeDonacion } from "./useRegistroDonacion.js";

const ids = (tipo) => camposDeRenglonDeDonacion(tipo).map((campo) => campo.id);

describe("camposDeRenglonDeDonacion", () => {
  it("una donacion de medicamentos elige del catalogo y no pide descripcion ni unidad", () => {
    expect(ids(TIPOS_DE_DONACION.MEDICAMENTOS)).toEqual(["medicamentoId", "cantidad"]);
  });

  // 00170: el insumo se elige del catalogo, como un medicamento. Era texto libre, y la pantalla
  // terminaba guardando el id del articulo como descripcion.
  it("insumos elige del catalogo, igual que medicamentos", () => {
    expect(ids(TIPOS_DE_DONACION.INSUMOS)).toEqual(["medicamentoId", "cantidad"]);
  });

  // Antes "servicios" no dibujaba ningun campo: un renglon de servicios no se podia llenar.
  it("todos los tipos del enum tienen campos", () => {
    for (const tipo of Object.values(TIPOS_DE_DONACION)) {
      expect(camposDeRenglonDeDonacion(tipo).length).toBeGreaterThan(0);
    }
  });

  it("un tipo desconocido revienta en vez de dibujar un renglon vacio", () => {
    expect(() => camposDeRenglonDeDonacion("criptomonedas")).toThrow();
  });
});

describe("opcionDeMedicamento", () => {
  it("distingue por concentracion, presentacion y marca, no solo por nombre", () => {
    expect(
      opcionDeMedicamento({
        id: "m1",
        nombre: "Paracetamol",
        concentracion: "500 mg",
        // Ya viene como la etiqueta resuelta (presentaciones.nombre, 00144), no como un valor
        // de enum que opcionDeMedicamento() tuviera que traducir.
        presentacion: "Tableta",
        marca: "Generico",
      }),
    ).toEqual({ value: "m1", label: "Paracetamol 500 mg · Tableta (Generico)" });
  });
});

describe("resumenLegibleDeDonacion", () => {
  it("sin registro no hay recibo", () => {
    expect(resumenLegibleDeDonacion(null)).toBeNull();
  });

  // A10: antes se pintaba "Tipo: dinero" -el enum crudo- y la fecha sin formato.
  it("una donacion de dinero traduce el tipo, formatea la fecha y suma el total", () => {
    const recibo = resumenLegibleDeDonacion({
      tipo: TIPOS_DE_DONACION.DINERO,
      fecha: "2026-09-18",
      donanteNombre: "Donante de prueba",
      detalles: [
        { id: 1, descripcion: "Aporte a", monto: 600 },
        { id: 2, descripcion: "Aporte b", monto: "400" },
      ],
    });

    expect(recibo.titulo).toBe("Donación de dinero registrada");
    expect(recibo.datos).toContainEqual({ label: "Donante", valor: "Donante de prueba" });
    expect(recibo.datos).toContainEqual({ label: "Fecha", valor: "18 de septiembre de 2026" });
    expect(recibo.datos.find((dato) => dato.label === "Total").valor).toMatch(/1[,.]?000/);
    expect(recibo.renglones).toHaveLength(2);
  });

  it("una donacion de medicamentos nombra el medicamento del catalogo y cuenta unidades", () => {
    const recibo = resumenLegibleDeDonacion(
      {
        tipo: TIPOS_DE_DONACION.MEDICAMENTOS,
        fecha: "2026-09-18",
        detalles: [{ id: 1, medicamentoId: "m1", cantidad: 25 }],
      },
      { medicamentos: [{ value: "m1", label: "Paracetamol 500 mg · Tableta" }] },
    );

    expect(recibo.renglones[0]).toMatchObject({
      texto: "Paracetamol 500 mg · Tableta",
      detalle: "25",
    });
    expect(recibo.datos).toContainEqual({ label: "Unidades", valor: "25" });
  });
});
