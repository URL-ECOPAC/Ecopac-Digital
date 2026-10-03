// Pruebas del catalogo de clinicas (issue #927, 00183). Datos inventados.

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

const { ROLES } = await import("../usuarios/roles.js");
const { validarClinica, MAXIMO_DE_SALAS } = await import("./clinicas.validaciones.js");
const { opcionesDeClinicas } = await import("./clinicas.campos.js");
const { puedeMantenerClinicas, puedeRetirarClinicas, puedeVerCatalogoDeClinicas } =
  await import("./clinicas.permisos.js");
const { filtrarClinicas, mensajeDeEliminacionDeClinica } = await import("./useCatalogoClinicas.js");
const { actualizarClinica, crearClinica, eliminarClinica, listarClinicas } =
  await import("./clinicas.api.js");

const CLINICAS = [
  { id: "c-1", nombre: "Clínica Norte", salasDisponibles: 3, esVigente: true },
  { id: "c-2", nombre: "Clínica Sur", salasDisponibles: 1, esVigente: true },
  { id: "c-3", nombre: "Puesto viejo", salasDisponibles: 2, esVigente: false },
];

/** Doble de supabase-js: cada tabla o rpc responde lo configurado; se anotan las llamadas. */
function crearCliente(respuestas = {}) {
  const llamadas = [];
  const cadena = (clave) => {
    const responder = () => Promise.resolve(respuestas[clave] ?? { data: [], error: null });
    const encadenable = {};
    for (const paso of ["select", "insert", "update", "eq", "order"]) {
      encadenable[paso] = (...argumentos) => {
        llamadas.push({ clave, paso, argumentos });
        return encadenable;
      };
    }
    encadenable.maybeSingle = responder;
    encadenable.then = (alCumplir, alFallar) => responder().then(alCumplir, alFallar);
    return encadenable;
  };
  return {
    llamadas,
    from: (tabla) => cadena(tabla),
    rpc: (nombre, argumentos) => {
      llamadas.push({ clave: nombre, paso: "rpc", argumentos: [argumentos] });
      return cadena(nombre);
    },
  };
}

beforeEach(() => {
  dobles.cliente = null;
});

describe("validarClinica", () => {
  it("al crear exige nombre y salas", () => {
    expect(validarClinica({})).toEqual({
      nombre: "El nombre de la clínica es requerido.",
      salasDisponibles: "Indica cuántas salas tiene la clínica.",
    });
  });

  it("las salas son un entero entre 1 y el tope", () => {
    expect(validarClinica({ nombre: "A", salasDisponibles: 0 }).salasDisponibles).toMatch(
      /al menos/,
    );
    expect(validarClinica({ nombre: "A", salasDisponibles: 1.5 }).salasDisponibles).toMatch(
      /cuántas/,
    );
    expect(
      validarClinica({ nombre: "A", salasDisponibles: MAXIMO_DE_SALAS + 1 }).salasDisponibles,
    ).toMatch(/No más de/);
    expect(validarClinica({ nombre: "A", salasDisponibles: "3" })).toEqual({});
  });

  it("el nombre tiene un largo maximo", () => {
    expect(validarClinica({ nombre: "x".repeat(101), salasDisponibles: 1 }).nombre).toMatch(/100/);
  });

  it("al editar valida solo lo que viene", () => {
    expect(validarClinica({ salasDisponibles: 2 }, { completo: false })).toEqual({});
    expect(validarClinica({ nombre: " " }, { completo: false })).toHaveProperty("nombre");
  });
});

describe("opcionesDeClinicas", () => {
  it("ofrece las vigentes con sus salas, y la retirada solo si ya estaba elegida", () => {
    expect(opcionesDeClinicas(CLINICAS)).toEqual([
      { value: "c-1", label: "Clínica Norte · 3 salas" },
      { value: "c-2", label: "Clínica Sur · 1 sala" },
    ]);
    expect(opcionesDeClinicas(CLINICAS, "c-3").at(-1)).toEqual({
      value: "c-3",
      label: "Puesto viejo (inactiva)",
    });
    expect(opcionesDeClinicas(null)).toEqual([]);
  });
});

