// Pruebas del reporte de pacientes atendidos. Los datos son agregados e inventados: ninguna
// fila identifica a una persona, que es justamente lo que el reporte garantiza.

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
const {
  obtenerReportePacientesAtendidos,
  puedeVerReporteDePacientes,
  totalizar,
  AGRUPACIONES_DE_PACIENTES,
} = await import("./pacientes.api.js");

function crearCliente({ respuesta = { data: [], error: null } } = {}) {
  const llamadas = [];
  return {
    llamadas,
    rpc(nombre, parametros) {
      llamadas.push({ paso: "rpc", nombre, parametros });
      return respuesta instanceof Error ? Promise.reject(respuesta) : Promise.resolve(respuesta);
    },
  };
}

const FILAS = [
  {
    grupo_id: "jor-1",
    grupo: "Jornada Cabrican",
    pacientes: 30,
    nuevos: 18,
    recurrentes: 12,
    hombres: 12,
    mujeres: 18,
    menores: 8,
    adultos: 17,
    adultos_mayores: 5,
  },
  {
    grupo_id: "jor-2",
    grupo: "Jornada Zunil",
    pacientes: 20,
    nuevos: 5,
    recurrentes: 15,
    hombres: 9,
    mujeres: 11,
    menores: 4,
    adultos: 12,
    adultos_mayores: 4,
  },
];

beforeEach(() => {
  dobles.cliente = null;
});

describe("puedeVerReporteDePacientes", () => {
  it.each([
    [ROLES.ADMINISTRADOR, true],
    [ROLES.JUNTA_DIRECTIVA, true],
    [ROLES.MEDICO, false],
    [ROLES.VOLUNTARIO, false],
    [ROLES.SOCIO_FUNDADOR, false],
  ])("%s -> %s", (rol, esperado) => {
    expect(puedeVerReporteDePacientes(rol)).toBe(esperado);
  });
});

describe("totalizar", () => {
  it("suma los grupos en un unico total", () => {
    const grupos = FILAS.map((fila) => ({
      pacientes: fila.pacientes,
      nuevos: fila.nuevos,
      recurrentes: fila.recurrentes,
      porSexo: { hombres: fila.hombres, mujeres: fila.mujeres },
      porEdad: {
        menores: fila.menores,
        adultos: fila.adultos,
        adultosMayores: fila.adultos_mayores,
      },
    }));

    const total = totalizar(grupos);

    expect(total.pacientes).toBe(50);
    expect(total.nuevos).toBe(23);
    expect(total.recurrentes).toBe(27);
    expect(total.porSexo).toEqual({ hombres: 21, mujeres: 29 });
    expect(total.porEdad).toEqual({ menores: 12, adultos: 29, adultosMayores: 9 });
  });

  it("nuevos y recurrentes suman el total de pacientes", () => {
    const grupos = FILAS.map((fila) => ({
      pacientes: fila.pacientes,
      nuevos: fila.nuevos,
      recurrentes: fila.recurrentes,
      porSexo: { hombres: 0, mujeres: 0 },
      porEdad: { menores: 0, adultos: 0, adultosMayores: 0 },
    }));

    const total = totalizar(grupos);

    expect(total.nuevos + total.recurrentes).toBe(total.pacientes);
  });

  it("sin grupos devuelve todo en cero y no revienta", () => {
    const total = totalizar();

    expect(total.pacientes).toBe(0);
    expect(total.porEdad.adultos).toBe(0);
  });
});

