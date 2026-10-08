// Pruebas de los rechazos de inventario con mensaje propio (issue #925): antes la pantalla decia
// "Alguno de los datos no cumple las reglas del sistema" cuando el servidor sabia el motivo.

import { describe, expect, it } from "vitest";

import { normalizarErrorConReglas } from "../api/errores-de-supabase.js";
import { REGLAS_DE_RECHAZO_DE_INVENTARIO } from "./rechazos.js";

const traducir = (message, code = "55000") =>
  normalizarErrorConReglas(
    { code, message, details: "", hint: "" },
    REGLAS_DE_RECHAZO_DE_INVENTARIO,
  ).mensaje;

describe("normalizarErrorConReglas con los rechazos de inventario", () => {
  it("el proyecto cancelado lo dice con un texto propio", () => {
    expect(traducir("El proyecto esta cancelado: ya no se puede modificar.")).toBe(
      "El proyecto está cancelado: ya no se puede modificar su inventario.",
    );
  });

  it("reutiliza solo los numeros de la existencia insuficiente", () => {
    expect(
      traducir("Existencia insuficiente en Bodega X. Disponible: 3, solicitado: 5.", "23514"),
    ).toMatch(/^No hay existencia suficiente: hay 3 disponible\(s\) y se pidieron 5\./);
  });

  it("no reenvia nombres del servidor: la bodega ocupada se dice sin nombrarla", () => {
    const mensaje = traducir(
      "La bodega Movil 1 esta ahora en la jornada Visita norte, que sigue en curso: cargala cuando esa jornada termine.",
    );
    expect(mensaje).not.toContain("Visita norte");
    expect(mensaje).toMatch(/otra jornada en curso/);
  });

  it("lo que le queda a la jornada al devolver", () => {
    expect(
      traducir(
        "De ese lote, a esta jornada le quedan 7 unidad(es): no se puede devolver mas.",
        "23514",
      ),
    ).toBe("De ese lote, a esta jornada le quedan 7 unidad(es): no se puede devolver más.");
  });

  it("un rechazo desconocido conserva el mensaje generico de normalizarError()", () => {
    expect(traducir("algo que nadie previo")).toMatch(/no cumple las reglas del sistema/);
  });

  it("sin mensaje no hay regla que aplicar", () => {
    const error = normalizarErrorConReglas({ code: "55000" }, REGLAS_DE_RECHAZO_DE_INVENTARIO);
    expect(error.mensaje).toMatch(/no cumple las reglas del sistema/);
  });
});
