import { describe, expect, it } from "vitest";

import {
  filasDeHistorial,
  PESTANIA_FICHA_VOLUNTARIO_POR_DEFECTO,
  PESTANIAS_FICHA_VOLUNTARIO,
} from "./ficha.js";

describe("PESTANIAS_FICHA_VOLUNTARIO", () => {
  it("declara Datos e Historial, y Datos es la pestaña por defecto", () => {
    expect(PESTANIAS_FICHA_VOLUNTARIO.map((p) => p.id)).toEqual(["datos", "historial"]);
    expect(PESTANIA_FICHA_VOLUNTARIO_POR_DEFECTO).toBe("datos");
  });
});

describe("filasDeHistorial", () => {
  it("arma id, nombre, fecha, estado, responsabilidad y pacientesAtendidos a partir de cada jornada", () => {
    const historial = [
      {
        id: "j1",
        nombre: "Jornada en Solola",
        fecha: "2026-06-15",
        estado: "finalizada",
        responsabilidad: "Consulta general",
        atencionesPersona: { consultas: 3, triajes: 0, pacientes: 3 },
      },
    ];

    const filas = filasDeHistorial(historial);

    expect(filas).toEqual([
      {
        id: "j1",
        nombre: "Jornada en Solola",
        fecha: "2026-06-15",
        estado: "finalizada",
        responsabilidad: "Consulta general",
        pacientesAtendidos: 3,
      },
    ]);
  });

  it("una responsabilidad nula se muestra como guion, no en blanco", () => {
    const historial = [
      {
        id: "j1",
        nombre: "Jornada en Solola",
        fecha: "2026-06-15",
        estado: "finalizada",
        responsabilidad: null,
        atencionesPersona: { consultas: 0, triajes: 0, pacientes: 0 },
      },
    ];

    const [fila] = filasDeHistorial(historial);

    expect(fila.responsabilidad).toBe("—");
  });

  it("una persona sin atenciones en esa jornada queda en 0, no en blanco ni en guion", () => {
    const historial = [
      {
        id: "j1",
        nombre: "Jornada en Solola",
        fecha: "2026-06-15",
        estado: "en curso",
        responsabilidad: "Logistica",
        atencionesPersona: { consultas: 0, triajes: 0, pacientes: 0 },
      },
    ];

    const [fila] = filasDeHistorial(historial);

    expect(fila.pacientesAtendidos).toBe(0);
  });

  it("un historial vacio devuelve un arreglo vacio", () => {
    expect(filasDeHistorial([])).toEqual([]);
    expect(filasDeHistorial()).toEqual([]);
  });
});
