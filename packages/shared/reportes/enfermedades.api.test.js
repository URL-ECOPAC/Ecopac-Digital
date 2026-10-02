// Pruebas del reporte de enfermedades (issue #916). Los datos son conteos agregados e inventados:
// ninguna fila identifica a una persona, que es lo que la funcion de la base garantiza.

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
  CIFRA_PROTEGIDA,
  COMUNIDAD_DE,
  UMBRAL_DE_CONTEO,
  VISTAS_DE_ENFERMEDADES,
  obtenerOpcionesReporteEnfermedades,
  obtenerReporteEnfermedades,
} = await import("./enfermedades.api.js");

function crearCliente({ respuesta = { data: [], error: null } } = {}) {
  const llamadas = [];
  return {
    llamadas,
    rpc(nombre, parametros) {
      llamadas.push({ nombre, parametros });
      return respuesta instanceof Error ? Promise.reject(respuesta) : Promise.resolve(respuesta);
    },
  };
}

const FILA = {
  grupo_id: "todo",
  grupo: "Todo el período",
  grupo_fecha: null,
  diagnostico_id: "dx-1",
  codigo: "J06.9",
  diagnostico: "Infección respiratoria aguda",
  orden_diagnostico: 1,
  casos: 12,
  suprimido: false,
  hombres: 5,
  mujeres: 7,
  menores: null,
  adultos: 9,
  adultos_mayores: 0,
};

beforeEach(() => {
  dobles.cliente = null;
});

describe("obtenerReporteEnfermedades", () => {
  it("no llama a la base si el rol no consulta reportes", async () => {
    const resultado = await obtenerReporteEnfermedades({ rol: ROLES.MEDICO });

    expect(resultado.casos).toEqual([]);
    expect(resultado.error.codigo).toBe("SIN_PERMISO");
  });

  it("rechaza una vista desconocida sin llamar a la base", async () => {
    const resultado = await obtenerReporteEnfermedades({
      rol: ROLES.ADMINISTRADOR,
      vista: "por_sintoma",
    });

    expect(resultado.error.codigo).toBe("VALOR_INVALIDO");
  });

  it("traduce la vista y los filtros a los parametros de la funcion", async () => {
    dobles.cliente = crearCliente();

    await obtenerReporteEnfermedades({
      rol: ROLES.JUNTA_DIRECTIVA,
      vista: VISTAS_DE_ENFERMEDADES.EVOLUCION,
      desde: "2026-01-01",
      hasta: "2026-06-30",
      jornadas: ["jor-1", "jor-2"],
      municipio: "101",
      proyecto: "pro-1",
      soloPrincipales: false,
      comunidadDe: COMUNIDAD_DE.PACIENTE,
    });

    expect(dobles.cliente.llamadas).toEqual([
      {
        nombre: "fn_reporte_enfermedades",
        parametros: {
          p_agrupar_por: "mes",
          p_desde: "2026-01-01",
          p_hasta: "2026-06-30",
          p_jornada_ids: ["jor-1", "jor-2"],
          p_comunidad_ids: null,
          p_municipio_id: 101,
          p_departamento_id: null,
          p_proyecto_id: "pro-1",
          p_diagnostico_id: null,
          p_solo_principales: false,
          p_comunidad_de: "paciente",
        },
      },
    ]);
  });

  it("por defecto pide el ranking de diagnosticos principales por comunidad de la jornada", async () => {
    dobles.cliente = crearCliente();

    await obtenerReporteEnfermedades({ rol: ROLES.ADMINISTRADOR });

    const { parametros } = dobles.cliente.llamadas[0];
    expect(parametros.p_agrupar_por).toBe("ninguno");
    expect(parametros.p_solo_principales).toBe(true);
    expect(parametros.p_comunidad_de).toBe("jornada");
  });

  it("devuelve los casos con nombres de JS y conserva el NULL de una cifra suprimida", async () => {
    dobles.cliente = crearCliente({ respuesta: { data: [FILA], error: null } });

    const { casos, error } = await obtenerReporteEnfermedades({ rol: ROLES.SOCIO_FUNDADOR });

    expect(error).toBeNull();
    expect(casos).toEqual([
      {
        grupoId: "todo",
        grupo: "Todo el período",
        grupoFecha: null,
        diagnosticoId: "dx-1",
        codigo: "J06.9",
        diagnostico: "Infección respiratoria aguda",
        orden: 1,
        casos: 12,
        suprimido: false,
        hombres: 5,
        mujeres: 7,
        menores: null,
        adultos: 9,
        adultosMayores: 0,
      },
    ]);
  });

  it("normaliza el error de la base", async () => {
    dobles.cliente = crearCliente({
      respuesta: { data: null, error: { code: "42501", message: "permiso denegado" } },
    });

    const { casos, error } = await obtenerReporteEnfermedades({ rol: ROLES.ADMINISTRADOR });

    expect(casos).toEqual([]);
    expect(error).not.toBeNull();
  });

  it("una excepcion de red no revienta: vuelve como error", async () => {
    dobles.cliente = crearCliente({ respuesta: new Error("sin red") });

    const { casos, error } = await obtenerReporteEnfermedades({ rol: ROLES.ADMINISTRADOR });

    expect(casos).toEqual([]);
    expect(error).not.toBeNull();
  });
});

describe("obtenerOpcionesReporteEnfermedades", () => {
  it("entrega las tres listas de la funcion", async () => {
    dobles.cliente = crearCliente({
      respuesta: {
        data: {
          jornadas: [{ id: "jor-1", nombre: "Jornada 1", fecha: "2026-03-01", comunidad: "A" }],
          proyectos: [{ id: "pro-1", nombre: "Proyecto 1" }],
          diagnosticos: [{ id: "dx-1", codigo: "J06.9", nombre: "IRA" }],
        },
        error: null,
      },
    });

    const { opciones, error } = await obtenerOpcionesReporteEnfermedades({
      rol: ROLES.JUNTA_DIRECTIVA,
    });

    expect(error).toBeNull();
    expect(dobles.cliente.llamadas[0].nombre).toBe("fn_opciones_reporte_enfermedades");
    expect(opciones.jornadas).toHaveLength(1);
    expect(opciones.proyectos).toHaveLength(1);
    expect(opciones.diagnosticos).toHaveLength(1);
  });

  it("sin permiso devuelve listas vacias y el error, sin llamar", async () => {
    const { opciones, error } = await obtenerOpcionesReporteEnfermedades({
      rol: ROLES.VOLUNTARIO,
    });

    expect(opciones).toEqual({ jornadas: [], proyectos: [], diagnosticos: [] });
    expect(error.codigo).toBe("SIN_PERMISO");
  });
});

describe("umbral de privacidad", () => {
  it("la cifra protegida dice el mismo umbral que aplica la base (00177)", () => {
    expect(UMBRAL_DE_CONTEO).toBe(5);
    expect(CIFRA_PROTEGIDA).toBe("< 5");
  });
});
