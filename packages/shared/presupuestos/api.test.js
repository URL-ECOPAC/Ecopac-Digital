import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  asignarPresupuestoJornada,
  conProyectoId,
  obtenerPresupuestoJornada,
  obtenerPresupuestoProyecto,
  obtenerPresupuestoSistema,
  registrarGasto,
  editarGasto,
  listarGastos,
} from "./api.js";

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

function clienteInsert(respuesta) {
  const llamadas = [];
  const encadenable = {
    insert(valores) {
      llamadas.push({ paso: "insert", valores });
      return encadenable;
    },
    select(columnas) {
      llamadas.push({ paso: "select", columnas });
      return encadenable;
    },
    single: async () => (respuesta instanceof Error ? Promise.reject(respuesta) : respuesta),
  };

  return {
    llamadas,
    from(tabla) {
      llamadas.push({ paso: "from", tabla });
      return encadenable;
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
    maybeSingle: async () => (respuesta instanceof Error ? Promise.reject(respuesta) : respuesta),
  };

  return {
    llamadas,
    from(tabla) {
      llamadas.push({ paso: "from", tabla });
      return encadenable;
    },
  };
}

// Mock de la cadena select().eq()...order() que usa listarGastos(). Cada metodo se acumula en
// `llamadas` y devuelve el mismo objeto encadenable; `order()` es el ultimo paso y resuelve la
// promesa (mismo patron que usa supabase-js: la query es un thenable hasta que se le hace await).
function clienteSelectGastos(respuesta) {
  const llamadas = [];
  const encadenable = {
    select(columnas) {
      llamadas.push({ paso: "select", columnas });
      return encadenable;
    },
    eq(columna, valor) {
      llamadas.push({ paso: "eq", columna, valor });
      return encadenable;
    },
    gte(columna, valor) {
      llamadas.push({ paso: "gte", columna, valor });
      return encadenable;
    },
    lte(columna, valor) {
      llamadas.push({ paso: "lte", columna, valor });
      return encadenable;
    },
    order: async () => (respuesta instanceof Error ? Promise.reject(respuesta) : respuesta),
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

  // Issue #597. Antes estos montos se convertian en 0 con aNumero(), pasaban la guarda de
  // negativo y se escribian como el presupuesto de la jornada: quedaba en cero sin ninguna
  // senal de que el dato venia mal. El caso realista no es alguien escribiendo letras, es un
  // campo de formulario vacio o un valor que se perdio en el camino.
  it.each([
    ["una cadena que no es numero", "abc"],
    ["undefined", undefined],
    ["null", null],
    ["la cadena vacia", ""],
    ["una cadena de espacios", "   "],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
  ])("rechaza %s en vez de escribir cero", async (_descripcion, monto) => {
    const { jornada, error } = await asignarPresupuestoJornada("jornada-1", monto);

    expect(jornada).toBeNull();
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.CHECK);
  });

  it("acepta un monto que llega como cadena numerica, que es lo que manda un formulario", async () => {
    const cliente = clienteUpdate({
      data: { id: "jornada-1", presupuesto_asignado: "8000.00" },
      error: null,
    });
    dobles.cliente = cliente;

    const { error } = await asignarPresupuestoJornada("jornada-1", "8000");

    expect(error).toBeNull();
    expect(cliente.llamadas).toContainEqual({
      paso: "update",
      valores: { presupuesto_asignado: 8000 },
    });
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

describe("gestión de gastos (#298)", () => {
  it("registrarGasto inserta correctamente y devuelve la estructura esperada", async () => {
    const cliente = clienteInsert({ data: { id: "gasto-1" }, error: null });
    dobles.cliente = cliente;

    const respuesta = await registrarGasto(
      {
        concepto: "Gasolina",
        categoria: "Logistica",
        monto: "150",
        jornada_id: "jornada-123",
      },
      { usuarioId: "usuario-1" },
    );

    expect(respuesta).toEqual({ gasto: { id: "gasto-1" }, error: null });
    expect(cliente.llamadas).toContainEqual({ paso: "from", tabla: "gastos" });
  });

  // Bug encontrado al verificar la #300 contra datos reales: registrarGasto() nunca enviaba
  // registrado_por, columna NOT NULL sin DEFAULT (00025); el INSERT reventaba con 23502 para
  // cualquier rol. Esta prueba fija el contrato correcto para que no se repita.
  it("envia registrado_por con el usuarioId recibido: gastos.registrado_por es NOT NULL (00025)", async () => {
    const cliente = clienteInsert({ data: { id: "gasto-1" }, error: null });
    dobles.cliente = cliente;

    await registrarGasto(
      { concepto: "Gasolina", categoria: "Logistica", monto: "150", jornada_id: "jornada-123" },
      { usuarioId: "usuario-1" },
    );

    const insertado = cliente.llamadas.find((llamada) => llamada.paso === "insert");
    expect(insertado.valores.registrado_por).toBe("usuario-1");
  });

  it("editarGasto rechaza la edición si el id no se proporciona", async () => {
    const respuestaSinId = await editarGasto(null, { concepto: "Nuevo" });
    expect(respuestaSinId.gasto).toBeNull();
    expect(respuestaSinId.error).toBeNull();
  });

  it("listarGastos ejecuta la consulta sin lanzar excepciones no controladas", async () => {
    const respuesta = await listarGastos({ estado: "pendiente" });

    // Si la llamada llega al mock predeterminado, retorna la respuesta de error normalizada
    expect(respuesta).toHaveProperty("gastos");
    expect(respuesta).toHaveProperty("error");
  });

  it("listarGastos aplica los seis filtros que declara filtros.js", async () => {
    const cliente = clienteSelectGastos({ data: [], error: null });
    dobles.cliente = cliente;

    await listarGastos({
      estado: "pendiente",
      categoria: "Logistica",
      jornada_id: "jornada-1",
      proyecto_id: "proyecto-1",
      fecha_inicio: "2026-01-01",
      fecha_fin: "2026-01-31",
    });

    expect(cliente.llamadas).toContainEqual({ paso: "from", tabla: "gastos" });
    expect(cliente.llamadas).toContainEqual({ paso: "eq", columna: "estado", valor: "pendiente" });
    expect(cliente.llamadas).toContainEqual({
      paso: "eq",
      columna: "categoria",
      valor: "Logistica",
    });
    expect(cliente.llamadas).toContainEqual({
      paso: "eq",
      columna: "jornada_id",
      valor: "jornada-1",
    });
    expect(cliente.llamadas).toContainEqual({
      paso: "eq",
      columna: "jornadas.proyecto_id",
      valor: "proyecto-1",
    });
    expect(cliente.llamadas).toContainEqual({
      paso: "gte",
      columna: "fecha",
      valor: "2026-01-01",
    });
    expect(cliente.llamadas).toContainEqual({
      paso: "lte",
      columna: "fecha",
      valor: "2026-01-31",
    });
  });

  it("listarGastos devuelve cada fila con proyecto_id aplanado (issue #302)", async () => {
    dobles.cliente = clienteSelectGastos({
      data: [
        { id: "gasto-1", jornadas: { id: "jornada-1", nombre: "J1", proyecto_id: "proyecto-1" } },
      ],
      error: null,
    });

    const { gastos } = await listarGastos();

    expect(gastos[0].proyecto_id).toBe("proyecto-1");
  });
});

describe("conProyectoId", () => {
  it("aplana jornadas.proyecto_id a la fila del gasto", () => {
    const gastos = [{ id: "g1", jornadas: { proyecto_id: "p1" } }];

    expect(conProyectoId(gastos)).toEqual([{ id: "g1", jornadas: { proyecto_id: "p1" }, proyecto_id: "p1" }]);
  });

  it("un gasto sin jornada embebida (RLS o join fallido) entra con proyecto_id null", () => {
    expect(conProyectoId([{ id: "g1" }])).toEqual([{ id: "g1", proyecto_id: null }]);
  });

  it("sin gastos devuelve una lista vacia", () => {
    expect(conProyectoId([])).toEqual([]);
    expect(conProyectoId()).toEqual([]);
  });
});
