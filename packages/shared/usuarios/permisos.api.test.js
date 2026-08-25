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
const { ROLES } = await import("./roles.js");
const {
  ORIGEN_PERMISO,
  concederPermiso,
  listarCatalogoPermisos,
  obtenerPermisosEfectivos,
  restablecerPermiso,
  revocarPermiso,
} = await import("./permisos.api.js");

const PERMISO_JORNADAS = { id: "p-jornadas", clave: "jornadas.gestionar", modulo: "jornadas", descripcion: "" };
const PERMISO_PACIENTES = { id: "p-pacientes", clave: "pacientes.editar", modulo: "pacientes", descripcion: "" };
const PERMISO_REPORTES = { id: "p-reportes", clave: "reportes.exportar", modulo: "reportes", descripcion: "" };

/**
 * Doble de obtenerSupabase() que responde distinto por tabla, para poder probar
 * obtenerPermisosEfectivos() (que combina permisos + rol_permiso + usuario_permiso en
 * paralelo) sin que las tres consultas compartan la misma respuesta.
 *
 * @param {Record<string, object|Error>} respuestasPorTabla Respuesta `{ data, error }` (o un
 *   Error a rechazar) indexada por nombre de tabla.
 * @param {{ sesion?: object|null }} [opciones]
 */
function clienteConTablas(respuestasPorTabla, { sesion = null } = {}) {
  const llamadas = [];

  function cadenaPara(tabla) {
    function resolver() {
      const respuesta = respuestasPorTabla[tabla];
      if (respuesta instanceof Error) return Promise.reject(respuesta);
      return Promise.resolve(respuesta ?? { data: null, error: null });
    }

    const cadena = {
      select(columnas) {
        llamadas.push({ tabla, paso: "select", columnas });
        return cadena;
      },
      upsert(valores, opciones) {
        llamadas.push({ tabla, paso: "upsert", valores, opciones });
        return cadena;
      },
      delete() {
        llamadas.push({ tabla, paso: "delete" });
        return cadena;
      },
      eq(columna, valor) {
        llamadas.push({ tabla, paso: "eq", columna, valor });
        return cadena;
      },
      order(columna, opciones) {
        llamadas.push({ tabla, paso: "order", columna, opciones });
        return cadena;
      },
      maybeSingle: resolver,
      then(alCumplir, alFallar) {
        return resolver().then(alCumplir, alFallar);
      },
    };

    return cadena;
  }

  return {
    llamadas,
    cliente: {
      from(tabla) {
        llamadas.push({ paso: "from", tabla });
        return cadenaPara(tabla);
      },
      auth: {
        getSession: () => Promise.resolve({ data: { session: sesion }, error: null }),
      },
    },
  };
}

function pasos(llamadas, filtro) {
  return llamadas.filter((llamada) =>
    Object.entries(filtro).every(([clave, valor]) => llamada[clave] === valor),
  );
}

beforeEach(() => {
  dobles.cliente = null;
});

describe("listarCatalogoPermisos", () => {
  it("agrupa el catalogo por modulo, en el orden en que llega", async () => {
    const { cliente } = clienteConTablas({
      permisos: {
        data: [PERMISO_JORNADAS, PERMISO_PACIENTES, PERMISO_REPORTES],
        error: null,
      },
    });
    dobles.cliente = cliente;

    const { modulos, error } = await listarCatalogoPermisos();

    expect(error).toBeNull();
    expect(modulos).toEqual([
      { modulo: "jornadas", permisos: [PERMISO_JORNADAS] },
      { modulo: "pacientes", permisos: [PERMISO_PACIENTES] },
      { modulo: "reportes", permisos: [PERMISO_REPORTES] },
    ]);
  });

  it("ante un error de servidor devuelve la lista vacia y el error normalizado", async () => {
    const { cliente } = clienteConTablas({ permisos: { data: null, error: { code: "42501" } } });
    dobles.cliente = cliente;

    const { modulos, error } = await listarCatalogoPermisos();

    expect(modulos).toEqual([]);
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.PERMISO_DENEGADO);
  });
});

describe("obtenerPermisosEfectivos", () => {
  it("distingue el origen: rol por defecto, individual cuando hay excepcion", async () => {
    const { cliente } = clienteConTablas({
      perfiles: { data: { id: "u1", rol: ROLES.MEDICO }, error: null },
      permisos: {
        data: [PERMISO_JORNADAS, PERMISO_PACIENTES, PERMISO_REPORTES],
        error: null,
      },
      rol_permiso: { data: [{ permiso_id: PERMISO_PACIENTES.id }], error: null },
      usuario_permiso: {
        data: [{ permiso_id: PERMISO_JORNADAS.id, concedido: true }],
        error: null,
      },
    });
    dobles.cliente = cliente;

    const { modulos, error } = await obtenerPermisosEfectivos("u1");

    expect(error).toBeNull();

    const plano = modulos.flatMap((m) => m.permisos);
    expect(plano.find((p) => p.clave === "jornadas.gestionar")).toMatchObject({
      concedido: true,
      origen: ORIGEN_PERMISO.INDIVIDUAL,
    });
    expect(plano.find((p) => p.clave === "pacientes.editar")).toMatchObject({
      concedido: true,
      origen: ORIGEN_PERMISO.ROL,
    });
    expect(plano.find((p) => p.clave === "reportes.exportar")).toMatchObject({
      concedido: false,
      origen: ORIGEN_PERMISO.ROL,
    });
  });

  it("una revocacion puntual (concedido: false) le gana al permiso del rol", async () => {
    const { cliente } = clienteConTablas({
      perfiles: { data: { id: "u1", rol: ROLES.ADMINISTRADOR }, error: null },
      permisos: { data: [PERMISO_JORNADAS], error: null },
      rol_permiso: { data: [{ permiso_id: PERMISO_JORNADAS.id }], error: null },
      usuario_permiso: {
        data: [{ permiso_id: PERMISO_JORNADAS.id, concedido: false }],
        error: null,
      },
    });
    dobles.cliente = cliente;

    const { modulos } = await obtenerPermisosEfectivos("u1");

    expect(modulos[0].permisos[0]).toMatchObject({
      concedido: false,
      origen: ORIGEN_PERMISO.INDIVIDUAL,
    });
  });

  it("falla cerrado si no puede leer el perfil objetivo, sin calcular ninguna lista", async () => {
    const { cliente, llamadas } = clienteConTablas({
      perfiles: { data: null, error: null },
    });
    dobles.cliente = cliente;

    const { modulos, error } = await obtenerPermisosEfectivos("u-ajeno");

    expect(modulos).toEqual([]);
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.PERMISO_DENEGADO);
    expect(pasos(llamadas, { paso: "from", tabla: "rol_permiso" })).toHaveLength(0);
    expect(pasos(llamadas, { paso: "from", tabla: "usuario_permiso" })).toHaveLength(0);
  });

  it("sin id de usuario no hace ninguna llamada", async () => {
    const { modulos, error } = await obtenerPermisosEfectivos(undefined);

    expect(modulos).toEqual([]);
    expect(error).toBeNull();
  });
});

