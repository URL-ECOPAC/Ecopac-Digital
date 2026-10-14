// Pruebas de lo puro que agrego la issue #925 fuera de los modulos que ya tenian su archivo de
// pruebas: el mensaje sin sobrante, las etiquetas del formulario de salida y las filas de los
// insumos que les quedan a las jornadas de un proyecto (00186).

import { describe, expect, it } from "vitest";

import { etiquetaDeArticulo, etiquetaDeLoteDeSalida } from "../inventario/campos.js";
import {
  agruparPendientesDeValidacion,
  avisoDeRechazoDeEntregaDeReceta,
} from "../inventario/entregasDeReceta.js";
import { mensajeSinSobrante } from "../presupuestos/useSobranteDeJornada.js";
import { aInsumoQueQuedaEnProyecto } from "./insumos.api.js";

describe("mensajeSinSobrante", () => {
  it("una jornada sin presupuesto no 'gasto todo su presupuesto'", () => {
    expect(mensajeSinSobrante({ presupuestoAsignado: 0 })).toMatch(/no tuvo presupuesto/);
    expect(mensajeSinSobrante({ presupuestoAsignado: null })).toMatch(/no tuvo presupuesto/);
  });

  it("con presupuesto y sin sobrante, lo gasto todo", () => {
    expect(mensajeSinSobrante({ presupuestoAsignado: "500.00" })).toMatch(/gastó todo/);
  });

  it("si ya se liquido, lo dice", () => {
    expect(mensajeSinSobrante({ liquidados: [{}], presupuestoAsignado: 500 })).toBe(
      "No queda sobrante por liquidar.",
    );
  });
});

describe("etiquetas del formulario de salida", () => {
  it("un insumo sin concentracion no lleva parentesis vacios", () => {
    expect(etiquetaDeArticulo({ nombre: "Guantes de nitrilo", concentracion: null })).toBe(
      "Guantes de nitrilo",
    );
    expect(etiquetaDeArticulo({ nombre: "Loratadina", concentracion: "10 mg" })).toBe(
      "Loratadina (10 mg)",
    );
  });

  it("el lote lleva el vencimiento con el formato de la app, no en ISO", () => {
    const etiqueta = etiquetaDeLoteDeSalida({
      numeroLote: "L-1",
      bodega: "Bodega Principal",
      fechaVencimiento: "2028-02-16",
      cantidadDisponible: 280,
    });
    expect(etiqueta).toBe("Lote: L-1 · Bodega Principal · vence 16/02/2028 · 280 disponibles");
    expect(etiqueta).not.toContain("2028-02-16");
  });

  it("un lote sin fecha no vence", () => {
    expect(
      etiquetaDeLoteDeSalida({ numeroLote: "G-1", bodega: "B", cantidadDisponible: 3 }),
    ).toMatch(/no vence/);
  });
});

describe("aInsumoQueQuedaEnProyecto", () => {
  const fila = {
    jornada_id: "j-1",
    jornada: "Jornada norte",
    bodega: "Movil 1",
    lote_id: "l-1",
    articulo: "Loratadina",
    concentracion: "10 mg",
    numero_lote: "L-1",
    fecha_vencimiento: "2028-02-16",
    costo_unitario: "2.50",
    queda: 4,
  };

  it("la cantidad es lo que le queda a la jornada, con su valor", () => {
    expect(aInsumoQueQuedaEnProyecto(fila)).toMatchObject({
      jornadaId: "j-1",
      jornada: "Jornada norte",
      articulo: "Loratadina (10 mg)",
      cantidadDisponible: 4,
      costoUnitario: 2.5,
      valor: 10,
    });
  });

  it("sin costo, el valor queda en null y no en cero", () => {
    expect(aInsumoQueQuedaEnProyecto({ ...fila, costo_unitario: null }).valor).toBeNull();
  });
});

describe("avisoDeRechazoDeEntregaDeReceta", () => {
  it("avisa que rechazar la entrega anula la receta, con su folio", () => {
    const aviso = avisoDeRechazoDeEntregaDeReceta({
      tipo: "salida",
      receta_id: "r-1",
      motivo: "Entrega por receta medica REC-12AB",
    });
    expect(aviso).toMatch(/REC-12AB/);
    expect(aviso).toMatch(/anula la receta completa/);
  });

  it("un ajuste, un ingreso o un movimiento sin receta no anulan nada", () => {
    expect(
      avisoDeRechazoDeEntregaDeReceta({
        tipo: "salida",
        receta_id: "r-1",
        motivo: "Ajuste de entrega: se entrego 1 unidad(es) mas",
      }),
    ).toBeNull();
    expect(
      avisoDeRechazoDeEntregaDeReceta({
        tipo: "ingreso",
        receta_id: "r-1",
        motivo: "Entrega por receta medica REC-1",
      }),
    ).toBeNull();
    expect(avisoDeRechazoDeEntregaDeReceta({ tipo: "salida", motivo: "baja" })).toBeNull();
  });
});

// Issue #925: en la bandeja, la entrega de una receta es una sola fila.
describe("agruparPendientesDeValidacion", () => {
  const entrega = (id, recetaId, folio) => ({
    id,
    tipo: "salida",
    receta_id: recetaId,
    motivo: `Entrega por receta medica ${folio}`,
  });

  it("junta las salidas de una misma receta y deja solos los demas movimientos", () => {
    const filas = agruparPendientesDeValidacion([
      entrega("m1", "r1", "REC-1"),
      { id: "m2", tipo: "ingreso", motivo: "Donacion" },
      entrega("m3", "r1", "REC-1"),
      entrega("m4", "r2", "REC-2"),
      { id: "m5", tipo: "salida", receta_id: "r1", motivo: "Ajuste de entrega: ..." },
    ]);

    expect(filas.map((fila) => fila.clave)).toEqual(["receta:r1", "m2", "receta:r2", "m5"]);
    expect(filas[0].movimientos.map((m) => m.id)).toEqual(["m1", "m3"]);
    expect(filas[0].folio).toBe("REC-1");
    expect(filas[0].movimiento.id).toBe("m1");
    // Un ajuste de entrega no se junta con la receta: se valida solo.
    expect(filas[3].esEntregaDeReceta).toBe(false);
  });

  it("sin pendientes no hay filas", () => {
    expect(agruparPendientesDeValidacion([])).toEqual([]);
  });
});
