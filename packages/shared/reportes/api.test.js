// Pruebas de los indicadores de impacto (issue #205).
//
// La version anterior de api.js no tenia pruebas, y por eso nadie noto que consultaba una vista
// inexistente. Varios casos de aqui afirman explicitamente contra que vista y que columnas se
// consulta, para que un rename en el esquema rompa la prueba y no la pantalla.
//
// Mismo patron de mock que inventario/lotes.api.test.js: un doble de obtenerSupabase() que
// registra cada paso de la cadena. No hay Supabase real ni red.
//
// Ningun dato real: las jornadas y comunidades son inventadas, y la vista solo entrega conteos.

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
const { AGRUPACIONES_DE_IMPACTO, obtenerIndicadoresImpacto, puedeVerIndicadoresDeImpacto } =
  await import("./api.js");

function crearCliente(respuestas) {
  const llamadas = [];
  const cola = [...respuestas];

  function crearEncadenable() {
    const respuesta = cola.shift() ?? { data: [], error: null };
    const resolver = async () => respuesta;

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
      order(columna, opciones) {
        llamadas.push({ paso: "order", columna, opciones });
        return encadenable;
      },
      then(resolve, reject) {
        return resolver().then(resolve, reject);
      },
    };

    return encadenable;
  }

  return {
    llamadas,
    from(tabla) {
      llamadas.push({ paso: "from", tabla });
      return crearEncadenable();
    },
  };
}

// Dos jornadas del mismo proyecto en la misma comunidad, y una tercera en otra comunidad sin
// proyecto. Sirve para comprobar que comunidades_beneficiadas cuenta comunidades distintas y no
// jornadas.
const FILAS = [
  {
    jornada_id: "j-1",
    jornada: "Jornada enero",
    fecha: "2026-01-10",
    comunidad_id: "c-1",
    comunidad: "Santa Cruz",
    proyecto_id: "p-1",
    proyecto: "Salud rural",
    pacientes_atendidos: 30,
    consultas_realizadas: 34,
    tratamientos_entregados: 12,
    medicamentos_utilizados: 100,
  },
  {
    jornada_id: "j-2",
    jornada: "Jornada febrero",
    fecha: "2026-02-14",
    comunidad_id: "c-1",
    comunidad: "Santa Cruz",
    proyecto_id: "p-1",
    proyecto: "Salud rural",
    pacientes_atendidos: 20,
    consultas_realizadas: 22,
    tratamientos_entregados: 8,
    medicamentos_utilizados: 60,
  },
  {
    jornada_id: "j-3",
    jornada: "Jornada suelta",
    fecha: "2026-02-20",
    comunidad_id: "c-2",
    comunidad: "Chichicastenango",
    proyecto_id: null,
    proyecto: null,
    pacientes_atendidos: 10,
    consultas_realizadas: 11,
    tratamientos_entregados: 5,
    medicamentos_utilizados: 40,
  },
];

beforeEach(() => {
  dobles.cliente = null;
});

describe("puedeVerIndicadoresDeImpacto", () => {
  it("deja pasar a administrador y a los roles consultivos", () => {
    expect(puedeVerIndicadoresDeImpacto(ROLES.ADMINISTRADOR)).toBe(true);
    expect(puedeVerIndicadoresDeImpacto(ROLES.JUNTA_DIRECTIVA)).toBe(true);
    expect(puedeVerIndicadoresDeImpacto(ROLES.SOCIO_FUNDADOR)).toBe(true);
  });

  it("no deja pasar a los roles de campo", () => {
    expect(puedeVerIndicadoresDeImpacto(ROLES.MEDICO)).toBe(false);
    expect(puedeVerIndicadoresDeImpacto(ROLES.VOLUNTARIO)).toBe(false);
  });

  it("reconoce junta directiva con el valor del enum, que lleva espacio", () => {
    // La version anterior comparaba contra "junta_directiva" con guion bajo, asi que este rol
    // nunca pasaba el chequeo.
    expect(ROLES.JUNTA_DIRECTIVA).toBe("junta directiva");
    expect(puedeVerIndicadoresDeImpacto("junta_directiva")).toBe(false);
  });
});

