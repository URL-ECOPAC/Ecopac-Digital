// Pruebas de las consultas de Supabase del modulo de pacientes.
//
// Mismo patron de mock que packages/shared/jornadas/api.test.js: un doble de obtenerSupabase()
// que registra cada paso de la cadena y resuelve con la respuesta que la prueba le entregue. No
// hay Supabase real ni red: cada prueba controla exactamente lo que el "servidor" contesta, asi
// que no hace falta .env ni conexion. rpc() ademas soporta .single(), como en
// packages/shared/inventario/medicamentos.api.test.js, porque registrarPaciente() llama
// fn_registrar_paciente().single().
//
// Ningun dato real: nombres, DPI y numeros de ficha son inventados.

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
const { actualizarPaciente, obtenerPaciente, registrarPaciente } = await import("./api.js");

/**
 * Doble minimo de un query builder de supabase-js: cada metodo de la cadena registra el paso
 * (con la tabla, para poder distinguir "select" de pacientes de "select" de expedientes) y
 * devuelve el mismo objeto, para encadenar igual que el cliente real. Sirve tanto para lo que
 * termina en .single()/.maybeSingle() como para lo que se espera directamente.
 *
 * Una clave `"rpc:<nombre>"` configura la respuesta de `.rpc(nombre, argumentos)`.
 * `respuestasPorTabla` acepta una respuesta unica o un arreglo, para cuando la misma tabla se
 * consulta mas de una vez en una prueba.
 */
function crearCliente(respuestasPorTabla) {
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
      throw new Error(`La prueba no configuro una respuesta para "${tabla}".`);
    }
    return cola.length > 1 ? cola.shift() : cola[0];
  }

  function resolverDesde(respuesta) {
    return async () => (respuesta instanceof Error ? Promise.reject(respuesta) : respuesta);
  }

  return {
    llamadas,
    from(tabla) {
      llamadas.push({ paso: "from", tabla });
      const resolver = resolverDesde(siguienteRespuesta(tabla));

      const encadenable = {
        insert(valores) {
          llamadas.push({ paso: "insert", tabla, valores });
          return encadenable;
        },
        update(valores) {
          llamadas.push({ paso: "update", tabla, valores });
          return encadenable;
        },
        select(columnas) {
          llamadas.push({ paso: "select", tabla, columnas });
          return encadenable;
        },
        eq(columna, valor) {
          llamadas.push({ paso: "eq", tabla, columna, valor });
          return encadenable;
        },
        single: resolver,
        maybeSingle: resolver,
        then(resolve, reject) {
          return resolver().then(resolve, reject);
        },
      };

      return encadenable;
    },
    rpc(nombre, argumentos) {
      llamadas.push({ paso: "rpc", nombre, argumentos });
      const resolver = resolverDesde(siguienteRespuesta(`rpc:${nombre}`));

      const encadenable = {
        single: resolver,
        maybeSingle: resolver,
        then(resolve, reject) {
          return resolver().then(resolve, reject);
        },
      };
      return encadenable;
    },
  };
}

const DATOS_VALIDOS = {
  nombres: "Maria",
  apellidos: "Xoc",
  fechaNacimiento: "1990-05-10",
  sexo: "femenino",
  comunidad: "comunidad-1",
  telefonoContacto: "50212345678",
  idioma: "espanol",
  numeroFicha: "F-001",
};

beforeEach(() => {
  dobles.cliente = null;
});

