import { describe, expect, it } from "vitest";

import {
  hayCambiosDeTriaje,
  soloSignosCapturados,
  VALORES_INICIALES,
} from "./useRegistroTriaje.js";

// Las pruebas de calcularImc() se fueron con la funcion a triaje.validaciones.test.js (#699).

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

describe("hayCambiosDeTriaje", () => {
  it("arranca en false con los valores iniciales", () => {
    expect(hayCambiosDeTriaje(VALORES_INICIALES, null)).toBe(false);
  });

  it("se prende al escribir un campo", () => {
    expect(hayCambiosDeTriaje({ ...VALORES_INICIALES, presionSistolica: "120" }, null)).toBe(true);
  });

  it("se apaga tras un guardar exitoso, aunque los valores sigan capturados", () => {
    expect(
      hayCambiosDeTriaje({ ...VALORES_INICIALES, presionSistolica: "120" }, { id: "algo" }),
    ).toBe(false);
  });
});
