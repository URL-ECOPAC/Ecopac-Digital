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

const { CODIGOS_DE_ERROR_DE_SUPABASE } = await import("../api/errores-de-supabase.js");
const {
  asignarPresupuestoJornada,
  obtenerPresupuestoJornada,
  obtenerPresupuestoProyecto,
  obtenerPresupuestoSistema,
} = await import("./api.js");

function clienteRpc(respuesta) {
  const llamadas = [];
  return {
    llamadas,
    rpc(nombre, argumentos) {
      llamadas.push({ nombre, argumentos });
      return {
        maybeSingle: async () =>
          respuesta instanceof Error ? Promise.reject(respuesta) : respuesta,
      };
    },
  };
}

function clienteUpdate(respuesta) {
  const llamadas = [];
  const encadenable = {
    update(valores) {
      llamadas.push({ paso: "update", valores });
      return encadenable;
    },
    eq(columna, valor) {
      llamadas.push({ paso: "eq", columna, valor });
      return encadenable;
    },
    select(columnas) {
      llamadas.push({ paso: "select", columnas });
      return encadenable;
    },
    maybeSingle: async () =>
      respuesta instanceof Error ? Promise.reject(respuesta) : respuesta,
  };

  return {
    llamadas,
    from(tabla) {
      llamadas.push({ paso: "from", tabla });
      return encadenable;
    },
  };
}

beforeEach(() => {
  dobles.cliente = null;
});

describe("obtenerPresupuestoJornada", () => {
  it("convierte a numero los valores que PostgREST devuelve como texto", async () => {
    dobles.cliente = clienteRpc({
      data: { asignado: "5000.00", gastado: "1250.50", disponible: "3749.50", pendiente: "300.00" },
      error: null,
    });

    const { presupuesto, error } = await obtenerPresupuestoJornada("jornada-1");

    expect(error).toBeNull();
    expect(presupuesto).toEqual({
      asignado: 5000,
      gastado: 1250.5,
      disponible: 3749.5,
      pendiente: 300,
    });
  });

  it("llama a la funcion de la base con el nombre y el argumento esperados", async () => {
    const cliente = clienteRpc({ data: null, error: null });
    dobles.cliente = cliente;

    await obtenerPresupuestoJornada("jornada-1");

    expect(cliente.llamadas).toEqual([
      { nombre: "presupuesto_de_jornada", argumentos: { p_jornada_id: "jornada-1" } },
    ]);
  });

  it("devuelve null cuando la jornada no existe o RLS no la deja ver", async () => {
    dobles.cliente = clienteRpc({ data: null, error: null });

    const { presupuesto, error } = await obtenerPresupuestoJornada("jornada-inexistente");

    expect(presupuesto).toBeNull();
    expect(error).toBeNull();
  });

  it("no toca el cliente de Supabase si no hay identificador", async () => {
    const { presupuesto, error } = await obtenerPresupuestoJornada(undefined);

    expect(presupuesto).toBeNull();
    expect(error).toBeNull();
  });

  it("normaliza el error del servidor en lugar de reenviarlo", async () => {
    dobles.cliente = clienteRpc({ data: null, error: { code: "42501" } });

    const { presupuesto, error } = await obtenerPresupuestoJornada("jornada-1");

    expect(presupuesto).toBeNull();
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.PERMISO_DENEGADO);
    expect(error.mensaje).toContain("permiso");
  });

  it("clasifica como fallo de red la excepcion del fetch", async () => {
    dobles.cliente = clienteRpc(new Error("Network request failed"));

    const { error } = await obtenerPresupuestoJornada("jornada-1");

    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.FALLO_DE_RED);
    expect(error.esReintentable).toBe(true);
  });
});

describe("obtenerPresupuestoProyecto", () => {
  it("devuelve ceros cuando el proyecto no tiene jornadas", async () => {
    dobles.cliente = clienteRpc({ data: null, error: null });

    const { presupuesto, error } = await obtenerPresupuestoProyecto("proyecto-1");

    expect(error).toBeNull();
    expect(presupuesto).toEqual({ asignado: 0, gastado: 0, disponible: 0, pendiente: 0 });
  });

  it("suma lo que devuelve la base sin recalcular en el cliente", async () => {
    dobles.cliente = clienteRpc({
      data: { asignado: "12000", gastado: "4500", disponible: "7500", pendiente: "0" },
      error: null,
    });

    const { presupuesto } = await obtenerPresupuestoProyecto("proyecto-1");

    expect(presupuesto.disponible).toBe(7500);
  });
});

describe("obtenerPresupuestoSistema", () => {
  it("no recibe argumentos y devuelve ceros con la base vacia", async () => {
    const cliente = clienteRpc({ data: null, error: null });
    dobles.cliente = cliente;

    const { presupuesto } = await obtenerPresupuestoSistema();

    expect(cliente.llamadas).toEqual([{ nombre: "presupuesto_del_sistema", argumentos: {} }]);
    expect(presupuesto).toEqual({ asignado: 0, gastado: 0, disponible: 0, pendiente: 0 });
  });
});

describe("asignarPresupuestoJornada", () => {
  it("actualiza la columna de la jornada indicada", async () => {
    const cliente = clienteUpdate({
      data: { id: "jornada-1", presupuesto_asignado: "8000.00" },
      error: null,
    });
    dobles.cliente = cliente;

    const { jornada, error } = await asignarPresupuestoJornada("jornada-1", 8000);

    expect(error).toBeNull();
    expect(jornada).toEqual({ id: "jornada-1", presupuesto_asignado: "8000.00" });
    expect(cliente.llamadas).toContainEqual({ paso: "from", tabla: "jornadas" });
    expect(cliente.llamadas).toContainEqual({
      paso: "update",
      valores: { presupuesto_asignado: 8000 },
    });
    expect(cliente.llamadas).toContainEqual({ paso: "eq", columna: "id", valor: "jornada-1" });
  });

  it("rechaza un monto negativo sin llegar al servidor", async () => {
    const { jornada, error } = await asignarPresupuestoJornada("jornada-1", -1);

    expect(jornada).toBeNull();
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.CHECK);
  });

  it("acepta cero, que es el valor por defecto de la columna", async () => {
    const cliente = clienteUpdate({
      data: { id: "jornada-1", presupuesto_asignado: "0.00" },
      error: null,
    });
    dobles.cliente = cliente;

    const { error } = await asignarPresupuestoJornada("jornada-1", 0);

    expect(error).toBeNull();
    expect(cliente.llamadas).toContainEqual({
      paso: "update",
      valores: { presupuesto_asignado: 0 },
    });
  });

  it("devuelve null cuando RLS impide la actualizacion sin reportar error", async () => {
    dobles.cliente = clienteUpdate({ data: null, error: null });

    const { jornada, error } = await asignarPresupuestoJornada("jornada-ajena", 100);

    expect(jornada).toBeNull();
    expect(error).toBeNull();
  });
});