describe("obtenerIndicadoresImpacto", () => {
  it("rechaza un rol sin permiso sin llamar al cliente", async () => {
    const { indicadores, error } = await obtenerIndicadoresImpacto({ rol: ROLES.MEDICO });

    expect(indicadores).toBeNull();
    expect(error.codigo).toBe("SIN_PERMISO");
  });

  it("consulta vista_reporte_impacto y no una vista inexistente", async () => {
    dobles.cliente = crearCliente([{ data: FILAS, error: null }]);

    await obtenerIndicadoresImpacto({ rol: ROLES.ADMINISTRADOR });

    expect(dobles.cliente.llamadas[0]).toEqual({ paso: "from", tabla: "vista_reporte_impacto" });
  });

  it("no pide columnas que la vista no tiene", async () => {
    dobles.cliente = crearCliente([{ data: FILAS, error: null }]);

    await obtenerIndicadoresImpacto({ rol: ROLES.ADMINISTRADOR });

    const columnas = dobles.cliente.llamadas.find((l) => l.paso === "select").columnas;
    // Las dos que pedia la version anterior y que no existen en el esquema.
    expect(columnas).not.toContain("comunidades_beneficiadas");
    expect(columnas).not.toContain("mes");
    expect(columnas).toContain("proyecto_id");
  });

  it("suma los indicadores y cuenta comunidades distintas, no jornadas", async () => {
    dobles.cliente = crearCliente([{ data: FILAS, error: null }]);

    const { indicadores } = await obtenerIndicadoresImpacto({ rol: ROLES.ADMINISTRADOR });

    expect(indicadores.totales).toEqual({
      pacientes_atendidos: 60,
      // La vista ya calculaba consultas_realizadas y no la leia nadie: la issue #693 la sumo a
      // COLUMNAS_DEL_REPORTE y a INDICADORES en vez de retirarla de la vista con una migracion.
      consultas_realizadas: 67,
      tratamientos_entregados: 25,
      medicamentos_utilizados: 200,
      // Tres jornadas pero dos comunidades.
      comunidades_beneficiadas: 2,
    });
  });

  it("agrupa por mes derivando el mes de la fecha", async () => {
    dobles.cliente = crearCliente([{ data: FILAS, error: null }]);

    const { indicadores } = await obtenerIndicadoresImpacto({
      rol: ROLES.JUNTA_DIRECTIVA,
      agruparPor: AGRUPACIONES_DE_IMPACTO.MES,
    });

    expect(indicadores.agrupados.map((g) => g.clave)).toEqual(["2026-01", "2026-02"]);
    expect(indicadores.agrupados[1].pacientes_atendidos).toBe(30);
  });

  it("agrupa por proyecto y etiqueta las jornadas sin proyecto", async () => {
    dobles.cliente = crearCliente([{ data: FILAS, error: null }]);

    const { indicadores } = await obtenerIndicadoresImpacto({
      rol: ROLES.ADMINISTRADOR,
      agruparPor: AGRUPACIONES_DE_IMPACTO.PROYECTO,
    });

    expect(indicadores.agrupados).toHaveLength(2);
    expect(indicadores.agrupados[1]).toMatchObject({
      clave: "sin_proyecto",
      etiqueta: "Sin proyecto",
      pacientes_atendidos: 10,
    });
  });

  it("agrupa por comunidad usando el id como clave y el nombre como etiqueta", async () => {
    dobles.cliente = crearCliente([{ data: FILAS, error: null }]);

    const { indicadores } = await obtenerIndicadoresImpacto({
      rol: ROLES.ADMINISTRADOR,
      agruparPor: AGRUPACIONES_DE_IMPACTO.COMUNIDAD,
    });

    expect(indicadores.agrupados[0]).toMatchObject({
      clave: "c-1",
      etiqueta: "Santa Cruz",
      pacientes_atendidos: 50,
    });
  });

  it("aplica el rango de fechas sobre la columna fecha", async () => {
    dobles.cliente = crearCliente([{ data: FILAS, error: null }]);

    await obtenerIndicadoresImpacto({
      rol: ROLES.ADMINISTRADOR,
      periodo: { fechaInicio: "2026-01-01", fechaFin: "2026-03-31" },
    });

    expect(dobles.cliente.llamadas).toContainEqual({
      paso: "gte",
      columna: "fecha",
      valor: "2026-01-01",
    });
    expect(dobles.cliente.llamadas).toContainEqual({
      paso: "lte",
      columna: "fecha",
      valor: "2026-03-31",
    });
  });

  it("compara dos periodos y calcula la variacion", async () => {
    dobles.cliente = crearCliente([
      { data: FILAS, error: null },
      { data: [FILAS[0]], error: null },
    ]);

    const { indicadores } = await obtenerIndicadoresImpacto({
      rol: ROLES.ADMINISTRADOR,
      periodo: { fechaInicio: "2026-01-01" },
      periodoComparacion: { fechaInicio: "2025-01-01" },
    });

    expect(indicadores.comparacion.totales.pacientes_atendidos).toBe(30);
    expect(indicadores.comparacion.variacion.pacientes_atendidos).toEqual({
      actual: 60,
      anterior: 30,
      diferencia: 30,
      porcentaje: 100,
    });
  });

  it("devuelve el error en su campo y no en lugar del resultado", async () => {
    dobles.cliente = crearCliente([{ data: null, error: { code: "42501", message: "denegado" } }]);

    const resultado = await obtenerIndicadoresImpacto({ rol: ROLES.ADMINISTRADOR });

    // La version anterior devolvia normalizarError(error) suelto, sin los dos campos.
    expect(resultado).toHaveProperty("indicadores", null);
    expect(resultado.error).not.toBeNull();
  });
});
