// Pruebas de las consultas de Supabase del modulo de pacientes.
//
// Mismo patron de mock que packages/shared/jornadas/api.test.js: un doble de obtenerSupabase()
// que registra cada paso de la cadena y resuelve con la respuesta que la prueba le entregue. No
// hay Supabase real ni red: cada prueba controla exactamente lo que el "servidor" contesta, asi
// que no hace falta .env ni conexion. rpc() ademas soporta .single(), como en
// packages/shared/inventario/medicamentos.api.test.js, porque registrarPaciente() llama
// fn_registrar_paciente().single().
//
// El doble tambien acepta .abortSignal(), que es lo que encadena buscarPacientes cuando recibe
// una senal de cancelacion (issue #520).
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
const { actualizarPaciente, buscarPacientePorFicha, buscarPacientes, obtenerPaciente, registrarPaciente } =
  await import("./api.js");

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
        abortSignal(signal) {
          llamadas.push({ paso: "abortSignal", tabla, signal });
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
        abortSignal(signal) {
          llamadas.push({ paso: "abortSignal", nombre, signal });
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
};

beforeEach(() => {
  dobles.cliente = null;
});

describe("registrarPaciente", () => {
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
          numero_ficha: "000001",
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
      expediente: { numeroFicha: "000001" },
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

describe("buscarPacientePorFicha", () => {
  it("no toca el cliente si la ficha viene vacia o solo espacios", async () => {
    const { paciente, error } = await buscarPacientePorFicha("   ");

    expect(paciente).toBeNull();
    expect(error).toBeNull();
  });

  it("devuelve el paciente cuando la ficha existe y no esta dado de baja", async () => {
    const cliente = crearCliente({
      expedientes: {
        data: {
          numeroFicha: "F-001",
          paciente: {
            id: "paciente-1",
            nombres: "Maria",
            apellidos: "Xoc",
            fechaBaja: null,
            comunidad: { nombre: "Solola" },
          },
        },
        error: null,
      },
    });
    dobles.cliente = cliente;

    const { paciente, error } = await buscarPacientePorFicha("F-001");

    expect(error).toBeNull();
    expect(paciente).toEqual({
      id: "paciente-1",
      nombres: "Maria",
      apellidos: "Xoc",
      comunidad: { nombre: "Solola" },
      numeroFicha: "F-001",
      condiciones: [],
    });
    expect(cliente.llamadas).toContainEqual({ paso: "eq", tabla: "expedientes", columna: "numero_ficha", valor: "F-001" });
  });

  it("devuelve null sin error cuando la ficha no existe", async () => {
    dobles.cliente = crearCliente({ expedientes: { data: null, error: null } });

    const { paciente, error } = await buscarPacientePorFicha("F-999");

    expect(paciente).toBeNull();
    expect(error).toBeNull();
  });

  it("devuelve null sin error cuando el paciente de esa ficha esta dado de baja", async () => {
    dobles.cliente = crearCliente({
      expedientes: {
        data: {
          numeroFicha: "F-002",
          paciente: { id: "paciente-2", nombres: "Juan", fechaBaja: "2025-01-01" },
        },
        error: null,
      },
    });

    const { paciente, error } = await buscarPacientePorFicha("F-002");

    expect(paciente).toBeNull();
    expect(error).toBeNull();
  });

  it("normaliza el error si el cliente falla", async () => {
    dobles.cliente = crearCliente({ expedientes: { data: null, error: { code: "42501" } } });

    const { paciente, error } = await buscarPacientePorFicha("F-001");

    expect(paciente).toBeNull();
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.PERMISO_DENEGADO);
  });
});

describe("buscarPacientes", () => {
  it("sin termino y sin comunidad devuelve vacio sin tocar el cliente", async () => {
    const { pacientes, total, error, terminoDemasiadoCorto } = await buscarPacientes();

    expect(pacientes).toEqual([]);
    expect(total).toBe(0);
    expect(error).toBeNull();
    expect(terminoDemasiadoCorto).toBe(false);
  });

  it("un termino de menos de 3 caracteres no llama a fn_buscar_pacientes, pero si prueba la ficha", async () => {
    // Ningun "rpc:fn_buscar_pacientes" configurado: si buscarPacientes() lo llamara, el
    // doble lanzaria "La prueba no configuro una respuesta para...", y la prueba fallaria.
    dobles.cliente = crearCliente({ expedientes: { data: null, error: null } });

    const { pacientes, total, terminoDemasiadoCorto, error } = await buscarPacientes({ termino: "jo" });

    expect(error).toBeNull();
    expect(pacientes).toEqual([]);
    expect(total).toBe(0);
    expect(terminoDemasiadoCorto).toBe(true);
  });

  it("un termino corto SI encuentra una ficha exacta que coincida", async () => {
    dobles.cliente = crearCliente({
      expedientes: {
        data: { numeroFicha: "42", paciente: { id: "paciente-1", nombres: "Ana", fechaBaja: null } },
        error: null,
      },
    });

    const { pacientes, coincidenciaExacta, terminoDemasiadoCorto, error } = await buscarPacientes({
      termino: "42",
    });

    expect(error).toBeNull();
    expect(terminoDemasiadoCorto).toBe(true);
    expect(coincidenciaExacta).toBe(true);
    expect(pacientes).toEqual([
      { id: "paciente-1", nombres: "Ana", numeroFicha: "42", condiciones: [] },
    ]);
  });

  it("termino corto con comunidad SI llama a fn_buscar_pacientes, sin termino, para listar la comunidad", async () => {
    const cliente = crearCliente({
      "rpc:fn_buscar_pacientes": {
        data: [
          {
            paciente_id: "paciente-1",
            nombres: "Ana",
            apellidos: "Lopez",
            fecha_nacimiento: "2000-01-01",
            sexo: "femenino",
            comunidad_id: "comunidad-1",
            comunidad_nombre: "Solola",
            numero_ficha: "F-010",
            relevancia: 0,
            pagina: 1,
            por_pagina: 20,
            total: 1,
          },
        ],
        error: null,
      },
      expedientes: { data: null, error: null },
    });
    dobles.cliente = cliente;

    const { pacientes, total, terminoDemasiadoCorto } = await buscarPacientes({
      termino: "jo",
      comunidadId: "comunidad-1",
    });

    expect(terminoDemasiadoCorto).toBe(true);
    expect(total).toBe(1);
    expect(pacientes).toHaveLength(1);
    expect(cliente.llamadas).toContainEqual({
      paso: "rpc",
      nombre: "fn_buscar_pacientes",
      argumentos: {
        p_termino: null,
        p_comunidad_id: "comunidad-1",
        p_pagina: 1,
        p_por_pagina: 20,
        p_condicion_cronica_id: null,
        p_sexo: null,
        p_edad_min: null,
        p_edad_max: null,
      },
    });
  });

  it("comunidad sin termino devuelve el listado paginado de esa comunidad", async () => {
    const cliente = crearCliente({
      "rpc:fn_buscar_pacientes": {
        data: [
          {
            paciente_id: "paciente-1",
            nombres: "Ana",
            apellidos: "Lopez",
            fecha_nacimiento: "2000-01-01",
            sexo: "femenino",
            comunidad_id: "comunidad-1",
            comunidad_nombre: "Solola",
            numero_ficha: "F-010",
            relevancia: 0,
            pagina: 1,
            por_pagina: 20,
            total: 3,
          },
        ],
        error: null,
      },
      expedientes: { data: null, error: null },
    });
    dobles.cliente = cliente;

    const { pacientes, total, pagina, porPagina } = await buscarPacientes({ comunidadId: "comunidad-1" });

    expect(total).toBe(3);
    expect(pagina).toBe(1);
    expect(porPagina).toBe(20);
    expect(pacientes[0]).toEqual({
      id: "paciente-1",
      nombres: "Ana",
      apellidos: "Lopez",
      fechaNacimiento: "2000-01-01",
      sexo: "femenino",
      comunidadId: "comunidad-1",
      comunidad: { nombre: "Solola" },
      numeroFicha: "F-010",
      ultimaAtencion: null,
      condiciones: [],
      relevancia: 0,
    });
    expect(cliente.llamadas).toContainEqual({
      paso: "rpc",
      nombre: "fn_buscar_pacientes",
      argumentos: {
        p_termino: null,
        p_comunidad_id: "comunidad-1",
        p_pagina: 1,
        p_por_pagina: 20,
        p_condicion_cronica_id: null,
        p_sexo: null,
        p_edad_min: null,
        p_edad_max: null,
      },
    });
  });

  it("un termino de 3 caracteres o mas llama a fn_buscar_pacientes con el termino normalizado", async () => {
    const cliente = crearCliente({
      "rpc:fn_buscar_pacientes": { data: [], error: null },
      expedientes: { data: null, error: null },
    });
    dobles.cliente = cliente;

    await buscarPacientes({ termino: "  maria   jose  " });

    expect(cliente.llamadas).toContainEqual({
      paso: "rpc",
      nombre: "fn_buscar_pacientes",
      argumentos: {
        p_termino: "maria jose",
        p_comunidad_id: null,
        p_pagina: 1,
        p_por_pagina: 20,
        p_condicion_cronica_id: null,
        p_sexo: null,
        p_edad_min: null,
        p_edad_max: null,
      },
    });
  });

  it("combina la coincidencia exacta de ficha con los resultados por nombre, sin duplicar", async () => {
    dobles.cliente = crearCliente({
      "rpc:fn_buscar_pacientes": {
        data: [
          {
            paciente_id: "paciente-2",
            nombres: "Pedro",
            apellidos: "Vasquez",
            fecha_nacimiento: "1990-01-01",
            sexo: "masculino",
            comunidad_id: "comunidad-1",
            comunidad_nombre: "Solola",
            numero_ficha: "F-002",
            relevancia: 0.5,
            pagina: 1,
            por_pagina: 20,
            total: 1,
          },
        ],
        error: null,
      },
      expedientes: {
        data: {
          numeroFicha: "F-002",
          paciente: { id: "paciente-2", nombres: "Pedro", fechaBaja: null },
        },
        error: null,
      },
    });

    const { pacientes, coincidenciaExacta } = await buscarPacientes({ termino: "F-002" });

    expect(coincidenciaExacta).toBe(true);
    // paciente-2 aparece en ambas respuestas: no se duplica en el resultado combinado.
    expect(pacientes).toHaveLength(1);
  });

  it("pagina mas alla del final: usa la pagina y el total que devuelve la funcion, no lo pedido", async () => {
    dobles.cliente = crearCliente({
      "rpc:fn_buscar_pacientes": {
        data: [
          {
            paciente_id: "paciente-3",
            nombres: "Marta",
            apellidos: "Xiloj",
            fecha_nacimiento: "1958-03-12",
            sexo: "femenino",
            comunidad_id: "comunidad-1",
            comunidad_nombre: "Solola",
            numero_ficha: "F-003",
            relevancia: 0,
            pagina: 2,
            por_pagina: 2,
            total: 3,
          },
        ],
        error: null,
      },
      expedientes: { data: null, error: null },
    });

    const { pagina, porPagina, total, pacientes } = await buscarPacientes({
      comunidadId: "comunidad-1",
      pagina: 99,
      porPagina: 2,
    });

    expect(pagina).toBe(2);
    expect(porPagina).toBe(2);
    expect(total).toBe(3);
    expect(pacientes).toHaveLength(1);
  });

  it("sin resultados reales infiere total 0 y pagina 1 (fn_buscar_pacientes no devuelve filas)", async () => {
    dobles.cliente = crearCliente({
      "rpc:fn_buscar_pacientes": { data: [], error: null },
      expedientes: { data: null, error: null },
    });

    const { pacientes, total, pagina, error } = await buscarPacientes({ termino: "zzzz" });

    expect(error).toBeNull();
    expect(pacientes).toEqual([]);
    expect(total).toBe(0);
    expect(pagina).toBe(1);
  });

  it("falla cerrado si fn_buscar_pacientes devuelve error: nunca error null con la forma de vacio", async () => {
    dobles.cliente = crearCliente({
      "rpc:fn_buscar_pacientes": { data: null, error: { code: "PGRST000" } },
      expedientes: { data: null, error: null },
    });

    const { pacientes, total, error } = await buscarPacientes({ termino: "maria" });

    expect(pacientes).toEqual([]);
    expect(total).toBe(0);
    expect(error).not.toBeNull();
  });

  it("falla cerrado si la sonda de ficha falla, aunque la busqueda por nombre haya funcionado", async () => {
    dobles.cliente = crearCliente({
      "rpc:fn_buscar_pacientes": { data: [], error: null },
      expedientes: { data: null, error: { code: "42501" } },
    });

    const { pacientes, error } = await buscarPacientes({ termino: "maria" });

    expect(pacientes).toEqual([]);
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.PERMISO_DENEGADO);
  });
});

// Cancelacion de peticiones en vuelo (issue #520).
//
// Hasta esta issue una busqueda descartada seguia viajando por la red: el hook ignoraba la
// respuesta, pero la consulta ya habia salido. Lo que se comprueba aqui es el contrato que el
// hook necesita para poder abortar de verdad: que la senal llegue a las dos consultas, y que un
// aborto se distinga de un fallo.
describe("buscarPacientes con cancelacion", () => {
  it("sin senal no encadena abortSignal: quien no cancela no paga ese paso", async () => {
    const cliente = crearCliente({
      "rpc:fn_buscar_pacientes": { data: [], error: null },
      expedientes: { data: null, error: null },
    });
    dobles.cliente = cliente;

    await buscarPacientes({ termino: "maria" });

    expect(cliente.llamadas.some((l) => l.paso === "abortSignal")).toBe(false);
  });

  it("con senal la encadena en la busqueda por nombre y en la sonda de ficha", async () => {
    const cliente = crearCliente({
      "rpc:fn_buscar_pacientes": { data: [], error: null },
      expedientes: { data: null, error: null },
    });
    dobles.cliente = cliente;
    const { signal } = new AbortController();

    await buscarPacientes({ termino: "maria", signal });

    const abortos = cliente.llamadas.filter((l) => l.paso === "abortSignal");
    expect(abortos).toHaveLength(2);
    expect(abortos.every((l) => l.signal === signal)).toBe(true);
    expect(abortos.map((l) => l.nombre ?? l.tabla).sort()).toEqual([
      "expedientes",
      "fn_buscar_pacientes",
    ]);
  });

  it("un aborto de la busqueda devuelve cancelada, no un error que la pantalla tenga que pintar", async () => {
    dobles.cliente = crearCliente({
      "rpc:fn_buscar_pacientes": { data: null, error: { name: "AbortError", message: "The operation was aborted" } },
      expedientes: { data: null, error: null },
    });

    const { pacientes, error, cancelada } = await buscarPacientes({
      termino: "maria",
      signal: new AbortController().signal,
    });

    expect(cancelada).toBe(true);
    expect(error).toBeNull();
    expect(pacientes).toEqual([]);
  });

  it("un aborto de la sonda de ficha tambien cancela, aunque la busqueda por nombre respondiera", async () => {
    dobles.cliente = crearCliente({
      "rpc:fn_buscar_pacientes": { data: [], error: null },
      expedientes: { data: null, error: { name: "AbortError", message: "The operation was aborted" } },
    });

    const { error, cancelada } = await buscarPacientes({
      termino: "maria",
      signal: new AbortController().signal,
    });

    expect(cancelada).toBe(true);
    expect(error).toBeNull();
  });

  it("un aborto lanzado como excepcion tampoco se reporta como fallo", async () => {
    const aborto = new Error("The user aborted a request.");
    aborto.name = "AbortError";
    dobles.cliente = crearCliente({
      "rpc:fn_buscar_pacientes": aborto,
      expedientes: { data: null, error: null },
    });

    const { error, cancelada } = await buscarPacientes({
      termino: "maria",
      signal: new AbortController().signal,
    });

    expect(cancelada).toBe(true);
    expect(error).toBeNull();
  });

  // El aborto llega con forma distinta segun quien lo lance: DOMException en el navegador,
  // code ABORT_ERR en Node, y PostgREST puede envolverlo dejando solo el mensaje.
  it.each([
    ["DOMException del navegador", { name: "AbortError", message: "signal is aborted" }],
    ["error de Node", { code: "ABORT_ERR", message: "This operation was aborted" }],
    ["solo el mensaje, envuelto por PostgREST", { message: "AbortError: The operation was aborted" }],
  ])("reconoce el aborto que llega como %s", async (_caso, errorDeAborto) => {
    dobles.cliente = crearCliente({
      "rpc:fn_buscar_pacientes": { data: null, error: errorDeAborto },
      expedientes: { data: null, error: null },
    });

    const { error, cancelada } = await buscarPacientes({
      termino: "maria",
      signal: new AbortController().signal,
    });

    expect(cancelada).toBe(true);
    expect(error).toBeNull();
  });

  it("un fallo real sigue siendo un fallo: cancelada en false y error presente", async () => {
    dobles.cliente = crearCliente({
      "rpc:fn_buscar_pacientes": { data: null, error: { code: "42501" } },
      expedientes: { data: null, error: null },
    });

    const { error, cancelada } = await buscarPacientes({
      termino: "maria",
      signal: new AbortController().signal,
    });

    expect(cancelada).toBe(false);
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.PERMISO_DENEGADO);
  });
});

