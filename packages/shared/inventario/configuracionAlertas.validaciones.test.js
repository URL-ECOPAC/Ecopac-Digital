// Pruebas de las reglas de las antelaciones de los avisos de vencimiento (issue #899). Replican
// fn_umbrales_caducidad_validos() y fn_etapa_caducidad() de la migracion 00162.

import { describe, expect, it } from "vitest";

import {
  MAXIMO_DE_UMBRALES,
  UMBRALES_POR_DEFECTO,
  describirEtapa,
  etapaDeVencimiento,
  normalizarUmbrales,
  resumenDeAvisos,
  validarUmbrales,
  ventanaDeAviso,
} from "./configuracionAlertas.validaciones.js";

describe("validarUmbrales", () => {
  it("acepta de cero a cuatro antelaciones distintas entre 1 y 365", () => {
    expect(validarUmbrales([])).toBeNull();
    expect(validarUmbrales(["90"])).toBeNull();
    expect(validarUmbrales([7, 90, "30", 60])).toBeNull();
    expect(validarUmbrales([1, 365])).toBeNull();
  });

  it("admite como maximo cuatro", () => {
    expect(validarUmbrales([90, 60, 30, 15, 7]).general).toMatch(`${MAXIMO_DE_UMBRALES}`);
  });

  it("marca el renglon vacio, fuera de rango, con decimales o repetido", () => {
    const errores = validarUmbrales(["", "0", "366", "2.5"]);
    expect(Object.keys(errores.porRenglon)).toEqual(["0", "1", "2", "3"]);

    const repetido = validarUmbrales(["30", "30"]);
    expect(repetido.porRenglon).toEqual({ 1: "Esta antelación ya está en la lista." });
  });
});

describe("normalizarUmbrales y ventanaDeAviso", () => {
  it("deja enteros de mayor a menor, igual que el trigger de la base", () => {
    expect(normalizarUmbrales(["7", 90, "", null, "30"])).toEqual([90, 30, 7]);
  });

  it("la ventana es la antelacion mas larga, y por defecto 90", () => {
    expect(ventanaDeAviso([7, 60, 30])).toBe(60);
    expect(ventanaDeAviso()).toBe(90);
    // Sin antelaciones solo cuenta lo que vence hoy o ya vencio.
    expect(ventanaDeAviso([])).toBe(0);
    expect(UMBRALES_POR_DEFECTO).toEqual([90]);
  });
});

describe("etapaDeVencimiento", () => {
  const umbrales = [90, 60, 30, 7];

  it("vence hoy o ya vencio: etapa 0, el aviso obligatorio", () => {
    expect(etapaDeVencimiento(0, umbrales)).toBe(0);
    expect(etapaDeVencimiento(-3, umbrales)).toBe(0);
  });

  it("dentro de la ventana, la antelacion mas corta que ya alcanzo", () => {
    expect(etapaDeVencimiento(25, umbrales)).toBe(30);
    expect(etapaDeVencimiento(30, umbrales)).toBe(30);
    expect(etapaDeVencimiento(31, umbrales)).toBe(60);
    expect(etapaDeVencimiento(5, umbrales)).toBe(7);
  });

  it("fuera de la ventana o sin fecha, sin etapa", () => {
    expect(etapaDeVencimiento(91, umbrales)).toBeNull();
    expect(etapaDeVencimiento(null, umbrales)).toBeNull();
  });
});

describe("textos", () => {
  it("describe cada etapa", () => {
    expect(describirEtapa(0)).toBe("Día del vencimiento");
    expect(describirEtapa(30)).toBe("30 días antes");
    expect(describirEtapa(1)).toBe("1 día antes");
    expect(describirEtapa(null)).toBe("Sin aviso todavía");
  });

  it("resume los avisos configurados incluyendo siempre el dia que vence", () => {
    expect(resumenDeAvisos([90])).toBe("90 días antes, y el día que vence");
    expect(resumenDeAvisos([7, 90, 30])).toBe("90, 30 y 7 días antes, y el día que vence");
    expect(resumenDeAvisos([])).toBe("Solo el día que vence");
  });
});
