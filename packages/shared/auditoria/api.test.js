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

const { diaSiguiente, listarEventosAuditoria, listarPerfilesParaFiltro } = await import("./api.js");

function doble(respuesta) {
  const llamadas = [];

  function resolver() {
    return respuesta instanceof Error ? Promise.reject(respuesta) : Promise.resolve(respuesta);
  }

  const cadena = {
    select(columnas, opciones) {
      llamadas.push({ paso: "select", columnas, opciones });
      return cadena;
    },
    order(columna, opciones) {
      llamadas.push({ paso: "order", columna, opciones });
      return cadena;
    },
    eq(columna, valor) {
      llamadas.push({ paso: "eq", columna, valor });
      return cadena;
    },
    gte(columna, valor) {
      llamadas.push({ paso: "gte", columna, valor });
      return cadena;
    },
    lt(columna, valor) {
      llamadas.push({ paso: "lt", columna, valor });
      return cadena;
    },
    range(desde, hasta) {
      llamadas.push({ paso: "range", desde, hasta });
      return cadena;
    },
    then(alCumplir, alFallar) {
      return resolver().then(alCumplir, alFallar);
    },
  };

  return {
    llamadas,
    cliente: {
      from(tabla) {
        llamadas.push({ paso: "from", tabla });
        return cadena;
      },
    },
  };
}

function pasos(llamadas, paso) {
  return llamadas.filter((llamada) => llamada.paso === paso);
}

beforeEach(() => {
  dobles.cliente = null;
});

describe("diaSiguiente", () => {
  it("suma un dia sin corrimiento de zona horaria", () => {
    expect(diaSiguiente("2026-09-19")).toBe("2026-09-20");
  });

  it("cruza de mes y de anio correctamente", () => {
    expect(diaSiguiente("2026-12-31")).toBe("2027-01-01");
  });

  it("devuelve null si la fecha no es valida", () => {
    expect(diaSiguiente(null)).toBeNull();
    expect(diaSiguiente(undefined)).toBeNull();
  });
});

describe("listarEventosAuditoria", () => {
  it("consulta eventos_auditoria ordenado por fecha descendente", async () => {
    const { cliente, llamadas } = doble({ data: [{ id: 1 }], error: null, count: 1 });
    dobles.cliente = cliente;

    const { eventos, total, error } = await listarEventosAuditoria();

    expect(error).toBeNull();
    expect(eventos).toHaveLength(1);
    expect(total).toBe(1);
    expect(pasos(llamadas, "from")[0].tabla).toBe("eventos_auditoria");
    expect(pasos(llamadas, "order")[0]).toEqual({
      paso: "order",
      columna: "realizado_en",
      opciones: { ascending: false },
    });
  });

  it("sin filtros no restringe nada", async () => {
    const { cliente, llamadas } = doble({ data: [], error: null });
    dobles.cliente = cliente;

    await listarEventosAuditoria();

    expect(pasos(llamadas, "eq")).toHaveLength(0);
    expect(pasos(llamadas, "gte")).toHaveLength(0);
    expect(pasos(llamadas, "lt")).toHaveLength(0);
  });

  it("filtra por usuario y por tabla afectada", async () => {
    const { cliente, llamadas } = doble({ data: [], error: null });
    dobles.cliente = cliente;

    await listarEventosAuditoria({ usuarioId: "u1", tablaAfectada: "pacientes" });

    expect(pasos(llamadas, "eq")).toEqual([
      { paso: "eq", columna: "realizado_por", valor: "u1" },
      { paso: "eq", columna: "tabla_afectada", valor: "pacientes" },
    ]);
  });

  it("el filtro 'hasta' es un limite superior exclusivo del dia siguiente", async () => {
    const { cliente, llamadas } = doble({ data: [], error: null });
    dobles.cliente = cliente;

    await listarEventosAuditoria({ desde: "2026-09-01", hasta: "2026-09-19" });

    expect(pasos(llamadas, "gte")[0]).toEqual({
      paso: "gte",
      columna: "realizado_en",
      valor: "2026-09-01",
    });
    expect(pasos(llamadas, "lt")[0]).toEqual({
      paso: "lt",
      columna: "realizado_en",
      valor: "2026-09-20",
    });
  });

  it("pagina con .range() y pide count solo cuando hay limite", async () => {
    const { cliente, llamadas } = doble({ data: [], error: null, count: 0 });
    dobles.cliente = cliente;

    await listarEventosAuditoria({ limite: 20, pagina: 2 });

    expect(pasos(llamadas, "range")[0]).toEqual({ paso: "range", desde: 20, hasta: 39 });
    expect(pasos(llamadas, "select")[0].opciones).toEqual({ count: "exact" });
  });

  it("sin limite no pagina ni pide count", async () => {
    const { cliente, llamadas } = doble({ data: [{ id: 1 }, { id: 2 }], error: null });
    dobles.cliente = cliente;

    const { total } = await listarEventosAuditoria();

    expect(pasos(llamadas, "range")).toHaveLength(0);
    expect(pasos(llamadas, "select")[0].opciones).toBeUndefined();
    expect(total).toBe(2);
  });

  it("propaga el error normalizado sin reventar", async () => {
    const { cliente } = doble({ data: null, error: { code: "42501", message: "denegado" } });
    dobles.cliente = cliente;

    const { eventos, total, error } = await listarEventosAuditoria();

    expect(eventos).toEqual([]);
    expect(total).toBe(0);
    expect(error).not.toBeNull();
  });
});

describe("listarPerfilesParaFiltro", () => {
  it("mapea los perfiles a { value, label }", async () => {
    const { cliente } = doble({
      data: [
        { id: "p1", nombres: "Ana", apellidos: "Lopez", especialidades: [] },
        { id: "p2", nombres: "Beto", apellidos: "Ruiz", especialidades: [] },
      ],
      error: null,
    });
    dobles.cliente = cliente;

    const { opciones, error } = await listarPerfilesParaFiltro();

    expect(error).toBeNull();
    expect(opciones).toEqual([
      { value: "p1", label: "Ana Lopez" },
      { value: "p2", label: "Beto Ruiz" },
    ]);
  });

  it("incluye perfiles inactivos, a diferencia del catalogo de responsables de proyectos", async () => {
    const { cliente, llamadas } = doble({
      data: [{ id: "p1", nombres: "Ana", apellidos: "Lopez", activo: false, especialidades: [] }],
      error: null,
    });
    dobles.cliente = cliente;

    const { opciones } = await listarPerfilesParaFiltro();

    expect(opciones).toHaveLength(1);
    expect(pasos(llamadas, "eq").some((llamada) => llamada.columna === "activo")).toBe(false);
  });
});