// Condiciones cronicas en los resultados de busqueda (issue #535).
//
// La columna de chips que COLUMNAS_PACIENTE declara desde el PR #311 no tenia de donde leer: el
// PR #482 habia decidido omitir las condiciones del subconjunto de busqueda. Ahora viajan por los
// dos caminos que puede tomar un resultado -- la RPC por nombre y la sonda por numero de ficha --
// y en los dos "vigente" significa estado distinto de resuelta.
//
// Ningun dato real: los nombres y las fichas son inventados.
describe("condiciones cronicas en los resultados", () => {
  const filaDeRpc = (extra = {}) => ({
    paciente_id: "paciente-1",
    nombres: "Ana",
    apellidos: "Lopez",
    fecha_nacimiento: "2000-01-01",
    sexo: "Femenino",
    comunidad_id: "comunidad-1",
    comunidad_nombre: "Solola",
    numero_ficha: "F-010",
    relevancia: 0,
    pagina: 1,
    por_pagina: 20,
    total: 1,
    ...extra,
  });

  it("la busqueda por nombre entrega los nombres que devuelve la 00077", async () => {
    dobles.cliente = crearCliente({
      "rpc:fn_buscar_pacientes": {
        data: [filaDeRpc({ condiciones: ["Diabetes", "Hipertension"] })],
        error: null,
      },
      expedientes: { data: null, error: null },
    });

    const { pacientes } = await buscarPacientes({ comunidadId: "comunidad-1" });

    expect(pacientes[0].condiciones).toEqual(["Diabetes", "Hipertension"]);
  });

  it("un paciente sin condiciones trae un arreglo vacio, no null", async () => {
    dobles.cliente = crearCliente({
      "rpc:fn_buscar_pacientes": { data: [filaDeRpc({ condiciones: [] })], error: null },
      expedientes: { data: null, error: null },
    });

    const { pacientes } = await buscarPacientes({ comunidadId: "comunidad-1" });

    expect(pacientes[0].condiciones).toEqual([]);
  });

  it("contra una base sin la 00077 aplicada no rompe la fila: devuelve vacio", async () => {
    dobles.cliente = crearCliente({
      "rpc:fn_buscar_pacientes": { data: [filaDeRpc()], error: null },
      expedientes: { data: null, error: null },
    });

    const { pacientes } = await buscarPacientes({ comunidadId: "comunidad-1" });

    expect(pacientes[0].condiciones).toEqual([]);
  });

  it("la sonda por ficha pide las condiciones embebidas, no en una segunda consulta", async () => {
    const cliente = crearCliente({
      expedientes: { data: null, error: null },
    });
    dobles.cliente = cliente;

    await buscarPacientePorFicha("F-001");

    const select = cliente.llamadas.find((l) => l.paso === "select" && l.tabla === "expedientes");
    expect(select.columnas).toContain("padecimientos_cronicos(");
    expect(select.columnas).toContain("condiciones_cronicas(nombre)");
  });

  it("la sonda por ficha descarta las resueltas y conserva activa y controlada", async () => {
    dobles.cliente = crearCliente({
      expedientes: {
        data: {
          numeroFicha: "F-001",
          paciente: {
            id: "paciente-1",
            nombres: "Maria",
            fechaBaja: null,
            condicionesCronicas: [
              { estado: "resuelta", condicion: { nombre: "Desnutricion" } },
              { estado: "controlada", condicion: { nombre: "Asma" } },
              { estado: "activa", condicion: { nombre: "Diabetes" } },
            ],
          },
        },
        error: null,
      },
    });

    const { paciente } = await buscarPacientePorFicha("F-001");

    expect(paciente.condiciones).toEqual(["Asma", "Diabetes"]);
  });

  it("la sonda por ficha no deja escapar la forma cruda del embebido", async () => {
    dobles.cliente = crearCliente({
      expedientes: {
        data: {
          numeroFicha: "F-001",
          paciente: {
            id: "paciente-1",
            fechaBaja: null,
            condicionesCronicas: [{ estado: "activa", condicion: { nombre: "Asma" } }],
          },
        },
        error: null,
      },
    });

    const { paciente } = await buscarPacientePorFicha("F-001");

    expect(paciente).not.toHaveProperty("condicionesCronicas");
    expect(paciente).not.toHaveProperty("fechaBaja");
  });

  it("un padecimiento sin nombre de catalogo no cuela un hueco entre los chips", async () => {
    dobles.cliente = crearCliente({
      expedientes: {
        data: {
          numeroFicha: "F-001",
          paciente: {
            id: "paciente-1",
            fechaBaja: null,
            condicionesCronicas: [
              { estado: "activa", condicion: null },
              { estado: "activa", condicion: { nombre: "Epilepsia" } },
            ],
          },
        },
        error: null,
      },
    });

    const { paciente } = await buscarPacientePorFicha("F-001");

    expect(paciente.condiciones).toEqual(["Epilepsia"]);
  });

  it("un paciente sin padecimientos embebidos devuelve un arreglo vacio", async () => {
    dobles.cliente = crearCliente({
      expedientes: {
        data: { numeroFicha: "F-001", paciente: { id: "paciente-1", fechaBaja: null } },
        error: null,
      },
    });

    const { paciente } = await buscarPacientePorFicha("F-001");

    expect(paciente.condiciones).toEqual([]);
  });
});
