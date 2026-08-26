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
const { ROLES, TODOS_LOS_ROLES } = await import("./roles.js");
const modulo = await import("./api.js");
const {
  actualizarUsuario,
  crearUsuario,
  desactivarUsuario,
  FUNCION_DE_INVITACION,
  listarCatalogoEspecialidades,
  listarUsuarios,
  reactivarUsuario,
} = modulo;

function doble(respuesta) {
  const llamadas = [];

  function resolver() {
    return respuesta instanceof Error ? Promise.reject(respuesta) : Promise.resolve(respuesta);
  }

  const cadena = {
    select(columnas) {
      llamadas.push({ paso: "select", columnas });
      return cadena;
    },
    update(valores) {
      llamadas.push({ paso: "update", valores });
      return cadena;
    },
    eq(columna, valor) {
      llamadas.push({ paso: "eq", columna, valor });
      return cadena;
    },
    in(columna, valores) {
      llamadas.push({ paso: "in", columna, valores });
      return cadena;
    },
    or(expresion) {
      llamadas.push({ paso: "or", expresion });
      return cadena;
    },
    order(columna, opciones) {
      llamadas.push({ paso: "order", columna, opciones });
      return cadena;
    },
    maybeSingle: resolver,
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
      functions: {
        invoke(nombre, opciones) {
          llamadas.push({ paso: "invoke", nombre, opciones });
          return resolver();
        },
      },
    },
  };
}

function pasos(llamadas, paso) {
  return llamadas.filter((llamada) => llamada.paso === paso);
}

/**
 * Doble que distingue por tabla, para las pruebas que necesitan dos consultas con respuestas
 * distintas (el filtro de especialidad de listarUsuarios() primero consulta perfil_especialidad
 * y despues perfiles). Mismo patron que crearCliente() de jornadas/api.test.js: cada tabla tiene
 * su propia cola de respuestas, para no mezclar la de una con la de otra.
 */
function dobleMultiTabla(respuestasPorTabla) {
  const llamadas = [];
  const colas = new Map(
    Object.entries(respuestasPorTabla).map(([tabla, respuesta]) => [
      tabla,
      Array.isArray(respuesta) ? [...respuesta] : [respuesta],
    ]),
  );

  function siguienteRespuesta(tabla) {
    const cola = colas.get(tabla);
    if (!cola || cola.length === 0) {
      throw new Error(`La prueba no configuro una respuesta para la tabla "${tabla}".`);
    }
    return cola.length > 1 ? cola.shift() : cola[0];
  }

  return {
    llamadas,
    cliente: {
      from(tabla) {
        llamadas.push({ paso: "from", tabla });
        const respuesta = siguienteRespuesta(tabla);
        const resolver = () =>
          respuesta instanceof Error ? Promise.reject(respuesta) : Promise.resolve(respuesta);

        const cadena = {
          select(columnas) {
            llamadas.push({ paso: "select", tabla, columnas });
            return cadena;
          },
          eq(columna, valor) {
            llamadas.push({ paso: "eq", tabla, columna, valor });
            return cadena;
          },
          in(columna, valores) {
            llamadas.push({ paso: "in", tabla, columna, valores });
            return cadena;
          },
          or(expresion) {
            llamadas.push({ paso: "or", tabla, expresion });
            return cadena;
          },
          order(columna, opciones) {
            llamadas.push({ paso: "order", tabla, columna, opciones });
            return cadena;
          },
          maybeSingle: resolver,
          then(alCumplir, alFallar) {
            return resolver().then(alCumplir, alFallar);
          },
        };

        return cadena;
      },
    },
  };
}

function usuarioValido(cambios = {}) {
  return {
    nombres: "Ana Lucia",
    apellidos: "Perez",
    email: "ana.perez@ejemplo.org",
    telefono: "5512-3456",
    rol: ROLES.MEDICO,
    ...cambios,
  };
}

beforeEach(() => {
  dobles.cliente = null;
});

