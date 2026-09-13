// Prueba de la logica pura del hook de correccion de triaje (issue #756).
//
// El hook en si no se monta: packages/shared corre vitest con environment "node", sin DOM,
// mismo motivo que useEdicionTurno.js. valoresDesdeTriaje() se exporta aparte para poder
// probarla sin montar nada.

import { describe, expect, it } from "vitest";

import { valoresDesdeTriaje } from "./useCorreccionTriaje.js";

describe("valoresDesdeTriaje", () => {
  it("sin triaje, todos los signos caen en null", () => {
    expect(valoresDesdeTriaje(null)).toEqual({
      presionSistolica: null,
      presionDiastolica: null,
      frecuenciaCardiaca: null,
      glucosa: null,
      peso: null,
      talla: null,
      temperatura: null,
    });
  });

  it("con triaje, copia cada signo tal cual", () => {
    const triaje = {
      id: "triaje-1",
      presionSistolica: 120,
      presionDiastolica: 80,
      frecuenciaCardiaca: 72,
      glucosa: 95,
      peso: 68,
      talla: 165,
      temperatura: 36.5,
      imc: 25,
    };

    expect(valoresDesdeTriaje(triaje)).toEqual({
      presionSistolica: 120,
      presionDiastolica: 80,
      frecuenciaCardiaca: 72,
      glucosa: 95,
      peso: 68,
      talla: 165,
      temperatura: 36.5,
    });
  });

  it("un signo opcional ausente cae en null, no en undefined", () => {
    const triaje = {
      id: "triaje-1",
      presionSistolica: 120,
      presionDiastolica: 80,
      frecuenciaCardiaca: 72,
    };

    const valores = valoresDesdeTriaje(triaje);
    expect(valores.glucosa).toBeNull();
    expect(valores.peso).toBeNull();
  });
});
