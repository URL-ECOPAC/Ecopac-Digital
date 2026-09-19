// Pruebas de las reglas del triaje.
//
// Se importan los modulos directamente y no el barril packages/shared/index.js: el barril
// arrastra @supabase/supabase-js y el modulo de entorno, y estas pruebas corren sin .env.
//
// Ningun dato real: los signos vitales son inventados.

import { describe, expect, it } from "vitest";

import { CAMPOS_TRIAJE } from "./campos.js";
import {
  NIVELES_DE_AVISO,
  avisosDeSignos,
  calcularImc,
  haySignosCapturados,
  validarCambioDeTriaje,
  validarTriaje,
} from "./triaje.validaciones.js";

/** Un triaje con presion y frecuencia, que es lo que se toma casi siempre. */
function triajeValido(cambios = {}) {
  return {
    presionSistolica: 120,
    presionDiastolica: 80,
    frecuenciaCardiaca: 70,
    ...cambios,
  };
}

// calcularImc vive en este archivo desde la #699, junto a la regla que acota el IMC.
describe("calcularImc", () => {
  it("usa la misma formula y el mismo redondeo que la columna generada de la 00013", () => {
    expect(calcularImc(70, 170)).toBe(24.2);
    expect(calcularImc(62, 155)).toBe(25.8);
  });

  it("es null mientras falte peso o talla, y nunca infinito", () => {
    expect(calcularImc(70, null)).toBeNull();
    expect(calcularImc(null, 170)).toBeNull();
    expect(calcularImc("", "")).toBeNull();
    expect(calcularImc(70, 0)).toBeNull();
    expect(calcularImc(-5, 170)).toBeNull();
  });

  it("acepta los valores como texto, que es como llegan del formulario", () => {
    expect(calcularImc("70", "170")).toBe(24.2);
  });
});

describe("peso y talla coherentes entre si (issue #699)", () => {
  it("acepta la combinacion de un adulto y la de un lactante", () => {
    expect(validarTriaje(triajeValido({ peso: 70, talla: 170 }))).toEqual({});
    // 4 kg y 52 cm dan un IMC de 14,8: bajo, pero posible y real en jornada.
    expect(validarTriaje(triajeValido({ peso: 4, talla: 52 }))).toEqual({});
  });

  it("la talla tecleada en metros cae por su propio rango minimo", () => {
    expect(validarTriaje(triajeValido({ peso: 70, talla: 1.62 })).talla).toBeTruthy();
  });

  it("rechaza, sobre los dos campos, una combinacion que pasa los dos rangos por separado", () => {
    const errores = validarTriaje(triajeValido({ peso: 70, talla: 30 }));

    expect(errores.peso).toMatch(/masa corporal/i);
    expect(errores.talla).toBe(errores.peso);
  });

  it("en una correccion solo opina si trae los dos", () => {
    expect(validarCambioDeTriaje({ talla: 30 })).toEqual({});
    expect(validarCambioDeTriaje({ peso: 70, talla: 30 }).peso).toMatch(/masa corporal/i);
  });
});

describe("validarTriaje", () => {
  it("acepta presion y frecuencia sin nada mas", () => {
    // Es el caso de campo: sin glucometro, sin bascula y sin termometro.
    expect(validarTriaje(triajeValido())).toEqual({});
  });

  it("acepta un triaje completo", () => {
    expect(
      validarTriaje(triajeValido({ glucosa: 95, peso: 70, talla: 170, temperatura: 36.5 })),
    ).toEqual({});
  });

  // Issue #840 (B2, G2): ningun signo es obligatorio. En jornada muchas veces no hay tensiometro.
  it("acepta un triaje con un solo signo, sin presion", () => {
    expect(validarTriaje({ temperatura: 37.2 })).toEqual({});
    expect(validarTriaje({ peso: 12.5, talla: 88 })).toEqual({});
  });

  it("ningun campo del descriptor es obligatorio", () => {
    expect(CAMPOS_TRIAJE.every((campo) => campo.validacion.requerido === false)).toBe(true);
  });

  it("un triaje sin ningun signo no se registra (chk_triajes_al_menos_un_signo, 00136)", () => {
    expect(validarTriaje({})).toEqual({ signos: expect.any(String) });
    expect(haySignosCapturados({ glucosa: "" })).toBe(false);
  });

  it("la presion va completa (chk_triajes_presion_completa, 00136)", () => {
    expect(validarTriaje({ presionSistolica: 120 })).toHaveProperty("presionDiastolica");
    expect(validarTriaje({ presionDiastolica: 80 })).toHaveProperty("presionSistolica");
  });

  it("rechaza un valor fisiologicamente imposible indicando el rango aceptado (criterio 1)", () => {
    const errores = validarTriaje(triajeValido({ presionSistolica: 900 }));

    expect(errores.presionSistolica).toContain("40");
    expect(errores.presionSistolica).toContain("300");
    expect(errores.presionSistolica).toContain("mmHg");
  });

  it("tolera que no le pasen nada", () => {
    expect(validarTriaje(undefined)).toHaveProperty("signos");
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
      expect(validarTriaje(triajeValido({ presionSistolica: 90, presionDiastolica: 80 }))).toEqual(
        {},
      );
    });
  });

  it("el mensaje de lo imposible al guardar es el mismo que el aviso mientras se escribe", () => {
    // G2: un solo mensaje por campo. Si fueran textos distintos, la persona veria dos avisos.
    const valores = triajeValido({ glucosa: 3000 });
    const edad = { anios: 30, meses: 0 };

    expect(validarTriaje(valores).glucosa).toBe(avisosDeSignos(valores, edad).glucosa.mensaje);
  });
});