describe("listarUsuarios", () => {
  it("ordena por apellidos y despues por nombres", async () => {
    const { cliente, llamadas } = doble({ data: [{ id: "u1" }], error: null });
    dobles.cliente = cliente;

    const { usuarios, error } = await listarUsuarios();

    expect(error).toBeNull();
    expect(usuarios).toHaveLength(1);
    expect(pasos(llamadas, "from")[0].tabla).toBe("perfiles");
    expect(pasos(llamadas, "order").map(({ columna }) => columna)).toEqual([
      "apellidos",
      "nombres",
    ]);
  });

  it("sin filtros no restringe nada", async () => {
    const { cliente, llamadas } = doble({ data: [], error: null });
    dobles.cliente = cliente;

    await listarUsuarios();

    expect(pasos(llamadas, "eq")).toHaveLength(0);
    expect(pasos(llamadas, "or")).toHaveLength(0);
  });

  it("filtra por rol", async () => {
    const { cliente, llamadas } = doble({ data: [], error: null });
    dobles.cliente = cliente;

    await listarUsuarios({ rol: ROLES.ADMINISTRADOR });

    expect(pasos(llamadas, "eq")[0]).toEqual({
      paso: "eq",
      columna: "rol",
      valor: ROLES.ADMINISTRADOR,
    });
  });

  it("traduce el estado a la columna booleana activo", async () => {
    for (const [estado, esperado] of [
      ["activo", true],
      ["inactivo", false],
      [true, true],
      [false, false],
    ]) {
      const { cliente, llamadas } = doble({ data: [], error: null });
      dobles.cliente = cliente;

      await listarUsuarios({ estado });

      expect(pasos(llamadas, "eq")[0]).toEqual({
        paso: "eq",
        columna: "activo",
        valor: esperado,
      });
    }
  });

  it("un estado desconocido no filtra en lugar de inventar un valor", async () => {
    const { cliente, llamadas } = doble({ data: [], error: null });
    dobles.cliente = cliente;

    await listarUsuarios({ estado: "cualquier-cosa" });

    expect(pasos(llamadas, "eq")).toHaveLength(0);
  });

  it("busca por nombres, apellidos y correo a la vez", async () => {
    const { cliente, llamadas } = doble({ data: [], error: null });
    dobles.cliente = cliente;

    await listarUsuarios({ busqueda: "perez" });

    const { expresion } = pasos(llamadas, "or")[0];
    expect(expresion).toContain("nombres.ilike.%perez%");
    expect(expresion).toContain("apellidos.ilike.%perez%");
    expect(expresion).toContain("email.ilike.%perez%");
  });

  it("neutraliza los caracteres que romperian la expresion del filtro", async () => {
    const { cliente, llamadas } = doble({ data: [], error: null });
    dobles.cliente = cliente;

    await listarUsuarios({ busqueda: "per,ez%_()" });

    const { expresion } = pasos(llamadas, "or")[0];
    expect(expresion).not.toContain(",ez");
    expect(expresion).not.toContain("%_");
  });

  it("una busqueda de solo espacios no filtra", async () => {
    const { cliente, llamadas } = doble({ data: [], error: null });
    dobles.cliente = cliente;

    await listarUsuarios({ busqueda: "   " });

    expect(pasos(llamadas, "or")).toHaveLength(0);
  });

  it("ante un error devuelve lista vacia y el error normalizado", async () => {
    dobles.cliente = doble({ data: null, error: { code: "42501" } }).cliente;

    const { usuarios, error } = await listarUsuarios();

    expect(usuarios).toEqual([]);
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.PERMISO_DENEGADO);
    expect(error.mensaje).toContain("permiso");
  });

  it("los cinco roles filtran, no solo medico y voluntario", async () => {
    for (const rol of TODOS_LOS_ROLES) {
      const { cliente, llamadas } = doble({ data: [], error: null });
      dobles.cliente = cliente;

      await listarUsuarios({ rol });

      expect(pasos(llamadas, "eq")[0]).toEqual({ paso: "eq", columna: "rol", valor: rol });
    }
  });

  it("cada perfil trae sus especialidades como arreglo de strings, no de objetos", async () => {
    const { cliente } = doble({
      data: [
        { id: "u1", especialidades: [{ nombre_especialidad: "Pediatria" }, { nombre_especialidad: "Odontologia" }] },
        { id: "u2", especialidades: [] },
        { id: "u3" },
      ],
      error: null,
    });
    dobles.cliente = cliente;

    const { usuarios, error } = await listarUsuarios();

    expect(error).toBeNull();
    expect(usuarios).toEqual([
      { id: "u1", especialidades: ["Pediatria", "Odontologia"] },
      { id: "u2", especialidades: [] },
      { id: "u3", especialidades: [] },
    ]);
  });

  it("pide el embed de perfil_especialidad en el mismo select, no en una consulta aparte", async () => {
    const { cliente, llamadas } = doble({ data: [], error: null });
    dobles.cliente = cliente;

    await listarUsuarios();

    expect(pasos(llamadas, "from")).toHaveLength(1);
    expect(pasos(llamadas, "select")[0].columnas).toContain(
      "especialidades:perfil_especialidad(nombre_especialidad)",
    );
  });

  describe("filtro de especialidad", () => {
    it("resuelve los ids en perfil_especialidad y despues acota perfiles con .in()", async () => {
      const { cliente, llamadas } = dobleMultiTabla({
        perfil_especialidad: { data: [{ perfil_id: "u1" }, { perfil_id: "u2" }], error: null },
        perfiles: { data: [{ id: "u1" }, { id: "u2" }], error: null },
      });
      dobles.cliente = cliente;

      const { usuarios, error } = await listarUsuarios({ especialidad: "Pediatria" });

      expect(error).toBeNull();
      expect(usuarios).toHaveLength(2);
      expect(llamadas).toContainEqual({
        paso: "eq",
        tabla: "perfil_especialidad",
        columna: "nombre_especialidad",
        valor: "Pediatria",
      });
      expect(llamadas).toContainEqual({
        paso: "in",
        tabla: "perfiles",
        columna: "id",
        valores: ["u1", "u2"],
      });
    });

    it("sin ningun perfil con esa especialidad, corta sin tocar perfiles", async () => {
      const { cliente, llamadas } = dobleMultiTabla({
        perfil_especialidad: { data: [], error: null },
      });
      dobles.cliente = cliente;

      const { usuarios, error } = await listarUsuarios({ especialidad: "Cardiologia" });

      expect(error).toBeNull();
      expect(usuarios).toEqual([]);
      expect(pasos(llamadas, "from").map(({ tabla }) => tabla)).toEqual(["perfil_especialidad"]);
    });

    it("se combina con rol y estado en la misma consulta", async () => {
      const { cliente, llamadas } = dobleMultiTabla({
        perfil_especialidad: { data: [{ perfil_id: "u1" }], error: null },
        perfiles: { data: [], error: null },
      });
      dobles.cliente = cliente;

      await listarUsuarios({ especialidad: "Pediatria", rol: ROLES.MEDICO, estado: "activo" });

      expect(llamadas).toContainEqual({
        paso: "eq",
        tabla: "perfiles",
        columna: "rol",
        valor: ROLES.MEDICO,
      });
      expect(llamadas).toContainEqual({
        paso: "eq",
        tabla: "perfiles",
        columna: "activo",
        valor: true,
      });
      expect(llamadas).toContainEqual({
        paso: "in",
        tabla: "perfiles",
        columna: "id",
        valores: ["u1"],
      });
    });

    it("un error al resolver los ids se normaliza igual que cualquier otro", async () => {
      const { cliente } = dobleMultiTabla({
        perfil_especialidad: { data: null, error: { code: "42501" } },
      });
      dobles.cliente = cliente;

      const { usuarios, error } = await listarUsuarios({ especialidad: "Pediatria" });

      expect(usuarios).toEqual([]);
      expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.PERMISO_DENEGADO);
    });
  });
});

