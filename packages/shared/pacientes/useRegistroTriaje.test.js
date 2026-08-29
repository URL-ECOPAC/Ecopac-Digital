import { describe, expect, it } from "vitest";

import { calcularImc, soloSignosCapturados } from "./useRegistroTriaje.js";

describe("calcularImc", () => {
  it("usa la misma formula y el mismo redondeo que la columna generada de la 00013", () => {
    expect(calcularImc(70, 170)).toBe(24.2);
    expect(calcularImc(62, 155)).toBe(25.8);
  });

  it("es null mientras falte peso o talla", () => {
    expect(calcularImc(70, null)).toBeNull();
    expect(calcularImc(null, 170)).toBeNull();
    expect(calcularImc("", "")).toBeNull();
  });

  it("no devuelve infinito con talla cero ni con valores negativos", () => {
    expect(calcularImc(70, 0)).toBeNull();
    expect(calcularImc(-5, 170)).toBeNull();
  });

  it("acepta los valores como texto, que es como llegan del formulario", () => {
    expect(calcularImc("70", "170")).toBe(24.2);
  });
});

describe("soloSignosCapturados", () => {
  it("deja fuera los campos que el equipo no pudo medir", () => {
    expect(
      soloSignosCapturados({
        presionSistolica: 120,
        presionDiastolica: 80,
        frecuenciaCardiaca: 72,
        glucosa: "",
        peso: null,
        talla: undefined,
      }),
    ).toEqual({ presionSistolica: 120, presionDiastolica: 80, frecuenciaCardiaca: 72 });
  });

  it("conserva el cero, que es un valor medido y no un campo vacio", () => {
    expect(soloSignosCapturados({ glucosa: 0 })).toEqual({ glucosa: 0 });
  });

  it("no falla con un objeto vacio", () => {
    expect(soloSignosCapturados({})).toEqual({});
    expect(soloSignosCapturados()).toEqual({});
  });
});