describe("permisos de clinicas", () => {
  it("todos ven; mantiene quien gestiona jornadas; retira la administradora", () => {
    for (const rol of Object.values(ROLES)) expect(puedeVerCatalogoDeClinicas(rol)).toBe(true);
    expect(puedeMantenerClinicas(ROLES.ADMINISTRADOR)).toBe(true);
    expect(puedeMantenerClinicas(ROLES.MEDICO)).toBe(false);
    expect(puedeRetirarClinicas(ROLES.ADMINISTRADOR)).toBe(true);
    expect(puedeRetirarClinicas(ROLES.VOLUNTARIO)).toBe(false);
  });
});

describe("pantalla del catalogo", () => {
  it("busca sin distinguir acentos ni mayusculas", () => {
    expect(filtrarClinicas(CLINICAS, "clinica sur").map((clinica) => clinica.id)).toEqual(["c-2"]);
    expect(filtrarClinicas(CLINICAS, "")).toBe(CLINICAS);
  });

  it("dice que paso al eliminar", () => {
    expect(mensajeDeEliminacionDeClinica("eliminada")).toMatch(/eliminó/);
    expect(mensajeDeEliminacionDeClinica("retirada")).toMatch(/ya tiene citas/);
    expect(mensajeDeEliminacionDeClinica(null)).toBeNull();
  });
});

describe("clinicas en la base", () => {
  it("lista y normaliza las salas como numero", async () => {
    dobles.cliente = crearCliente({
      clinicas: { data: [{ id: "c-1", nombre: "Norte", salasDisponibles: "3" }], error: null },
    });
    const { clinicas, error } = await listarClinicas({ soloVigentes: true });
    expect(error).toBeNull();
    expect(clinicas).toEqual([
      { id: "c-1", nombre: "Norte", salasDisponibles: 3, esVigente: true },
    ]);
    expect(dobles.cliente.llamadas).toContainEqual({
      clave: "clinicas",
      paso: "eq",
      argumentos: ["es_vigente", true],
    });
  });

  it("un error al listar llega normalizado", async () => {
    dobles.cliente = crearCliente({ clinicas: { data: null, error: { code: "42501" } } });
    expect((await listarClinicas()).error.codigo).toBe("permiso_denegado");
  });

  it("crear valida antes y manda las columnas de la tabla", async () => {
    expect((await crearClinica({ nombre: "" })).errores).toHaveProperty("nombre");

    dobles.cliente = crearCliente({
      clinicas: { data: { id: "c-9", nombre: "Norte", salasDisponibles: 2 }, error: null },
    });
    const { clinica } = await crearClinica({ nombre: " Norte ", salasDisponibles: "2" });
    expect(clinica.id).toBe("c-9");
    expect(dobles.cliente.llamadas).toContainEqual({
      clave: "clinicas",
      paso: "insert",
      argumentos: [{ nombre: "Norte", salas_disponibles: 2 }],
    });
  });

  it("un nombre repetido vuelve como error del campo; sin fila, como permiso", async () => {
    dobles.cliente = crearCliente({ clinicas: { data: null, error: { code: "23505" } } });
    expect((await crearClinica({ nombre: "Norte", salasDisponibles: 1 })).errores.nombre).toMatch(
      /Ya existe/,
    );

    dobles.cliente = crearCliente({ clinicas: { data: null, error: null } });
    expect((await actualizarClinica("c-1", { esVigente: false })).error.codigo).toBe(
      "permiso_denegado",
    );
  });

  it("editar pide id, cambios validos y algo que cambiar", async () => {
    expect((await actualizarClinica(null, { nombre: "x" })).error).not.toBeNull();
    expect((await actualizarClinica("c-1", {})).error).not.toBeNull();
    expect((await actualizarClinica("c-1", { salasDisponibles: 0 })).errores).toHaveProperty(
      "salasDisponibles",
    );
  });

  it("eliminar devuelve lo que decidio la base", async () => {
    expect(await eliminarClinica(null)).toEqual({ resultado: null, error: null });

    dobles.cliente = crearCliente({ fn_eliminar_clinica: { data: "retirada", error: null } });
    expect(await eliminarClinica("c-1")).toEqual({ resultado: "retirada", error: null });

    dobles.cliente = crearCliente({
      fn_eliminar_clinica: { data: null, error: { code: "42501" } },
    });
    expect((await eliminarClinica("c-1")).error.codigo).toBe("permiso_denegado");
  });
});
