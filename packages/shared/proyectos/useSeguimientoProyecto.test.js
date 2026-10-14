// Prueba de la logica pura de useSeguimientoProyecto.js.
//
// El hook en si no se monta: packages/shared corre vitest en environment "node", sin DOM. La
// cuenta de esCumplido/esVencido vive en procesarHito(), exportada aparte del hook justamente
// para poder probarla con un fechaHoy fijo (issue #725).

import { describe, expect, it } from "vitest";

import { procesarHito } from "./useSeguimientoProyecto.js";

describe("procesarHito", () => {
  const FECHA_HOY = "2026-06-15";

  it("un hito con fechaReal esta cumplido, sin importar su fechaPrevista", () => {
    const hito = procesarHito({ fechaPrevista: "2026-01-01", fechaReal: "2026-06-10" }, FECHA_HOY);

    expect(hito.esCumplido).toBe(true);
    expect(hito.esVencido).toBe(false);
  });

  it("un hito sin cumplir con fechaPrevista anterior a hoy esta vencido", () => {
    const hito = procesarHito({ fechaPrevista: "2026-06-01" }, FECHA_HOY);

    expect(hito.esCumplido).toBe(false);
    expect(hito.esVencido).toBe(true);
  });

  it("un hito sin cumplir con fechaPrevista de hoy todavia no esta vencido", () => {
    const hito = procesarHito({ fechaPrevista: FECHA_HOY }, FECHA_HOY);

    expect(hito.esVencido).toBe(false);
  });

  it("un hito sin cumplir con fechaPrevista futura no esta vencido", () => {
    const hito = procesarHito({ fechaPrevista: "2026-12-01" }, FECHA_HOY);

    expect(hito.esVencido).toBe(false);
  });

  it("un hito sin fechaPrevista no se marca vencido", () => {
    const hito = procesarHito({}, FECHA_HOY);

    expect(hito.esVencido).toBe(false);
  });

  it("conserva el resto de columnas del hito", () => {
    const hito = procesarHito({ id: "hito-1", nombre: "Entrega de informe" }, FECHA_HOY);

    expect(hito.id).toBe("hito-1");
    expect(hito.nombre).toBe("Entrega de informe");
  });
});