describe("registrarPaciente", () => {
  it("sin numero de ficha devuelve errores sin llamar al cliente", async () => {
    const { paciente, errores, error } = await registrarPaciente({
      ...DATOS_VALIDOS,
      numeroFicha: undefined,
    });

    expect(paciente).toBeNull();
    expect(errores.numeroFicha).toBeTruthy();
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.CHECK);
  });

  it("sin nombres devuelve errores de validarRegistroPaciente sin llamar al cliente", async () => {
    const { paciente, errores, error } = await registrarPaciente({
      ...DATOS_VALIDOS,
      nombres: "",
    });

    expect(paciente).toBeNull();
    expect(errores.nombres).toBeTruthy();
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.CHECK);
  });

  it("sin sexo, telefono o idioma devuelve errores sin llamar al cliente", async () => {
    // CAMPOS_PACIENTE (issue #112) no cubre estos tres campos NOT NULL de la tabla; esta
    // prueba fija que registrarPaciente() valida contra CAMPOS_REGISTRO_PACIENTE, el
    // descriptor completo del formulario, y no solo contra CAMPOS_PACIENTE.
    const { paciente, errores, error } = await registrarPaciente({
      ...DATOS_VALIDOS,
      sexo: "",
      telefonoContacto: "",
      idioma: "",
    });

    expect(paciente).toBeNull();
    expect(errores.sexo).toBeTruthy();
    expect(errores.telefonoContacto).toBeTruthy();
    expect(errores.idioma).toBeTruthy();
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.CHECK);
  });

  it("con datos validos llama fn_registrar_paciente con los argumentos esperados", async () => {
    const cliente = crearCliente({
      "rpc:fn_registrar_paciente": {
        data: {
          id: "paciente-1",
          nombres: "Maria",
          apellidos: "Xoc",
          fecha_nacimiento: "1990-05-10",
          sexo: "femenino",
          comunidad_id: "comunidad-1",
          telefono_contacto: "50212345678",
          idioma: "espanol",
          dpi: null,
          tipo_sangre: null,
          nombre_responsable: null,
          parentesco_responsable: null,
          fecha_baja: null,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
        error: null,
      },
    });
    dobles.cliente = cliente;

    const { paciente, errores, error } = await registrarPaciente(DATOS_VALIDOS);

    expect(error).toBeNull();
    expect(errores).toEqual({});
    expect(paciente).toEqual({
      id: "paciente-1",
      nombres: "Maria",
      apellidos: "Xoc",
      fechaNacimiento: "1990-05-10",
      sexo: "femenino",
      comunidadId: "comunidad-1",
      telefonoContacto: "50212345678",
      idioma: "espanol",
      dpi: null,
      tipoSangre: null,
      nombreResponsable: null,
      parentescoResponsable: null,
      fechaBaja: null,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
      expediente: { numeroFicha: "F-001" },
    });
    expect(cliente.llamadas).toContainEqual({
      paso: "rpc",
      nombre: "fn_registrar_paciente",
      argumentos: {
        p_nombres: "Maria",
        p_apellidos: "Xoc",
        p_fecha_nacimiento: "1990-05-10",
        p_sexo: "femenino",
        p_comunidad_id: "comunidad-1",
        p_telefono_contacto: "50212345678",
        p_idioma: "espanol",
        p_numero_ficha: "F-001",
        p_dpi: null,
        p_tipo_sangre: null,
        p_nombre_responsable: null,
        p_parentesco_responsable: null,
      },
    });
  });

  it("normaliza como unicidad el numero de ficha duplicado", async () => {
    dobles.cliente = crearCliente({
      "rpc:fn_registrar_paciente": { data: null, error: { code: "23505" } },
    });

    const { paciente, error } = await registrarPaciente(DATOS_VALIDOS);

    expect(paciente).toBeNull();
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.UNICIDAD);
  });
});

