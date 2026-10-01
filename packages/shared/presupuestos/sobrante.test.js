// Pruebas del sobrante de una jornada (00160): la llamada a la base y las funciones puras del hook.

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

const { DESTINOS_DE_SOBRANTE, liquidarSobranteDeJornada, obtenerSobranteDeJornada } =
  await import("./sobrante.api.js");
const { armarDecisionesDeSobrante, opcionesDeDestinoDeSobrante } =
  await import("./useSobranteDeJornada.js");

function clienteRpc(respuesta) {
  const llamadas = [];
  return {
    llamadas,
    rpc: async (funcion, argumentos) => {
      llamadas.push({ funcion, argumentos });
      return respuesta;
    },
  };
}

beforeEach(() => {
  dobles.cliente = null;
});

describe("obtenerSobranteDeJornada", () => {
  it("convierte los NUMERIC que llegan como cadena", async () => {
    dobles.cliente = clienteRpc({
      data: [
        {
          origen_id: "o1",
          origen: "donacion",
          monto: "300.00",
          devuelto: "0",
          usado: "200.00",
          sobrante: "100.00",
        },
      ],
      error: null,
    });

    const { sobrantes, error } = await obtenerSobranteDeJornada("j1");

    expect(error).toBeNull();
    expect(sobrantes).toEqual([
      { origenId: "o1", origen: "donacion", monto: 300, devuelto: 0, usado: 200, sobrante: 100 },
    ]);
  });

  it("sin jornada no llama a la base", async () => {
    expect(await obtenerSobranteDeJornada(null)).toEqual({ sobrantes: [], error: null });
  });
});

describe("liquidarSobranteDeJornada", () => {
  it("manda la jornada destino solo al traspasar", async () => {
    dobles.cliente = clienteRpc({ data: 2, error: null });

    const { liquidados } = await liquidarSobranteDeJornada("j1", [
      { origenId: "o1", destino: DESTINOS_DE_SOBRANTE.TRASPASAR, jornadaDestinoId: "j2" },
      { origenId: "o2", destino: DESTINOS_DE_SOBRANTE.DEVOLVER, jornadaDestinoId: null },
    ]);

    expect(liquidados).toBe(2);
    expect(dobles.cliente.llamadas).toEqual([
      {
        funcion: "fn_liquidar_sobrante_de_jornada",
        argumentos: {
          p_jornada_id: "j1",
          p_decisiones: [
            { origen_id: "o1", destino: "traspasar", jornada_destino_id: "j2" },
            { origen_id: "o2", destino: "devolver" },
          ],
        },
      },
    ]);
  });

  it("sin decisiones no llama a la base", async () => {
    expect(await liquidarSobranteDeJornada("j1", [])).toEqual({ liquidados: 0, error: null });
  });
});

describe("opcionesDeDestinoDeSobrante", () => {
  it("dice a donde vuelve el dinero segun su origen", () => {
    expect(opcionesDeDestinoDeSobrante("donacion", false)).toEqual([
      { value: "devolver", label: "Devolver a la donación" },
    ]);
  });

  it("lo que no es de una donacion pasa a la caja (00168)", () => {
    for (const origen of ["fondos_propios", "aporte_externo", "sin_clasificar"]) {
      expect(opcionesDeDestinoDeSobrante(origen, false)).toEqual([
        { value: "devolver", label: "Pasar a la caja" },
      ]);
    }
    expect(opcionesDeDestinoDeSobrante("caja", false)[0].label).toBe("Devolver a la caja");
  });

  it("ofrece traspasar solo si hay otra jornada del proyecto que lo reciba", () => {
    expect(opcionesDeDestinoDeSobrante("fondos_propios", true).map((o) => o.value)).toEqual([
      "devolver",
      "traspasar",
    ]);
  });
});

describe("armarDecisionesDeSobrante", () => {
  const filas = [{ origenId: "o1" }, { origenId: "o2" }];

  it("sin eleccion, el sobrante se devuelve", () => {
    const { decisiones, errores } = armarDecisionesDeSobrante(filas, {});

    expect(errores).toEqual({});
    expect(decisiones.map((d) => d.destino)).toEqual(["devolver", "devolver"]);
  });

  it("traspasar sin jornada elegida es un error de ese aporte", () => {
    const { errores } = armarDecisionesDeSobrante(filas, {
      o2: { destino: "traspasar", jornadaDestinoId: null },
    });

    expect(errores).toEqual({ o2: "Elige la jornada que recibe el sobrante." });
  });
});
