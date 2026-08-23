// Pruebas de las utilidades de fecha compartidas.
//
// Se importa fechas.js directamente y no el barril packages/shared/index.js: el barril
// reexporta api/index.js, que arrastra @supabase/supabase-js y el modulo de entorno, y estas
// pruebas tienen que correr sin .env y sin conexion a Supabase.
//
// Todas las aserciones valen en cualquier zona horaria. Es a proposito: el CI corre en UTC y
// el equipo trabaja en UTC-6, y una prueba que solo pasa en una de las dos no sirve para
// proteger justamente la regla que este modulo implementa.

import { describe, expect, it } from "vitest";

import {
  aFechaLocal,
  calcularEdad,
  diasHastaVencimiento,
  DIAS_DE_LA_SEMANA,
  esFechaValida,
  formatearFechaConHora,
  formatearFechaCorta,
  formatearFechaLarga,
  MESES,
} from "./fechas.js";

describe("aFechaLocal", () => {
  it("lee una cadena AAAA-MM-DD como dia de calendario, sin correrla de dia", () => {
    // El caso que documenta la cabecera de fechas.js: new Date("2026-08-18") es medianoche
    // UTC, y en Guatemala getDate() devolveria 17. Aqui el dia se conserva en toda zona.
    const fecha = aFechaLocal("2026-08-18");

    expect(fecha.getFullYear()).toBe(2026);
    expect(fecha.getMonth()).toBe(7);
    expect(fecha.getDate()).toBe(18);
    expect(fecha.getTime()).toBe(new Date(2026, 7, 18).getTime());
  });

  it("recorta espacios alrededor de una cadena de solo fecha", () => {
    expect(aFechaLocal("  2026-08-18  ").getDate()).toBe(18);
  });

  it("convierte una marca de tiempo completa al instante que representa", () => {
    // Una TIMESTAMPTZ si es un instante: se delega a Date, que aplica la zona local al leerla.
    const marca = "2026-08-18T02:30:00Z";

    expect(aFechaLocal(marca).getTime()).toBe(Date.parse(marca));
  });

  it("devuelve el mismo Date cuando ya recibe uno valido", () => {
    const fecha = new Date(2026, 7, 18);

    expect(aFechaLocal(fecha)).toBe(fecha);
  });

  it("devuelve null ante ausencia de valor o texto que no es fecha", () => {
    expect(aFechaLocal(null)).toBeNull();
    expect(aFechaLocal(undefined)).toBeNull();
    expect(aFechaLocal("")).toBeNull();
    expect(aFechaLocal("no es una fecha")).toBeNull();
    expect(aFechaLocal(new Date("no es una fecha"))).toBeNull();
  });
});

describe("esFechaValida", () => {
  it("acepta lo que aFechaLocal sabe interpretar y rechaza lo demas", () => {
    expect(esFechaValida("2026-08-18")).toBe(true);
    expect(esFechaValida(new Date(2026, 7, 18))).toBe(true);
    expect(esFechaValida("")).toBe(false);
    expect(esFechaValida(null)).toBe(false);
  });
});

describe("formatearFechaCorta", () => {
  it("da dd/mm/aaaa con ceros a la izquierda", () => {
    expect(formatearFechaCorta("2026-08-18")).toBe("18/08/2026");
    expect(formatearFechaCorta("2026-01-05")).toBe("05/01/2026");
  });

  it("da cadena vacia si el valor no es una fecha", () => {
    expect(formatearFechaCorta(null)).toBe("");
    expect(formatearFechaCorta("no es una fecha")).toBe("");
  });
});

describe("formatearFechaLarga", () => {
  it("escribe el mes en espanol, sin depender de los datos ICU del sistema", () => {
    expect(formatearFechaLarga("2026-08-18")).toBe("18 de agosto de 2026");
    expect(formatearFechaLarga("2026-12-01")).toBe("1 de diciembre de 2026");
  });

  it("da cadena vacia si el valor no es una fecha", () => {
    expect(formatearFechaLarga(undefined)).toBe("");
  });
});

