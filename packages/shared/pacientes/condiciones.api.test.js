// Pruebas de las consultas de Supabase de las condiciones cronicas (issue #122).
//
// Mismo patron de mock que triaje.api.test.js: un doble de obtenerSupabase() que registra cada
// paso de la cadena y resuelve con la respuesta que la prueba le entregue. No hay Supabase real
// ni red.
//
// Lo que estas pruebas NO cubren, porque no se puede desde aqui, y donde si se comprueba:
//   - que el duplicado lo rechace la base: UNIQUE (paciente_id, condicion_id) de la 00010.
//   - que un voluntario no vea ninguna fila: politicas RLS, verificadas en
//     supabase/tests/database/politicas_rls_catalogos_y_seguimiento.sql.
//   - que el borrado quede auditado: supabase/tests/database/auditoria_padecimientos_cronicos.sql.
// Aqui se comprueba lo que si es responsabilidad de este archivo: que la consulta salga bien
// formada y que la respuesta del servidor se traduzca a algo que la pantalla pueda usar.
//
// Ningun dato real: identificadores y notas son inventados.

import { describe, expect, it, vi } from "vitest";

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
  actualizarCondicion,
  asociarCondicion,
  desasociarCondicion,
  obtenerCatalogoDeCondiciones,
  obtenerCondicionesDelPaciente,
  obtenerPacientesConCondicion,
  quitarCondicion,
} = await import("./condiciones.api.js");

const PACIENTE = "20000000-0000-0000-0000-000000122001";
const CONDICION = "71000000-0000-0000-0000-000000122001";
const PADECIMIENTO = "72000000-0000-0000-0000-000000122001";
const COMUNIDAD = "10000000-0000-0000-0000-000000122001";

/** Doble minimo de un query builder de supabase-js. */
function crearCliente(respuesta = { data: [], error: null }) {
  const llamadas = [];
  const resolver = async () => (respuesta instanceof Error ? Promise.reject(respuesta) : respuesta);

  const encadenable = {
    insert(valores) {
      llamadas.push({ paso: "insert", valores });
      return encadenable;
    },
    update(valores) {
      llamadas.push({ paso: "update", valores });
      return encadenable;
    },
    delete() {
      llamadas.push({ paso: "delete" });
      return encadenable;
    },
    select(columnas) {
      llamadas.push({ paso: "select", columnas });
      return encadenable;
    },
    eq(columna, valor) {
      llamadas.push({ paso: "eq", columna, valor });
      return encadenable;
    },
    neq(columna, valor) {
      llamadas.push({ paso: "neq", columna, valor });
      return encadenable;
    },
    is(columna, valor) {
      llamadas.push({ paso: "is", columna, valor });
      return encadenable;
    },
    order(columna, opciones) {
      llamadas.push({ paso: "order", columna, opciones });
      return encadenable;
    },
    maybeSingle: resolver,
    single: resolver,
    then(resolve, reject) {
      return resolver().then(resolve, reject);
    },
  };

  const cliente = {
    llamadas,
    from(tabla) {
      llamadas.push({ paso: "from", tabla });
      return encadenable;
    },
  };

  dobles.cliente = cliente;
  return cliente;
}

/** Los pasos de un tipo, en orden. */
function pasos(cliente, tipo) {
  return cliente.llamadas.filter((llamada) => llamada.paso === tipo);
}

describe("obtenerCatalogoDeCondiciones", () => {
  it("lee el catalogo ordenado por nombre", async () => {
    const cliente = crearCliente({
      data: [{ id: CONDICION, nombre: "Diabetes" }],
      error: null,
    });

    const { condiciones, error } = await obtenerCatalogoDeCondiciones();

    expect(error).toBeNull();
    expect(condiciones).toHaveLength(1);
    expect(pasos(cliente, "from")[0].tabla).toBe("condiciones_cronicas");
    expect(pasos(cliente, "order")[0]).toMatchObject({
      columna: "nombre",
      opciones: { ascending: true },
    });
  });

  it("devuelve una lista vacia y el error normalizado si la consulta falla", async () => {
    crearCliente({ data: null, error: { code: "42501", message: "denegado" } });

    const { condiciones, error } = await obtenerCatalogoDeCondiciones();

    expect(condiciones).toEqual([]);
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.PERMISO_DENEGADO);
  });
});

