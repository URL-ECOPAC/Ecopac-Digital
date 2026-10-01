// Pruebas de las funciones puras de la pestana Gastos del detalle de una jornada. El hook no se
// monta: vitest corre aqui en environment "node" (ver useEjecucionPresupuestal.test.js).

import { describe, expect, it } from "vitest";

import { COLUMNAS_GASTO_DE_JORNADA } from "./columnas.js";
import { valoresInicialesDeGasto } from "./useFormularioGasto.js";
import { resumirGastosDeJornada } from "./useGastosDeJornada.js";

describe("resumirGastosDeJornada", () => {
  it("lo disponible descuenta lo aprobado y lo pendiente de aprobacion", () => {
    expect(
      resumirGastosDeJornada({ asignado: 5000, gastado: 1200, disponible: 3800, pendiente: 300 }),
    ).toEqual({ asignado: 5000, aprobado: 1200, pendiente: 300, disponible: 3500 });
  });

  it("redondea a centavos", () => {
    expect(
      resumirGastosDeJornada({ asignado: 100.1, gastado: 50.05, disponible: 0, pendiente: 0.02 })
        .disponible,
    ).toBe(50.03);
  });

  it("sin presupuesto (la jornada no se ve o no existe) no inventa ceros", () => {
    expect(resumirGastosDeJornada(null)).toBeNull();
  });
});

describe("COLUMNAS_GASTO_DE_JORNADA", () => {
  it("no repite la jornada ni el proyecto, que son siempre los mismos", () => {
    const ids = COLUMNAS_GASTO_DE_JORNADA.map((columna) => columna.id);
    expect(ids).not.toContain("jornada_id");
    expect(ids).not.toContain("proyecto_id");
    expect(ids).toEqual(
      expect.arrayContaining(["concepto", "categoria", "fecha", "monto", "estado"]),
    );
  });
});

describe("valoresInicialesDeGasto con jornada fija", () => {
  it("un gasto nuevo desde el detalle de la jornada ya trae su jornada", () => {
    expect(valoresInicialesDeGasto(null, "pendiente", "j-1").jornada_id).toBe("j-1");
  });

  it("al editar manda la jornada del gasto", () => {
    expect(valoresInicialesDeGasto({ jornada_id: "j-2" }, undefined, "j-1").jornada_id).toBe("j-2");
  });

  it("sin jornada fija queda por elegir", () => {
    expect(valoresInicialesDeGasto(null).jornada_id).toBe("");
  });
});
