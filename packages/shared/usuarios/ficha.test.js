import { describe, expect, it } from "vitest";

import { CAMPOS_FICHA_VOLUNTARIO } from "./columnas.js";
import {
  filasDeHistorial,
  PESTANIA_FICHA_VOLUNTARIO_POR_DEFECTO,
  PESTANIAS_FICHA_VOLUNTARIO,
  valoresDeFichaVoluntario,
} from "./ficha.js";

describe("PESTANIAS_FICHA_VOLUNTARIO", () => {
  it("declara Datos e Historial, y Datos es la pestaña por defecto", () => {
    expect(PESTANIAS_FICHA_VOLUNTARIO.map((p) => p.id)).toEqual(["datos", "historial"]);
    expect(PESTANIA_FICHA_VOLUNTARIO_POR_DEFECTO).toBe("datos");
  });
});

describe("valoresDeFichaVoluntario", () => {
  const PERFIL = {
    id: "u1",
    nombres: "Ana",
    apellidos: "Lopez",
    email: "ana@ecopac.org",
    telefono: "12345678",
    rol: "medico",
    activo: true,
    fechaIngreso: "2024-01-15",
    especialidades: ["Oftalmologia"],
  };

  it("agrega nombreCompleto a partir de nombres y apellidos", () => {
    const valores = valoresDeFichaVoluntario(PERFIL);
    expect(valores.nombreCompleto).toBe("Ana Lopez");
  });

  it("conserva el resto de campos del perfil intactos", () => {
    const valores = valoresDeFichaVoluntario(PERFIL);
    expect(valores.email).toBe("ana@ecopac.org");
    expect(valores.activo).toBe(true);
    expect(valores.especialidades).toEqual(["Oftalmologia"]);
  });

  it("cubre todos los ids que declara CAMPOS_FICHA_VOLUNTARIO (salvo estado, que lee activo)", () => {
    const valores = valoresDeFichaVoluntario(PERFIL);
    for (const campo of CAMPOS_FICHA_VOLUNTARIO) {
      const clave = campo.desde ?? campo.id;
      expect(valores).toHaveProperty(clave);
    }
  });

  it("un perfil null devuelve un objeto vacio, no revienta", () => {
    expect(valoresDeFichaVoluntario(null)).toEqual({});
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
