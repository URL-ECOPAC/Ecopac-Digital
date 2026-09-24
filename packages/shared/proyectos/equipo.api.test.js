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

const { asignarPersonalAProyecto, desasignarPersonalDeProyecto, listarEquipoDelProyecto } =
  await import("./equipo.api.js");

function doble(respuesta) {
  const llamadas = [];
  const resolver = () => Promise.resolve(respuesta);
  const registrar = (paso) => (valores) => {
    llamadas.push({ paso, valores });
    return cadena;
  };
  const cadena = {
    select: registrar("select"),
    insert: registrar("insert"),
    delete: registrar("delete"),
    eq: (columna, valor) => {
      llamadas.push({ paso: "eq", columna, valor });
      return cadena;
    },
    order: (columna, opciones) => {
      llamadas.push({ paso: "order", columna, opciones });
      return cadena;
    },
    single: resolver,
    then: (alCumplir, alFallar) => resolver().then(alCumplir, alFallar),
  };
  return {
    llamadas,
    cliente: {
      from(tabla) {
        llamadas.push({ paso: "from", tabla });
        return cadena;
      },
      rpc(funcion, argumentos) {
        llamadas.push({ paso: "rpc", funcion, argumentos });
        return resolver();
      },
    },
  };
}

const pasos = (llamadas, paso) => llamadas.filter((llamada) => llamada.paso === paso);

beforeEach(() => {
  dobles.cliente = null;
});

describe("listarEquipoDelProyecto", () => {
  it("lee por equipo_de_proyecto() y devuelve cada fila en camelCase con su nombre", async () => {
    const { cliente, llamadas } = doble({
      data: [
        {
          id: "a-1",
          proyecto_id: "p-1",
          perfil_id: "u-1",
          rol_en_proyecto: "Coordinacion",
          created_at: "2026-09-01T00:00:00Z",
          nombres: "Ana",
          apellidos: "Lopez",
        },
        { id: "a-2", proyecto_id: "p-1", perfil_id: "u-2", nombres: null, apellidos: null },
      ],
      error: null,
    });
    dobles.cliente = cliente;

    const { equipo, error } = await listarEquipoDelProyecto("p-1");

    expect(error).toBeNull();
    expect(pasos(llamadas, "rpc")[0]).toEqual({
      paso: "rpc",
      funcion: "equipo_de_proyecto",
      argumentos: { p_proyecto_id: "p-1" },
    });
    expect(equipo[0]).toEqual({
      id: "a-1",
      proyectoId: "p-1",
      perfilId: "u-1",
      rolEnProyecto: "Coordinacion",
      createdAt: "2026-09-01T00:00:00Z",
      nombre: "Ana Lopez",
    });
    expect(equipo[1].nombre).toBe("Nombre no disponible");
  });

  it("sin proyecto no sale a la red y devuelve una lista vacia", async () => {
    expect(await listarEquipoDelProyecto(undefined)).toEqual({ equipo: [], error: null });
  });
});

describe("asignarPersonalAProyecto", () => {
  it("un rol vacio o de espacios se guarda como NULL, no como texto vacio", async () => {
    const { cliente, llamadas } = doble({ data: { id: "a-1", perfil: null }, error: null });
    dobles.cliente = cliente;

    await asignarPersonalAProyecto("p-1", { perfilId: "u-1", rolEnProyecto: "   " });

    expect(pasos(llamadas, "insert")[0].valores).toEqual({
      proyecto_id: "p-1",
      perfil_id: "u-1",
      rol_en_proyecto: null,
    });
  });

  it("guarda el rol sin espacios sobrantes", async () => {
    const { cliente, llamadas } = doble({ data: { id: "a-1", perfil: null }, error: null });
    dobles.cliente = cliente;

    await asignarPersonalAProyecto("p-1", { perfilId: "u-1", rolEnProyecto: " Coordinacion " });

    expect(pasos(llamadas, "insert")[0].valores.rol_en_proyecto).toBe("Coordinacion");
  });

  it("devuelve el error normalizado cuando la base rechaza (por ejemplo, duplicado)", async () => {
    dobles.cliente = doble({
      data: null,
      error: { code: "23505", message: "duplicate key" },
    }).cliente;

    const { asignacion, error } = await asignarPersonalAProyecto("p-1", { perfilId: "u-1" });

    expect(asignacion).toBeNull();
    expect(error).not.toBeNull();
  });
});

describe("desasignarPersonalDeProyecto", () => {
  it("borra por proyecto y persona, y cuenta como desasignado si se borro una fila", async () => {
    const { cliente, llamadas } = doble({ data: [{ id: "a-1" }], error: null });
    dobles.cliente = cliente;

    const { desasignado, error } = await desasignarPersonalDeProyecto("p-1", "u-1");

    expect(error).toBeNull();
    expect(desasignado).toBe(true);
    expect(pasos(llamadas, "eq").map((l) => [l.columna, l.valor])).toEqual([
      ["proyecto_id", "p-1"],
      ["perfil_id", "u-1"],
    ]);
  });

  it("si RLS no deja borrar (cero filas) NO dice que se desasigno", async () => {
    dobles.cliente = doble({ data: [], error: null }).cliente;

    const { desasignado, error } = await desasignarPersonalDeProyecto("p-1", "u-1");

    expect(error).toBeNull();
    expect(desasignado).toBe(false);
  });
});