describe("listarCatalogoEspecialidades", () => {
  it("deduplica, ordena alfabeticamente y da la forma { valor, etiqueta }", async () => {
    const { cliente } = doble({
      data: [
        { nombre_especialidad: "Pediatria" },
        { nombre_especialidad: "Odontologia" },
        { nombre_especialidad: "Pediatria" },
      ],
      error: null,
    });
    dobles.cliente = cliente;

    const { especialidades, error } = await listarCatalogoEspecialidades();

    expect(error).toBeNull();
    expect(especialidades).toEqual([
      { valor: "Odontologia", etiqueta: "Odontologia" },
      { valor: "Pediatria", etiqueta: "Pediatria" },
    ]);
  });

  it("sin ninguna especialidad asignada devuelve un arreglo vacio", async () => {
    const { cliente } = doble({ data: [], error: null });
    dobles.cliente = cliente;

    const { especialidades, error } = await listarCatalogoEspecialidades();

    expect(error).toBeNull();
    expect(especialidades).toEqual([]);
  });

  it("ante un error devuelve arreglo vacio y el error normalizado", async () => {
    const { cliente } = doble({ data: null, error: { code: "42501" } });
    dobles.cliente = cliente;

    const { especialidades, error } = await listarCatalogoEspecialidades();

    expect(especialidades).toEqual([]);
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.PERMISO_DENEGADO);
  });
});