describe("formatearFechaConHora", () => {
  it("agrega la hora en 24 horas, con ceros a la izquierda", () => {
    expect(formatearFechaConHora(new Date(2026, 7, 18, 14, 30))).toBe("18/08/2026 14:30");
    expect(formatearFechaConHora(new Date(2026, 7, 18, 9, 5))).toBe("18/08/2026 09:05");
  });

  it("una fecha sin hora se muestra a las 00:00", () => {
    expect(formatearFechaConHora("2026-08-18")).toBe("18/08/2026 00:00");
  });

  it("da cadena vacia si el valor no es una fecha", () => {
    expect(formatearFechaConHora("")).toBe("");
  });
});

describe("calcularEdad", () => {
  // El "hoy" entra siempre por parametro: la edad no puede depender del reloj de quien corre
  // las pruebas, o el resultado cambiaria de un dia para otro.

  it("cuenta el anio cumplido el mismo dia del cumpleanos", () => {
    expect(calcularEdad("1990-08-18", "2026-08-18")).toEqual({
      anios: 36,
      meses: 0,
      texto: "36 anos",
    });
  });

  it("no cuenta el anio el dia anterior al cumpleanos", () => {
    const edad = calcularEdad("1990-08-18", "2026-08-17");

    expect(edad.anios).toBe(35);
    expect(edad.meses).toBe(11);
  });

  it("expresa la edad de un lactante en meses", () => {
    expect(calcularEdad("2026-03-18", "2026-08-18")).toEqual({
      anios: 0,
      meses: 5,
      texto: "5 meses",
    });
  });

  it("usa el singular cuando corresponde", () => {
    expect(calcularEdad("2026-07-18", "2026-08-18").texto).toBe("1 mes");
    expect(calcularEdad("2025-08-18", "2026-08-18").texto).toBe("1 ano");
  });

  it("suma los meses solo mientras la edad es menor de dos anios", () => {
    expect(calcularEdad("2025-03-18", "2026-08-18").texto).toBe("1 ano 5 meses");
    expect(calcularEdad("2024-03-18", "2026-08-18").texto).toBe("2 anos");
  });

  it("devuelve null ante una fecha de nacimiento futura, que es un dato mal capturado", () => {
    expect(calcularEdad("2027-01-01", "2026-08-18")).toBeNull();
  });

  it("devuelve null si la fecha no sirve", () => {
    expect(calcularEdad(null, "2026-08-18")).toBeNull();
    expect(calcularEdad("1990-08-18", "no es una fecha")).toBeNull();
  });
});

describe("diasHastaVencimiento", () => {
  it("es negativo para un lote ya vencido, para poder ordenar por urgencia", () => {
    expect(diasHastaVencimiento("2026-08-10", "2026-08-18")).toBe(-8);
  });

  it("es cero el mismo dia del vencimiento", () => {
    expect(diasHastaVencimiento("2026-08-18", "2026-08-18")).toBe(0);
  });

  it("es positivo mientras falte tiempo, cruzando meses y anios", () => {
    expect(diasHastaVencimiento("2026-09-01", "2026-08-18")).toBe(14);
    expect(diasHastaVencimiento("2027-01-01", "2026-12-25")).toBe(7);
  });

  it("devuelve null si la fecha no sirve", () => {
    expect(diasHastaVencimiento(null, "2026-08-18")).toBeNull();
    expect(diasHastaVencimiento("2026-08-18", "")).toBeNull();
  });
});

describe("tablas de calendario", () => {
  it("MESES tiene los doce meses, indexados como getMonth()", () => {
    expect(MESES).toHaveLength(12);
    expect(MESES[0]).toBe("enero");
    expect(MESES[11]).toBe("diciembre");
  });

  it("DIAS_DE_LA_SEMANA empieza en domingo, como devuelve getDay()", () => {
    expect(DIAS_DE_LA_SEMANA).toHaveLength(7);
    expect(DIAS_DE_LA_SEMANA[0]).toBe("domingo");
    expect(DIAS_DE_LA_SEMANA[new Date(2026, 7, 18).getDay()]).toBe("martes");
  });
});