describe("concederPermiso y revocarPermiso", () => {
  it("resuelve la clave a un permiso_id y hace upsert con concedido: true", async () => {
    const sesion = { user: { id: "admin-1" } };
    const { cliente, llamadas } = clienteConTablas(
      {
        permisos: { data: { id: PERMISO_JORNADAS.id }, error: null },
        usuario_permiso: { data: null, error: null },
      },
      { sesion },
    );
    dobles.cliente = cliente;

    const { error } = await concederPermiso("u1", "jornadas.gestionar", { motivo: "cobertura" });

    expect(error).toBeNull();
    const upsert = pasos(llamadas, { tabla: "usuario_permiso", paso: "upsert" })[0];
    expect(upsert.valores).toEqual({
      perfil_id: "u1",
      permiso_id: PERMISO_JORNADAS.id,
      concedido: true,
      otorgado_por: "admin-1",
      motivo: "cobertura",
    });
    expect(upsert.opciones).toEqual({ onConflict: "perfil_id,permiso_id" });
  });

  it("revocarPermiso hace upsert con concedido: false", async () => {
    const { cliente, llamadas } = clienteConTablas({
      permisos: { data: { id: PERMISO_JORNADAS.id }, error: null },
      usuario_permiso: { data: null, error: null },
    });
    dobles.cliente = cliente;

    await revocarPermiso("u1", "jornadas.gestionar");

    const upsert = pasos(llamadas, { tabla: "usuario_permiso", paso: "upsert" })[0];
    expect(upsert.valores.concedido).toBe(false);
    expect(upsert.valores.otorgado_por).toBeNull();
    expect(upsert.valores.motivo).toBeNull();
  });

  it("una clave que no existe en el catalogo no llega a escribir nada", async () => {
    const { cliente, llamadas } = clienteConTablas({
      permisos: { data: null, error: null },
    });
    dobles.cliente = cliente;

    const { error } = await concederPermiso("u1", "modulo.inexistente");

    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.SIN_RESULTADOS);
    expect(pasos(llamadas, { paso: "from", tabla: "usuario_permiso" })).toHaveLength(0);
  });

  it("un no-administrador recibe el 42501 traducido, sin excepcion", async () => {
    const { cliente } = clienteConTablas({
      permisos: { data: { id: PERMISO_JORNADAS.id }, error: null },
      usuario_permiso: { data: null, error: { code: "42501" } },
    });
    dobles.cliente = cliente;

    const { error } = await concederPermiso("u1", "jornadas.gestionar");

    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.PERMISO_DENEGADO);
  });
});

describe("restablecerPermiso", () => {
  it("borra la fila de usuario_permiso por perfil_id y permiso_id", async () => {
    const { cliente, llamadas } = clienteConTablas({
      permisos: { data: { id: PERMISO_JORNADAS.id }, error: null },
      usuario_permiso: { data: null, error: null },
    });
    dobles.cliente = cliente;

    const { error } = await restablecerPermiso("u1", "jornadas.gestionar");

    expect(error).toBeNull();
    expect(pasos(llamadas, { tabla: "usuario_permiso", paso: "delete" })).toHaveLength(1);
    expect(pasos(llamadas, { tabla: "usuario_permiso", paso: "eq" })).toEqual([
      { tabla: "usuario_permiso", paso: "eq", columna: "perfil_id", valor: "u1" },
      { tabla: "usuario_permiso", paso: "eq", columna: "permiso_id", valor: PERMISO_JORNADAS.id },
    ]);
  });

  it("borrar una excepcion que no existe no es un error", async () => {
    const { cliente } = clienteConTablas({
      permisos: { data: { id: PERMISO_JORNADAS.id }, error: null },
      usuario_permiso: { data: null, error: null },
    });
    dobles.cliente = cliente;

    const { error } = await restablecerPermiso("u-sin-excepcion", "jornadas.gestionar");

    expect(error).toBeNull();
  });

  it("un no-administrador recibe el 42501 traducido", async () => {
    const { cliente } = clienteConTablas({
      permisos: { data: { id: PERMISO_JORNADAS.id }, error: null },
      usuario_permiso: { data: null, error: { code: "42501" } },
    });
    dobles.cliente = cliente;

    const { error } = await restablecerPermiso("u1", "jornadas.gestionar");

    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.PERMISO_DENEGADO);
  });
});