describe("crearUsuario", () => {
  it("invita llamando a la funcion del servidor, no desde el cliente", async () => {
    const { cliente, llamadas } = doble({ data: { id: "u1" }, error: null });
    dobles.cliente = cliente;

    const { usuario, error } = await crearUsuario(usuarioValido());

    expect(error).toBeNull();
    expect(usuario).toEqual({ id: "u1" });

    const invocacion = pasos(llamadas, "invoke")[0];
    expect(invocacion.nombre).toBe(FUNCION_DE_INVITACION);
    expect(invocacion.opciones.body).toEqual({
      nombres: "Ana Lucia",
      apellidos: "Perez",
      email: "ana.perez@ejemplo.org",
      telefono: "5512-3456",
      rol: ROLES.MEDICO,
    });
  });

  it("rechaza datos invalidos sin llegar al servidor", async () => {
    const { usuario, errores, error } = await crearUsuario(
      usuarioValido({ email: "no-es-un-correo" }),
    );

    expect(usuario).toBeNull();
    expect(errores.email).toBeTruthy();
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.CHECK);
  });

  it("rechaza un rol que no existe en el enum de la base", async () => {
    const { usuario, errores } = await crearUsuario(usuarioValido({ rol: "superusuario" }));

    expect(usuario).toBeNull();
    expect(errores.rol).toBeTruthy();
  });

  it("normaliza el error que devuelva la funcion", async () => {
    dobles.cliente = doble({ data: null, error: { code: "42501" } }).cliente;

    const { usuario, error } = await crearUsuario(usuarioValido());

    expect(usuario).toBeNull();
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.PERMISO_DENEGADO);
  });
});

describe("actualizarUsuario", () => {
  it("envia solo los campos recibidos, no borra lo que no toca", async () => {
    const { cliente, llamadas } = doble({ data: { id: "u1" }, error: null });
    dobles.cliente = cliente;

    await actualizarUsuario("u1", { telefono: "5512-3456" });

    expect(pasos(llamadas, "update")[0].valores).toEqual({ telefono: "5512-3456" });
  });

  it("no deja cambiar el correo, que es la identidad en Supabase Auth", async () => {
    const { cliente, llamadas } = doble({ data: { id: "u1" }, error: null });
    dobles.cliente = cliente;

    await actualizarUsuario("u1", { nombres: "Ana", email: "otro@ejemplo.org" });

    expect(pasos(llamadas, "update")[0].valores).toEqual({ nombres: "Ana" });
  });

  it("rechaza un rol invalido antes de llegar al servidor", async () => {
    const { perfil, errores } = await actualizarUsuario("u1", { rol: "superusuario" });

    expect(perfil).toBeNull();
    expect(errores.rol).toBeTruthy();
  });

  it("sin campos editables no gasta una llamada", async () => {
    const { perfil, error } = await actualizarUsuario("u1", { email: "otro@ejemplo.org" });

    expect(perfil).toBeNull();
    expect(error).toBeNull();
  });

  it("sin identificador no hace nada", async () => {
    const { perfil, error } = await actualizarUsuario(undefined, { nombres: "Ana" });

    expect(perfil).toBeNull();
    expect(error).toBeNull();
  });
});

describe("desactivarUsuario y reactivarUsuario", () => {
  it("desactivar solo mueve la columna activo a falso", async () => {
    const { cliente, llamadas } = doble({ data: { id: "u1", activo: false }, error: null });
    dobles.cliente = cliente;

    const { perfil, error } = await desactivarUsuario("u1");

    expect(error).toBeNull();
    expect(perfil.activo).toBe(false);
    expect(pasos(llamadas, "update")[0].valores).toEqual({ activo: false });
    expect(pasos(llamadas, "eq")[0]).toEqual({ paso: "eq", columna: "id", valor: "u1" });
  });

  it("reactivar la mueve a verdadero", async () => {
    const { cliente, llamadas } = doble({ data: { id: "u1", activo: true }, error: null });
    dobles.cliente = cliente;

    await reactivarUsuario("u1");

    expect(pasos(llamadas, "update")[0].valores).toEqual({ activo: true });
  });

  it("un usuario sin permiso recibe un mensaje claro", async () => {
    dobles.cliente = doble({ data: null, error: { code: "42501" } }).cliente;

    const { error } = await desactivarUsuario("u1");

    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.PERMISO_DENEGADO);
    expect(error.mensaje).toContain("permiso");
  });
});

describe("borrado fisico", () => {
  it("el modulo no expone ninguna funcion de borrado", () => {
    const sospechosas = Object.keys(modulo).filter((nombre) =>
      /borrar|eliminar|delete/i.test(nombre),
    );

    expect(sospechosas).toEqual([]);
  });
});
