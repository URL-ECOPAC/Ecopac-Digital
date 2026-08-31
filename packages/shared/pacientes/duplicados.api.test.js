// Pruebas de listarPosiblesDuplicados()/fusionarPacientes() (issue #140).
//
// Mismo patron de doble que pacientes/api.test.js: un doble de obtenerSupabase() que registra
// cada paso de la cadena y resuelve con la respuesta que la prueba le entregue. Ninguna prueba
// llega a Supabase real.

import { beforeEach, describe, expect, it, vi } from "vitest";

const { dobles } = vi.hoisted(() => ({ dobles: { cliente: null } }));

vi.mock("../api/cliente.js", () => ({
  obtenerSupabase: () => {
    if (dobles.cliente === null) {
      throw new Error("Ninguna prueba debia llegar hasta el cliente de Supabase.");
    }
    return dobles.cliente;
  },
}));

const { listarPosiblesDuplicados, fusionarPacientes } = await import("./duplicados.api.js");

/** Doble minimo: solo necesita soportar .rpc(nombre, argumentos) con .single() opcional. */
function crearCliente(respuesta) {
  const llamadas = [];
  const resolver = async () => (respuesta instanceof Error ? Promise.reject(respuesta) : respuesta);

  return {
    llamadas,
    rpc(nombre, argumentos) {
      llamadas.push({ paso: "rpc", nombre, argumentos });
      const encadenable = {
        single: resolver,
        then(resolve, reject) {
          return resolver().then(resolve, reject);
        },
      };
      return encadenable;
    },
  };
}

beforeEach(() => {
  dobles.cliente = null;
});

describe("listarPosiblesDuplicados", () => {
  it("deniega a un rol que no puede ver pacientes, sin llegar a Supabase", async () => {
    const { duplicados, error } = await listarPosiblesDuplicados({ rolUsuario: "junta directiva" });

    expect(duplicados).toEqual([]);
    expect(error.mensaje).toContain("permisos de lectura");
  });

  it("llama fn_detectar_pacientes_duplicados sin argumentos", async () => {
    const cliente = crearCliente({ data: [], error: null });
    dobles.cliente = cliente;

    await listarPosiblesDuplicados({ rolUsuario: "administrador" });

    expect(cliente.llamadas[0]).toEqual({
      paso: "rpc",
      nombre: "fn_detectar_pacientes_duplicados",
      argumentos: undefined,
    });
  });

  it("aplana cada fila a camelCase", async () => {
    dobles.cliente = crearCliente({
      data: [
        {
          paciente_a_id: "pac-1",
          nombres_a: "Maria",
          apellidos_a: "Perez",
          numero_ficha_a: "F-001",
          paciente_b_id: "pac-2",
          nombres_b: "Maria",
          apellidos_b: "Peres",
          numero_ficha_b: "F-002",
          fecha_nacimiento: "1990-05-10",
          similitud: 0.8,
        },
      ],
      error: null,
    });

    const { duplicados, error } = await listarPosiblesDuplicados({ rolUsuario: "medico" });

    expect(error).toBeNull();
    expect(duplicados).toEqual([
      {
        pacienteAId: "pac-1",
        nombresA: "Maria",
        apellidosA: "Perez",
        numeroFichaA: "F-001",
        pacienteBId: "pac-2",
        nombresB: "Maria",
        apellidosB: "Peres",
        numeroFichaB: "F-002",
        fechaNacimiento: "1990-05-10",
        similitud: 0.8,
      },
    ]);
  });

  it("sin resultados devuelve una lista vacia sin reventar", async () => {
    dobles.cliente = crearCliente({ data: [], error: null });

    const { duplicados, error } = await listarPosiblesDuplicados({
      rolUsuario: "voluntario general",
    });

    expect(error).toBeNull();
    expect(duplicados).toEqual([]);
  });

  it("un rechazo de RLS se normaliza", async () => {
    dobles.cliente = crearCliente({ data: null, error: { code: "42501", message: "denegado" } });

    const { duplicados, error } = await listarPosiblesDuplicados({ rolUsuario: "administrador" });

    expect(duplicados).toEqual([]);
    expect(error).not.toBeNull();
  });
});

describe("fusionarPacientes", () => {
  it("deniega a quien no es administrador, sin llegar a Supabase", async () => {
    const { fusion, error } = await fusionarPacientes("pac-1", "pac-2", { rolUsuario: "medico" });

    expect(fusion).toBeNull();
    expect(error.mensaje).toContain("administradora");
  });

  it("rechaza fusionar un paciente consigo mismo, sin llegar a Supabase", async () => {
    const { fusion, error } = await fusionarPacientes("pac-1", "pac-1", {
      rolUsuario: "administrador",
    });

    expect(fusion).toBeNull();
    expect(error.mensaje).toContain("dos pacientes distintos");
  });

  it("rechaza ids vacios, sin llegar a Supabase", async () => {
    const { fusion, error } = await fusionarPacientes(null, "pac-2", {
      rolUsuario: "administrador",
    });

    expect(fusion).toBeNull();
    expect(error).not.toBeNull();
  });

  it("llama fn_fusionar_pacientes con los argumentos correctos", async () => {
    const cliente = crearCliente({
      data: {
        id: "fus-1",
        paciente_absorbido_id: "pac-2",
        paciente_sobreviviente_id: "pac-1",
        realizada_por: "user-1",
        realizada_en: "2026-08-30T10:00:00Z",
      },
      error: null,
    });
    dobles.cliente = cliente;

    const { fusion, error } = await fusionarPacientes("pac-1", "pac-2", {
      rolUsuario: "administrador",
    });

    expect(error).toBeNull();
    expect(cliente.llamadas[0]).toEqual({
      paso: "rpc",
      nombre: "fn_fusionar_pacientes",
      argumentos: { p_sobreviviente_id: "pac-1", p_absorbido_id: "pac-2" },
    });
    expect(fusion).toEqual({
      id: "fus-1",
      pacienteAbsorbidoId: "pac-2",
      pacienteSobrevivienteId: "pac-1",
      realizadaPor: "user-1",
      realizadaEn: "2026-08-30T10:00:00Z",
    });
  });

  it("un rechazo del servidor (rol, paciente ya fusionado) se normaliza", async () => {
    dobles.cliente = crearCliente({
      data: null,
      error: {
        code: "P0001",
        message: "El expediente que se quiere absorber ya esta dado de baja o ya fue fusionado.",
      },
    });

    const { fusion, error } = await fusionarPacientes("pac-1", "pac-2", {
      rolUsuario: "administrador",
    });

    expect(fusion).toBeNull();
    expect(error).not.toBeNull();
  });

  it("un fallo de red se normaliza", async () => {
    dobles.cliente = crearCliente(new Error("Failed to fetch"));

    const { fusion, error } = await fusionarPacientes("pac-1", "pac-2", {
      rolUsuario: "administrador",
    });

    expect(fusion).toBeNull();
    expect(error).not.toBeNull();
  });
});
