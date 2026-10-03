// Pruebas de las areas dentro del paciente (issue #927, 00182): registro, edicion, filtros y
// busqueda. Datos inventados.

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

const { actualizarPaciente, buscarPacientes, registrarPaciente } = await import("./api.js");
const { aFiltrosDeBusqueda, hayFiltrosDePacientes } = await import("./usePacientesListado.js");
const { hayCambiosPendientes, valoresDesdePaciente } = await import("./useEdicionPaciente.js");
const { FILTROS_PACIENTE_VACIOS } = await import("./filtros.js");

/**
 * Doble de supabase-js. `rpc` y cada tabla responden con lo que diga `respuestas`; la cadena es
 * "thenable", asi que cualquier paso final resuelve igual. Se anotan todas las llamadas.
 */
function crearCliente(respuestas = {}) {
  const llamadas = [];
  const responder = (clave) => Promise.resolve(respuestas[clave] ?? { data: [], error: null });

  function cadena(clave) {
    const encadenable = {};
    for (const paso of [
      "select",
      "insert",
      "update",
      "delete",
      "eq",
      "in",
      "or",
      "ilike",
      "limit",
      "order",
      "abortSignal",
    ]) {
      encadenable[paso] = (...argumentos) => {
        llamadas.push({ clave, paso, argumentos });
        return encadenable;
      };
    }
    encadenable.single = () => responder(clave);
    encadenable.maybeSingle = () => responder(clave);
    encadenable.then = (alCumplir, alFallar) => responder(clave).then(alCumplir, alFallar);
    return encadenable;
  }

  return {
    llamadas,
    from: (tabla) => cadena(tabla),
    rpc: (nombre, argumentos) => {
      llamadas.push({ clave: nombre, paso: "rpc", argumentos: [argumentos] });
      return cadena(nombre);
    },
  };
}

const DATOS_VALIDOS = {
  nombres: "Ana",
  apellidos: "Prueba",
  fechaNacimiento: "1990-05-10",
  sexo: "Femenino",
  comunidad: "",
  telefonoContacto: "",
  idioma: "espanol",
};

beforeEach(() => {
  dobles.cliente = null;
});

describe("registrar con areas", () => {
  it("las areas viajan sin repetidos en la misma llamada", async () => {
    dobles.cliente = crearCliente({
      fn_registrar_paciente: { data: { id: "p-1", numero_ficha: "000001" }, error: null },
    });

    await registrarPaciente({ ...DATOS_VALIDOS, areas: ["a-1", "a-2", "a-1"] });

    const llamada = dobles.cliente.llamadas.find((uno) => uno.paso === "rpc");
    expect(llamada.argumentos[0].p_area_ids).toEqual(["a-1", "a-2"]);
  });

  it("sin areas viaja null", async () => {
    dobles.cliente = crearCliente({
      fn_registrar_paciente: { data: { id: "p-1", numero_ficha: "000001" }, error: null },
    });

    await registrarPaciente({ ...DATOS_VALIDOS, areas: [] });

    const llamada = dobles.cliente.llamadas.find((uno) => uno.paso === "rpc");
    expect(llamada.argumentos[0].p_area_ids).toBeNull();
  });
});

describe("editar las areas", () => {
  it("cambiar solo las areas no actualiza la fila del paciente", async () => {
    dobles.cliente = crearCliente({ paciente_area: { data: [{ areaId: "a-1" }], error: null } });

    const { error } = await actualizarPaciente("p-1", { areas: ["a-1", "a-2"] });

    expect(error).toBeNull();
    expect(dobles.cliente.llamadas.some((uno) => uno.clave === "pacientes")).toBe(false);
    expect(dobles.cliente.llamadas).toContainEqual({
      clave: "paciente_area",
      paso: "insert",
      argumentos: [[{ paciente_id: "p-1", area_id: "a-2" }]],
    });
  });

  it("si las areas fallan, el error llega a la pantalla", async () => {
    dobles.cliente = crearCliente({
      pacientes: { data: { id: "p-1" }, error: null },
      paciente_area: { data: null, error: { code: "42501" } },
    });

    const { paciente, error } = await actualizarPaciente("p-1", { nombres: "Ana", areas: [] });

    expect(paciente).toEqual({ id: "p-1" });
    expect(error.codigo).toBe("permiso_denegado");
  });

  it("los valores iniciales traen los ids de las areas y comparan sin importar el orden", () => {
    const iniciales = valoresDesdePaciente({
      id: "p-1",
      areas: [
        { id: "a-1", nombre: "Odontologia" },
        { id: "a-2", nombre: "Psicologia" },
      ],
    });
    expect(iniciales.areas).toEqual(["a-1", "a-2"]);
    expect(hayCambiosPendientes({ ...iniciales, areas: ["a-2", "a-1"] }, iniciales)).toBe(false);
    expect(hayCambiosPendientes({ ...iniciales, areas: ["a-1"] }, iniciales)).toBe(true);
    expect(valoresDesdePaciente(null).areas).toEqual([]);
  });
});

describe("filtrar por area", () => {
  it("el filtro de pantalla viaja como areaId y cuenta como filtro", () => {
    expect(aFiltrosDeBusqueda({ areas: "a-1" }).areaId).toBe("a-1");
    expect(aFiltrosDeBusqueda({}).areaId).toBeUndefined();
    expect(hayFiltrosDePacientes({ ...FILTROS_PACIENTE_VACIOS, areas: "a-1" })).toBe(true);
  });

  it("por nombre, el area llega a fn_buscar_pacientes", async () => {
    dobles.cliente = crearCliente({ fn_buscar_pacientes: { data: [], error: null } });

    await buscarPacientes({ areaId: "a-1" });

    const llamada = dobles.cliente.llamadas.find((uno) => uno.paso === "rpc");
    expect(llamada.argumentos[0].p_area_id).toBe("a-1");
  });

  it("por ficha o DPI, el area se aplica sobre las filas que vuelven", async () => {
    const paciente = (id, areas) => ({
      id,
      nombres: "Ana",
      apellidos: id,
      fechaNacimiento: "1990-01-01",
      condicionesCronicas: [],
      areasDelPaciente: areas.map((areaId) => ({ areaId })),
    });
    dobles.cliente = crearCliente({
      expedientes: {
        data: [
          { numeroFicha: "001234", paciente: paciente("con-area", ["a-1"]) },
          { numeroFicha: "001235", paciente: paciente("sin-area", []) },
        ],
        error: null,
      },
      pacientes: { data: [], error: null },
    });

    const { pacientes } = await buscarPacientes({ termino: "00123", areaId: "a-1" });

    expect(pacientes.map((uno) => uno.id)).toEqual(["con-area"]);
    expect(pacientes[0]).not.toHaveProperty("areasDelPaciente");
  });
});