describe("validarCambioDeTriaje", () => {
  it("una correccion de la glucosa no exige la presion que no viene", () => {
    expect(validarCambioDeTriaje({ glucosa: 110 })).toEqual({});
  });

  it("vaciar un signo ya no es un error: todos son opcionales desde la 00136", () => {
    expect(validarCambioDeTriaje({ temperatura: "" })).toEqual({});
  });

  it("si la correccion trae las dos presiones, exige que vayan completas", () => {
    expect(validarCambioDeTriaje({ presionSistolica: 120, presionDiastolica: "" })).toHaveProperty(
      "presionDiastolica",
    );
  });

  it("sin campos no reporta nada", () => {
    expect(validarCambioDeTriaje({})).toEqual({});
  });

  it("rechaza una correccion a un valor imposible (issue #118, no solo #117)", () => {
    expect(validarCambioDeTriaje({ glucosa: 3000 })).toHaveProperty("glucosa");
  });

  it("no evalua la presion si la correccion trae solo una de las dos", () => {
    // La otra presion ya esta en la fila y esta funcion no la lee (no toca la base).
    expect(validarCambioDeTriaje({ presionDiastolica: 200 })).toEqual({});
  });
});

describe("avisosDeSignos (issue #840, G2)", () => {
  const lactante = { anios: 0, meses: 6, texto: "6 meses" };
  const escolar = { anios: 8, meses: 0, texto: "8 años" };
  const adulto = { anios: 30, meses: 0, texto: "30 años" };

  it("no avisa nada sobre un triaje normal", () => {
    expect(avisosDeSignos(triajeValido(), adulto)).toEqual({});
  });

  // El caso de la issue: una sistolica de 35 decia primero "alarmante" y despues "mayor que 40".
  it("una sistolica de 35 es imposible y solo imposible: un solo aviso, sin alarma", () => {
    const avisos = avisosDeSignos(triajeValido({ presionSistolica: 35 }), adulto);

    expect(avisos.presionSistolica.nivel).toBe(NIVELES_DE_AVISO.IMPOSIBLE);
    expect(avisos.presionSistolica.mensaje).toContain("40");
  });

  it("un valor posible pero de alarma se avisa como alarma", () => {
    // [AHA] crisis hipertensiva: sistolica > 180.
    const avisos = avisosDeSignos(triajeValido({ presionSistolica: 190 }), adulto);
    expect(avisos.presionSistolica.nivel).toBe(NIVELES_DE_AVISO.ALARMA);
  });

  it("el mismo valor avisa en un adulto y no en un lactante (PALS)", () => {
    // 150 lpm: normal despierto en un lactante (100-180), alarma en un adulto (NEWS2 >= 111).
    const valores = triajeValido({ frecuenciaCardiaca: 150 });

    expect(avisosDeSignos(valores, lactante)).toEqual({});
    expect(avisosDeSignos(valores, adulto).frecuenciaCardiaca.nivel).toBe(NIVELES_DE_AVISO.ALARMA);
  });

  it("la sistolica minima pediatrica sigue la regla 70 + 2 x edad de PALS", () => {
    // A los 8 anios el minimo es 86: 85 avisa, 86 no.
    expect(avisosDeSignos({ presionSistolica: 85, presionDiastolica: 50 }, escolar)).toHaveProperty(
      "presionSistolica",
    );
    expect(avisosDeSignos({ presionSistolica: 86, presionDiastolica: 50 }, escolar)).toEqual({});
  });

  it("38 grados es alarma en menores de 3 meses y no a los 6 meses (NICE NG143)", () => {
    const recienNacido = { anios: 0, meses: 1 };
    expect(avisosDeSignos({ temperatura: 38 }, recienNacido)).toHaveProperty("temperatura");
    expect(avisosDeSignos({ temperatura: 38 }, lactante)).toEqual({});
  });

  it("edad null (fecha de nacimiento invalida) usa los umbrales de adulto", () => {
    const valores = triajeValido({ frecuenciaCardiaca: 150 });
    expect(avisosDeSignos(valores, null)).toHaveProperty("frecuenciaCardiaca");
  });

  it("exige el parametro de edad: no lo resuelve en silencio si no se lo pasan", () => {
    expect(() => avisosDeSignos(triajeValido())).toThrow();
  });

  it("no reporta nada sobre un signo ausente", () => {
    expect(avisosDeSignos({}, adulto)).toEqual({});
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
      CAMPOS_TRIAJE.map((campo) => [
        campo.id,
        { min: campo.validacion.min, max: campo.validacion.max },
      ]),
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
