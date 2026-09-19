// Stock movil (issue #840, G5). La prueba anterior copiaba una funcion de filtrado dentro del
// archivo y probaba esa copia: el hook podia romperse sin que nada se pusiera en rojo. Esta prueba
// importa lo que la pantalla usa.

import { describe, expect, it } from "vitest";

import {
  DIAS_AVISO_VENCIMIENTO_STOCK,
  FILTROS_STOCK,
  FILTROS_STOCK_VACIOS,
  filaDeStock,
  filtrarStock,
} from "./useCatalogoMedicamentos.js";

const HOY = new Date(2026, 8, 18);

function fila(cambios = {}) {
  return {
    loteId: "lote-1",
    medicamentoId: "med-1",
    medicamentoNombre: "Acetaminofén 500 mg",
    numeroLote: "L-100",
    fechaVencimiento: "2027-09-18",
    cantidadDisponible: 40,
    bodegaId: "bod-1",
    bodega: "Bodega Inventada",
    ...cambios,
  };
}

describe("filaDeStock", () => {
  it("marca por vencer lo que vence dentro del aviso, y no lo que vence despues", () => {
    expect(filaDeStock(fila({ fechaVencimiento: "2026-10-01" }), HOY).porVencer).toBe(true);
    expect(filaDeStock(fila(), HOY).porVencer).toBe(false);
    expect(DIAS_AVISO_VENCIMIENTO_STOCK).toBe(30);
  });

  it("un mismo lote en dos bodegas son dos filas distintas", () => {
    expect(filaDeStock(fila(), HOY).id).not.toBe(filaDeStock(fila({ bodegaId: "bod-2" }), HOY).id);
  });
});

describe("filtrarStock", () => {
  const filas = [
    filaDeStock(fila(), HOY),
    filaDeStock(
      fila({
        loteId: "lote-2",
        medicamentoNombre: "Ibuprofeno",
        numeroLote: "X-9",
        bodegaId: "bod-2",
      }),
      HOY,
    ),
  ];

  it("sin filtros devuelve todo", () => {
    expect(filtrarStock(filas, FILTROS_STOCK_VACIOS)).toHaveLength(2);
  });

  it("busca sin acentos, por medicamento o por lote", () => {
    expect(filtrarStock(filas, { busqueda: "acetaminofen", bodega: "" })).toHaveLength(1);
    expect(filtrarStock(filas, { busqueda: "x-9", bodega: "" })[0].nombre).toBe("Ibuprofeno");
  });

  it("filtra por el id de la bodega, no por parecido del nombre", () => {
    expect(filtrarStock(filas, { busqueda: "", bodega: "bod-2" })).toHaveLength(1);
  });
});

describe("FILTROS_STOCK", () => {
  it("no ofrece categorias: el esquema no tiene ninguna", () => {
    expect(FILTROS_STOCK.map((filtro) => filtro.id)).toEqual(["busqueda", "bodega"]);
  });
});