describe("obtenerPaciente", () => {
  it("no toca el cliente si no hay id", async () => {
    const { paciente, error } = await obtenerPaciente(undefined);

    expect(paciente).toBeNull();
    expect(error).toBeNull();
  });

  it("combina el paciente, su expediente y sus condiciones cronicas en un solo objeto", async () => {
    dobles.cliente = crearCliente({
      pacientes: {
        data: { id: "paciente-1", nombres: "Maria", comunidad: { nombre: "Solola" } },
        error: null,
      },
      expedientes: { data: { id: "expediente-1", numeroFicha: "F-001" }, error: null },
      padecimientos_cronicos: {
        data: [{ id: "cond-1", estado: "activa", condicion: { nombre: "Diabetes" } }],
        error: null,
      },
    });

    const { paciente, error } = await obtenerPaciente("paciente-1");

    expect(error).toBeNull();
    expect(paciente).toEqual({
      id: "paciente-1",
      nombres: "Maria",
      comunidad: { nombre: "Solola" },
      expediente: { id: "expediente-1", numeroFicha: "F-001" },
      condicionesCronicas: [{ id: "cond-1", estado: "activa", condicion: { nombre: "Diabetes" } }],
    });
  });

  it("devuelve null sin error cuando el paciente no existe o RLS no lo deja ver", async () => {
    dobles.cliente = crearCliente({
      pacientes: { data: null, error: null },
      expedientes: { data: null, error: null },
      padecimientos_cronicos: { data: [], error: null },
    });

    const { paciente, error } = await obtenerPaciente("paciente-ajeno");

    expect(paciente).toBeNull();
    expect(error).toBeNull();
  });

  it("propaga el error si cualquiera de las tres consultas falla", async () => {
    dobles.cliente = crearCliente({
      pacientes: { data: { id: "paciente-1" }, error: null },
      expedientes: { data: null, error: { code: "42501" } },
      padecimientos_cronicos: { data: [], error: null },
    });

    const { paciente, error } = await obtenerPaciente("paciente-1");

    expect(paciente).toBeNull();
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.PERMISO_DENEGADO);
  });

  it("expediente llega en null si el paciente es visible pero el expediente no", async () => {
    dobles.cliente = crearCliente({
      pacientes: { data: { id: "paciente-1", nombres: "Maria" }, error: null },
      expedientes: { data: null, error: null },
      padecimientos_cronicos: { data: [], error: null },
    });

    const { paciente, error } = await obtenerPaciente("paciente-1");

    expect(error).toBeNull();
    expect(paciente.expediente).toBeNull();
  });
});

describe("actualizarPaciente", () => {
  it("no toca el cliente si no hay id", async () => {
    const { paciente, error } = await actualizarPaciente(undefined, { nombres: "Maria" });

    expect(paciente).toBeNull();
    expect(error).toBeNull();
  });

  it("rechaza el intento de modificar el numero de ficha sin tocar el cliente", async () => {
    const { paciente, error } = await actualizarPaciente("paciente-1", {
      numeroFicha: "F-999",
    });

    expect(paciente).toBeNull();
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.CHECK);
  });

  it("no toca el cliente cuando no hay campos que actualizar", async () => {
    const { paciente, error } = await actualizarPaciente("paciente-1", {});

    expect(paciente).toBeNull();
    expect(error).toBeNull();
  });

  it("una edicion parcial no exige los campos que no se estan editando", async () => {
    const cliente = crearCliente({
      pacientes: { data: { id: "paciente-1", telefonoContacto: "50298765432" }, error: null },
    });
    dobles.cliente = cliente;

    const { paciente, errores, error } = await actualizarPaciente("paciente-1", {
      telefonoContacto: "50298765432",
    });

    expect(error).toBeNull();
    expect(errores).toEqual({});
    expect(paciente).toEqual({ id: "paciente-1", telefonoContacto: "50298765432" });
    expect(cliente.llamadas).toContainEqual({
      paso: "update",
      tabla: "pacientes",
      valores: { telefono_contacto: "50298765432" },
    });
  });

  it("bloquea la edicion cuando el campo que se esta editando es invalido", async () => {
    const { paciente, errores, error } = await actualizarPaciente("paciente-1", {
      nombres: "",
    });

    expect(paciente).toBeNull();
    expect(errores.nombres).toBeTruthy();
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.CHECK);
  });

  it("bloquea la edicion de telefonoContacto vacio, un campo fuera de CAMPOS_PACIENTE", async () => {
    // telefonoContacto no esta en CAMPOS_PACIENTE (issue #112): esta prueba fija que
    // actualizarPaciente() valida contra CAMPOS_REGISTRO_PACIENTE, no solo contra el
    // subconjunto historico de 5 campos.
    const { paciente, errores, error } = await actualizarPaciente("paciente-1", {
      telefonoContacto: "",
    });

    expect(paciente).toBeNull();
    expect(errores.telefonoContacto).toBeTruthy();
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.CHECK);
  });

  it("normaliza como permiso denegado cuando RLS rechaza la edicion", async () => {
    dobles.cliente = crearCliente({
      pacientes: { data: null, error: { code: "42501" } },
    });

    const { paciente, error } = await actualizarPaciente("paciente-1", {
      telefonoContacto: "50298765432",
    });

    expect(paciente).toBeNull();
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.PERMISO_DENEGADO);
  });
});