describe("obtenerCondicionesDelPaciente", () => {
  it("filtra por paciente y no pide el servidor cuando falta el id", async () => {
    dobles.cliente = null;

    const { condiciones, error } = await obtenerCondicionesDelPaciente(undefined);

    expect(condiciones).toEqual([]);
    expect(error).toBeNull();
  });

  it("consulta padecimientos_cronicos del paciente", async () => {
    const cliente = crearCliente({ data: [{ id: PADECIMIENTO }], error: null });

    await obtenerCondicionesDelPaciente(PACIENTE);

    expect(pasos(cliente, "from")[0].tabla).toBe("padecimientos_cronicos");
    expect(pasos(cliente, "eq")[0]).toMatchObject({ columna: "paciente_id", valor: PACIENTE });
    // Sin soloVigentes no se descarta ningun estado: la ficha muestra el historial completo.
    expect(pasos(cliente, "neq")).toHaveLength(0);
  });

  it("descarta las resueltas cuando se piden solo las vigentes", async () => {
    const cliente = crearCliente({ data: [], error: null });

    await obtenerCondicionesDelPaciente(PACIENTE, { soloVigentes: true });

    expect(pasos(cliente, "neq")[0]).toMatchObject({ columna: "estado", valor: "resuelta" });
  });
});

describe("asociarCondicion", () => {
  it("exige el paciente antes de tocar la red", async () => {
    dobles.cliente = null;

    const { condicion, error } = await asociarCondicion({ condicion: CONDICION });

    expect(condicion).toBeNull();
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO);
  });

  it("devuelve los errores de validacion sin llamar al servidor", async () => {
    dobles.cliente = null;

    const { errores, error } = await asociarCondicion({ pacienteId: PACIENTE });

    expect(error).toBeNull();
    expect(errores.condicion).toBeDefined();
    expect(errores.fechaDiagnostico).toBeDefined();
  });

  it("inserta el padecimiento con las columnas de la tabla", async () => {
    const cliente = crearCliente({ data: { id: PADECIMIENTO }, error: null });

    const { condicion, error } = await asociarCondicion({
      pacienteId: PACIENTE,
      condicion: CONDICION,
      fechaDiagnostico: "2026-01-15",
      notas: "  con espacios  ",
    });

    expect(error).toBeNull();
    expect(condicion).toEqual({ id: PADECIMIENTO });

    const insertado = pasos(cliente, "insert")[0].valores;
    expect(insertado).toMatchObject({
      paciente_id: PACIENTE,
      condicion_id: CONDICION,
      fecha_diagnostico: "2026-01-15",
      notas: "con espacios",
    });
    // updated_at lo escribe el trigger de la 00010; enviarlo lo pisaria con la hora del telefono.
    expect(insertado).not.toHaveProperty("updated_at");
    // estado no se envia si no se eligio: la columna tiene DEFAULT 'activa'.
    expect(insertado).not.toHaveProperty("estado");
  });

  it("traduce el choque de unicidad a un mensaje que dice que hacer", async () => {
    crearCliente({
      data: null,
      error: { code: "23505", message: "duplicate key value violates unique constraint" },
    });

    const { condicion, error } = await asociarCondicion({
      pacienteId: PACIENTE,
      condicion: CONDICION,
      fechaDiagnostico: "2026-01-15",
    });

    expect(condicion).toBeNull();
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.UNICIDAD);
    expect(error.mensaje).toContain("ya tiene registrada esa condicion");
    // El texto del servidor no se reenvia nunca: lleva el nombre de la restriccion.
    expect(error.mensaje).not.toContain("constraint");
  });
});

describe("actualizarCondicion", () => {
  it("exige el id", async () => {
    dobles.cliente = null;

    const { error } = await actualizarCondicion(undefined, { estado: "controlada" });

    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO);
  });

  it("no manda un update vacio", async () => {
    dobles.cliente = null;

    const { error } = await actualizarCondicion(PADECIMIENTO, {});

    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO);
    expect(error.mensaje).toContain("ningun cambio");
  });

  it("envia solo los campos que cambian", async () => {
    const cliente = crearCliente({ data: { id: PADECIMIENTO }, error: null });

    await actualizarCondicion(PADECIMIENTO, { estado: "controlada" });

    const actualizado = pasos(cliente, "update")[0].valores;
    expect(actualizado).toEqual({ estado: "controlada" });
    expect(pasos(cliente, "eq")[0]).toMatchObject({ columna: "id", valor: PADECIMIENTO });
  });

  it("no deja cambiar de que condicion se trata", async () => {
    const cliente = crearCliente({ data: { id: PADECIMIENTO }, error: null });

    await actualizarCondicion(PADECIMIENTO, { estado: "activa", condicion: "otra-condicion" });

    expect(pasos(cliente, "update")[0].valores).not.toHaveProperty("condicion_id");
  });

  it("avisa cuando la politica no dejo pasar el cambio", async () => {
    // RLS no lanza en un UPDATE: corre la sentencia sin afectar filas (regla de la issue #221),
    // asi que la unica senal es que no vuelve ninguna fila.
    crearCliente({ data: null, error: null });

    const { condicion, error } = await actualizarCondicion(PADECIMIENTO, { estado: "resuelta" });

    expect(condicion).toBeNull();
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.PERMISO_DENEGADO);
  });
});

