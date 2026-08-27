// Pruebas de las reglas del triaje.
//
// Se importan los modulos directamente y no el barril packages/shared/index.js: el barril
// arrastra @supabase/supabase-js y el modulo de entorno, y estas pruebas corren sin .env.
//
// Ningun dato real: los signos vitales son inventados.

import { describe, expect, it } from "vitest";

import { CAMPOS_TRIAJE } from "./campos.js";
import {
  SIGNOS_OPCIONALES,
  advertenciasDeTriaje,
  validarCambioDeTriaje,
  validarTriaje,
} from "./triaje.validaciones.js";

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

  it("rechaza un valor fisiologicamente imposible indicando el rango aceptado (criterio 1)", () => {
    const errores = validarTriaje(triajeValido({ presionSistolica: 900 }));

    expect(errores.presionSistolica).toContain("40");
    expect(errores.presionSistolica).toContain("300");
    expect(errores.presionSistolica).toContain("mmHg");
  });

  it("tolera que no le pasen nada", () => {
    expect(validarTriaje(undefined)).toHaveProperty("presionSistolica");
  });

  it("rechaza cada signo fuera de su rango, tomando el limite de CAMPOS_TRIAJE", () => {
    for (const campo of CAMPOS_TRIAJE) {
      const { min, max } = campo.validacion;

      const porDebajo = validarTriaje(triajeValido({ [campo.id]: min - 1 }));
      expect(porDebajo, `${campo.id} por debajo del minimo`).toHaveProperty(campo.id);

      const porEncima = validarTriaje(triajeValido({ [campo.id]: max + 1 }));
      expect(porEncima, `${campo.id} por encima del maximo`).toHaveProperty(campo.id);
    }
  });

  it("acepta cada signo en el limite exacto del rango (BETWEEN es inclusivo)", () => {
    // presionSistolica y presionDiastolica no son independientes entre si (criterio 4): moverlas a
    // su propio limite exige mantener la pareja coherente, o el rechazo seria por incoherencia y
    // no por el limite que esta prueba quiere aislar.
    const parCoherente = {
      presionSistolica: { min: { presionDiastolica: 20 }, max: {} },
      presionDiastolica: { min: {}, max: { presionSistolica: 300 } },
    };

    for (const campo of CAMPOS_TRIAJE) {
      const { min, max } = campo.validacion;
      const ajustePar = parCoherente[campo.id] ?? { min: {}, max: {} };

      expect(
        validarTriaje(triajeValido({ [campo.id]: min, ...ajustePar.min })),
        `${campo.id} en el minimo`,
      ).toEqual({});
      expect(
        validarTriaje(triajeValido({ [campo.id]: max, ...ajustePar.max })),
        `${campo.id} en el maximo`,
      ).toEqual({});
    }
  });

  it("no reporta rango sobre un signo opcional ausente", () => {
    // Criterio de aceptacion 1: un rango solo aplica a un valor que efectivamente llego.
    expect(validarTriaje(triajeValido())).toEqual({});
  });

  describe("coherencia sistolica > diastolica (criterio 4)", () => {
    it("rechaza cuando son iguales: 'mayor que' excluye la igualdad", () => {
      const errores = validarTriaje(triajeValido({ presionSistolica: 80, presionDiastolica: 80 }));
      expect(errores.presionDiastolica).toContain("menor que");
    });

    it("rechaza cuando la diastolica es mayor que la sistolica", () => {
      const errores = validarTriaje(triajeValido({ presionSistolica: 80, presionDiastolica: 90 }));
      expect(errores.presionDiastolica).toBeDefined();
    });

    it("acepta cuando la sistolica es estrictamente mayor", () => {
      expect(
        validarTriaje(triajeValido({ presionSistolica: 90, presionDiastolica: 80 })),
      ).toEqual({});
    });
  });

  it("precedencia: un valor ya rechazado por imposible no compite con la advertencia (criterio 2 vs 1)", () => {
    // La glucosa de 3000 del issue: es un rechazo, no una advertencia con umbral de alarma.
    const valores = triajeValido({ glucosa: 3000 });

    expect(validarTriaje(valores)).toHaveProperty("glucosa");
    expect(advertenciasDeTriaje(valores, { anios: 30, meses: 0 })).toEqual({});
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

  it("rechaza una correccion a un valor imposible (issue #118, no solo #117)", () => {
    expect(validarCambioDeTriaje({ glucosa: 3000 })).toHaveProperty("glucosa");
  });

  it("no evalua coherencia de presion si la correccion trae solo una de las dos", () => {
    // La otra presion ya esta en la fila y esta funcion no la lee (no toca la base). El valor de
    // abajo (200) es el maximo valido de diastolica en solitario: sin la sistolica no hay con que
    // compararlo.
    expect(validarCambioDeTriaje({ presionDiastolica: 200 })).toEqual({});
  });
});

describe("advertenciasDeTriaje", () => {
  const pediatrico = { anios: 10, meses: 0, texto: "10 anos" };
  const adulto = { anios: 30, meses: 0, texto: "30 anos" };

  it("no advierte nada sobre un triaje normal", () => {
    expect(advertenciasDeTriaje(triajeValido(), adulto)).toEqual({});
  });

  it("el mismo valor puede advertir en un tramo de edad y no en otro (criterio 3)", () => {
    // 150 lpm: dentro del umbral pediatrico propuesto (60-160), fuera del umbral adulto (50-120).
    const valores = triajeValido({ frecuenciaCardiaca: 150 });

    expect(advertenciasDeTriaje(valores, pediatrico)).toEqual({});
    expect(advertenciasDeTriaje(valores, adulto)).toHaveProperty("frecuenciaCardiaca");
  });

  it("edad null (fecha de nacimiento invalida) cae al tramo adulto", () => {
    const valores = triajeValido({ frecuenciaCardiaca: 150 });
    expect(advertenciasDeTriaje(valores, null)).toHaveProperty("frecuenciaCardiaca");
  });

  it("exige el parametro de edad: no lo resuelve en silencio si no se lo pasan", () => {
    // A diferencia de `null` (edad desconocida, documentado), omitir el parametro es un error de
    // quien llama: no puede resolverse aplicando en silencio el tramo adulto a un lactante.
    expect(() => advertenciasDeTriaje(triajeValido())).toThrow();
  });

  it("no reporta nada sobre un signo opcional ausente", () => {
    expect(advertenciasDeTriaje(triajeValido(), adulto)).toEqual({});
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

  it("fija min/max contra los CHECK de la 00013 -- si esto se pone rojo, revisa la migracion antes de actualizar el numero aqui", () => {
    // Nada mantiene sincronizados estos limites con supabase/migrations/00013_atenciones_triajes.sql
    // por su cuenta: son dos archivos distintos. Esta prueba es el alambre de tropiezo, no una
    // tercera fuente de verdad -- si alguien cambia un limite en campos.js sin querer, esto avisa
    // antes de que el cliente empiece a aceptar en silencio lo que la base rechaza.
    const limites = Object.fromEntries(
      CAMPOS_TRIAJE.map((campo) => [campo.id, { min: campo.validacion.min, max: campo.validacion.max }]),
    );

    expect(limites).toEqual({
      presionSistolica: { min: 40, max: 300 },
      presionDiastolica: { min: 20, max: 200 },
      frecuenciaCardiaca: { min: 20, max: 250 },
      glucosa: { min: 20, max: 800 },
      peso: { min: 1, max: 400 },
      talla: { min: 30, max: 250 },
      temperatura: { min: 25, max: 45 },
    });
  });
});