describe("obtenerReportePacientesAtendidos", () => {
  it.each([ROLES.MEDICO, ROLES.VOLUNTARIO, ROLES.SOCIO_FUNDADOR])(
    "%s no puede consultarlo y ni siquiera gasta la llamada",
    async (rol) => {
      const cliente = crearCliente();
      dobles.cliente = cliente;

      const { grupos, totales, error } = await obtenerReportePacientesAtendidos({ rol });

      expect(grupos).toEqual([]);
      expect(totales).toBeNull();
      expect(error.codigo).toBe("SIN_PERMISO");
      expect(cliente.llamadas).toHaveLength(0);
    },
  );

  it("agrupa por jornada si no le dicen otra cosa", async () => {
    const cliente = crearCliente();
    dobles.cliente = cliente;

    await obtenerReportePacientesAtendidos({ rol: ROLES.ADMINISTRADOR });

    expect(cliente.llamadas[0].nombre).toBe("fn_reporte_pacientes_atendidos");
    expect(cliente.llamadas[0].parametros.p_agrupar_por).toBe(
      AGRUPACIONES_DE_PACIENTES.JORNADA,
    );
  });

  it.each([
    AGRUPACIONES_DE_PACIENTES.JORNADA,
    AGRUPACIONES_DE_PACIENTES.COMUNIDAD,
    AGRUPACIONES_DE_PACIENTES.PERIODO,
  ])("acepta la agrupacion %s", async (agruparPor) => {
    const cliente = crearCliente();
    dobles.cliente = cliente;

    await obtenerReportePacientesAtendidos({ rol: ROLES.ADMINISTRADOR, agruparPor });

    expect(cliente.llamadas[0].parametros.p_agrupar_por).toBe(agruparPor);
  });

  it("los filtros se combinan y viajan juntos", async () => {
    const cliente = crearCliente();
    dobles.cliente = cliente;

    await obtenerReportePacientesAtendidos({
      rol: ROLES.JUNTA_DIRECTIVA,
      jornada: "jor-1",
      comunidad: "com-1",
      desde: "2026-01-01",
      hasta: "2026-12-31",
    });

    expect(cliente.llamadas[0].parametros).toEqual({
      p_agrupar_por: "jornada",
      p_jornada_id: "jor-1",
      p_comunidad_id: "com-1",
      p_desde: "2026-01-01",
      p_hasta: "2026-12-31",
    });
  });

  it("los filtros vacios viajan como null, no como cadena vacia", async () => {
    const cliente = crearCliente();
    dobles.cliente = cliente;

    await obtenerReportePacientesAtendidos({ rol: ROLES.ADMINISTRADOR, jornada: "", desde: "" });

    expect(cliente.llamadas[0].parametros.p_jornada_id).toBeNull();
    expect(cliente.llamadas[0].parametros.p_desde).toBeNull();
  });

  it("traduce las filas al desglose que consume la pantalla", async () => {
    dobles.cliente = crearCliente({ respuesta: { data: FILAS, error: null } });

    const { grupos, error } = await obtenerReportePacientesAtendidos({
      rol: ROLES.ADMINISTRADOR,
    });

    expect(error).toBeNull();
    expect(grupos[0]).toEqual({
      id: "jor-1",
      nombre: "Jornada Cabrican",
      pacientes: 30,
      nuevos: 18,
      recurrentes: 12,
      porSexo: { hombres: 12, mujeres: 18 },
      porEdad: { menores: 8, adultos: 17, adultosMayores: 5 },
    });
  });

  it("devuelve los totales ya sumados junto a los grupos", async () => {
    dobles.cliente = crearCliente({ respuesta: { data: FILAS, error: null } });

    const { totales } = await obtenerReportePacientesAtendidos({ rol: ROLES.ADMINISTRADOR });

    expect(totales.pacientes).toBe(50);
    expect(totales.nuevos).toBe(23);
  });

  it("un periodo sin atenciones devuelve grupos vacios y totales en cero", async () => {
    dobles.cliente = crearCliente({ respuesta: { data: [], error: null } });

    const { grupos, totales, error } = await obtenerReportePacientesAtendidos({
      rol: ROLES.ADMINISTRADOR,
    });

    expect(grupos).toEqual([]);
    expect(totales.pacientes).toBe(0);
    expect(error).toBeNull();
  });

  it("sin rol no bloquea: deja que decida la guarda de la funcion", async () => {
    const cliente = crearCliente({ respuesta: { data: FILAS, error: null } });
    dobles.cliente = cliente;

    const { grupos } = await obtenerReportePacientesAtendidos({});

    expect(grupos).toHaveLength(2);
  });

  it("un rechazo de la funcion se normaliza", async () => {
    dobles.cliente = crearCliente({
      respuesta: { data: null, error: { code: "P0001", message: "Solo administracion" } },
    });

    const { grupos, totales, error } = await obtenerReportePacientesAtendidos({
      rol: ROLES.ADMINISTRADOR,
    });

    expect(grupos).toEqual([]);
    expect(totales).toBeNull();
    expect(error).not.toBeNull();
  });

  it("un fallo de red llega como excepcion y tambien se normaliza", async () => {
    dobles.cliente = crearCliente({ respuesta: new Error("Failed to fetch") });

    const { grupos, error } = await obtenerReportePacientesAtendidos({
      rol: ROLES.ADMINISTRADOR,
    });

    expect(grupos).toEqual([]);
    expect(error).not.toBeNull();
  });
});