describe("desasociarCondicion", () => {
  it("da de baja marcando la condicion como resuelta, sin borrar nada", async () => {
    const cliente = crearCliente({ data: { id: PADECIMIENTO }, error: null });

    const { error } = await desasociarCondicion(PADECIMIENTO);

    expect(error).toBeNull();
    expect(pasos(cliente, "update")[0].valores).toEqual({ estado: "resuelta" });
    expect(pasos(cliente, "delete")).toHaveLength(0);
  });
});

describe("quitarCondicion", () => {
  it("borra la fila y lo confirma", async () => {
    const cliente = crearCliente({ data: [{ id: PADECIMIENTO }], error: null });

    const { quitada, error } = await quitarCondicion(PADECIMIENTO);

    expect(error).toBeNull();
    expect(quitada).toBe(true);
    expect(pasos(cliente, "delete")).toHaveLength(1);
    expect(pasos(cliente, "eq")[0]).toMatchObject({ columna: "id", valor: PADECIMIENTO });
  });

  it("explica que hacer cuando la politica no dejo borrar", async () => {
    // Es lo que le pasa a un medico: la politica de DELETE de la 00010 es solo del administrador,
    // y el DELETE corre sin afectar filas en vez de fallar.
    crearCliente({ data: [], error: null });

    const { quitada, error } = await quitarCondicion(PADECIMIENTO);

    expect(quitada).toBe(false);
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.PERMISO_DENEGADO);
    expect(error.mensaje).toContain("resuelta");
  });
});

describe("obtenerPacientesConCondicion", () => {
  it("filtra por comunidad y condicion, y excluye a los pacientes dados de baja", async () => {
    const cliente = crearCliente({ data: [], error: null });

    await obtenerPacientesConCondicion({ comunidadId: COMUNIDAD, condicionId: CONDICION });

    expect(pasos(cliente, "from")[0].tabla).toBe("padecimientos_cronicos");
    // El embed va con !inner para que el filtro por una columna del paciente descarte la fila.
    expect(pasos(cliente, "select")[0].columnas).toContain("pacientes!inner");
    expect(pasos(cliente, "is")[0]).toMatchObject({ columna: "pacientes.fecha_baja", valor: null });
    expect(pasos(cliente, "eq")).toEqual([
      { paso: "eq", columna: "pacientes.comunidad_id", valor: COMUNIDAD },
      { paso: "eq", columna: "condicion_id", valor: CONDICION },
    ]);
    // Por defecto las resueltas no interesan: no hay a quien planificar.
    expect(pasos(cliente, "neq")[0]).toMatchObject({ columna: "estado", valor: "resuelta" });
  });

  it("sin filtros devuelve a todos los cronicos vigentes", async () => {
    const cliente = crearCliente({ data: [], error: null });

    await obtenerPacientesConCondicion();

    expect(pasos(cliente, "eq")).toHaveLength(0);
    expect(pasos(cliente, "neq")).toHaveLength(1);
  });

  it("un estado concreto manda sobre el descarte de resueltas", async () => {
    const cliente = crearCliente({ data: [], error: null });

    await obtenerPacientesConCondicion({ estado: "resuelta" });

    expect(pasos(cliente, "eq")[0]).toMatchObject({ columna: "estado", valor: "resuelta" });
    expect(pasos(cliente, "neq")).toHaveLength(0);
  });

  it("aplana el paciente embebido para que la pantalla no navegue el anidamiento", async () => {
    crearCliente({
      data: [
        {
          id: PADECIMIENTO,
          estado: "activa",
          fechaDiagnostico: "2026-01-15",
          condicion: { nombre: "Diabetes" },
          paciente: {
            id: PACIENTE,
            nombres: "Nombre",
            apellidos: "Inventado Demo",
            comunidadId: COMUNIDAD,
            comunidad: { nombre: "Comunidad 122" },
          },
        },
      ],
      error: null,
    });

    const { pacientes, error } = await obtenerPacientesConCondicion({ comunidadId: COMUNIDAD });

    expect(error).toBeNull();
    expect(pacientes[0]).toMatchObject({
      id: PADECIMIENTO,
      pacienteId: PACIENTE,
      nombreCompleto: "Nombre Inventado Demo",
      comunidad: "Comunidad 122",
      condicion: "Diabetes",
      estado: "activa",
    });
    expect(pacientes[0]).not.toHaveProperty("paciente");
  });

  it("devuelve lista vacia y error normalizado si la consulta falla", async () => {
    crearCliente({ data: null, error: { code: "42501", message: "denegado" } });

    const { pacientes, error } = await obtenerPacientesConCondicion({});

    expect(pacientes).toEqual([]);
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.PERMISO_DENEGADO);
  });
});
