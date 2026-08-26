// Pruebas de las reglas del triaje.
//
// Se importan los modulos directamente y no el barril packages/shared/index.js: el barril
// arrastra @supabase/supabase-js y el modulo de entorno, y estas pruebas corren sin .env.
//
// Ningun dato real: los signos vitales son inventados.

import { describe, expect, it } from "vitest";

import { CAMPOS_TRIAJE } from "./campos.js";
import { SIGNOS_OPCIONALES, validarCambioDeTriaje, validarTriaje } from "./triaje.validaciones.js";

/** Triaje minimo valido: los tres signos que la tabla exige. */
function triajeValido(cambios = {}) {
  return {
    presionSistolica: 120,
    presionDiastolica: 80,
    frecuenciaCardiaca: 70,
    ...cambios,
  };
}

describe("validarTriaje", () => {
  it("acepta un triaje con solo los tres signos obligatorios", () => {
    // Es el caso de campo: sin glucometro, sin bascula y sin termometro.
    expect(validarTriaje(triajeValido())).toEqual({});
  });

  it("acepta un triaje completo", () => {
    expect(
      validarTriaje(triajeValido({ glucosa: 95, peso: 70, talla: 170, temperatura: 36.5 })),
    ).toEqual({});
  });

  it("exige presion sistolica, diastolica y frecuencia cardiaca", () => {
    // No es una decision de este archivo: son las tres columnas NOT NULL de la 00013.
    const errores = validarTriaje({});

    expect(Object.keys(errores).sort()).toEqual([
      "frecuenciaCardiaca",
      "presionDiastolica",
      "presionSistolica",
    ]);
  });

  it("no exige ninguno de los cuatro opcionales", () => {
    // Criterio de aceptacion 2: los signos parciales son un requisito de campo.
    const errores = validarTriaje(triajeValido());

    for (const opcional of SIGNOS_OPCIONALES) {
      expect(errores[opcional]).toBeUndefined();
    }
  });

  it("SIGNOS_OPCIONALES sale del descriptor y son exactamente cuatro", () => {
    expect([...SIGNOS_OPCIONALES].sort()).toEqual(["glucosa", "peso", "talla", "temperatura"]);
  });

  it("no valida rangos: eso es la issue #118", () => {
    // Una presion de 900 mmHg es imposible, pero rechazarla con el rango aceptado es el criterio
    // de aceptacion 1 de #118, de AnderNoleon. Mientras tanto la frena el CHECK de la base.
    // Si esta prueba empieza a fallar es porque alguien invadio esa issue desde aqui.
    expect(validarTriaje(triajeValido({ presionSistolica: 900 }))).toEqual({});
  });

  it("tolera que no le pasen nada", () => {
    expect(validarTriaje(undefined)).toHaveProperty("presionSistolica");
  });
});

describe("validarCambioDeTriaje", () => {
  it("una correccion de la glucosa no exige la presion que no viene", () => {
    // En un UPDATE los obligatorios ya estan en la fila y no viajan.
    expect(validarCambioDeTriaje({ glucosa: 110 })).toEqual({});
  });

  it("pero si viene un obligatorio vacio, lo rechaza", () => {
    // Es un intento de vaciar una columna NOT NULL: mejor decirlo aqui que recibir un 23502.
    expect(validarCambioDeTriaje({ presionSistolica: "" })).toHaveProperty("presionSistolica");
  });

  it("sin campos no reporta nada", () => {
    expect(validarCambioDeTriaje({})).toEqual({});
  });
});

describe("CAMPOS_TRIAJE", () => {
  it("declara la unidad de cada signo, que es la que espera la base", () => {
    // Criterio de aceptacion 5. La talla en centimetros es la que importa: el IMC generado de la
    // 00013 divide por POWER(talla / 100.0, 2), asi que enviarla en metros daria un IMC absurdo
    // sin que nada fallara.
    const sufijos = Object.fromEntries(CAMPOS_TRIAJE.map((c) => [c.id, c.sufijo]));

    expect(sufijos).toEqual({
      presionSistolica: "mmHg",
      presionDiastolica: "mmHg",
      frecuenciaCardiaca: "lpm",
      glucosa: "mg/dL",
      peso: "kg",
      talla: "cm",
      temperatura: "°C",
    });
  });

  it("no declara el IMC: lo calcula la base", () => {
    // Criterio de aceptacion 4. Si apareciera aqui, alguna pantalla lo pediria y la API
    // intentaria enviarlo a una columna generada.
    expect(CAMPOS_TRIAJE.some((campo) => campo.id === "imc")).toBe(false);
  });
});
