// Pruebas del resumen de cierre de una jornada (issue #183).
//
// obtenerResumenCierre() compone funciones de otros modulos que ya tienen sus propias pruebas
// (contarPacientesDeJornada, contarConsultasDeJornada, contarRecetasDeJornada,
// contarAtencionesIncompletas, listarMovimientos): aca se mockean esas funciones directamente en
// vez de un cliente de Supabase, para probar la composicion (que le pasa a cada una, como arma el
// resultado, y sobre todo el gateo por rol de pacientesAtendidos/atencionesIncompletas) sin repetir
// lo que esas pruebas ya cubren.

import { beforeEach, describe, expect, it, vi } from "vitest";

const dobles = vi.hoisted(() => ({
  contarPacientesDeJornada: vi.fn(),
  contarConsultasDeJornada: vi.fn(),
  contarRecetasDeJornada: vi.fn(),
  contarAtencionesIncompletas: vi.fn(),
  listarMovimientos: vi.fn(),
}));

vi.mock("../atenciones/api.js", () => ({
  contarPacientesDeJornada: dobles.contarPacientesDeJornada,
}));
vi.mock("../pacientes/consultas.api.js", () => ({
  contarConsultasDeJornada: dobles.contarConsultasDeJornada,
}));
vi.mock("../pacientes/recetas.api.js", () => ({
  contarRecetasDeJornada: dobles.contarRecetasDeJornada,
}));
vi.mock("../inventario/movimientos.api.js", () => ({
  listarMovimientos: dobles.listarMovimientos,
}));
vi.mock("./api.js", () => ({
  contarAtencionesIncompletas: dobles.contarAtencionesIncompletas,
}));

const { contarMovimientosPendientesDelBotiquin, hayAdvertenciasDeCierre, obtenerResumenCierre } =
  await import("./resumenCierre.js");
const { ROLES } = await import("../usuarios/roles.js");

beforeEach(() => {
  vi.clearAllMocks();
  dobles.contarPacientesDeJornada.mockResolvedValue({ cantidad: 0, error: null });
  dobles.contarConsultasDeJornada.mockResolvedValue({ cantidad: 0, error: null });
  dobles.contarRecetasDeJornada.mockResolvedValue({ cantidad: 0, error: null });
  dobles.contarAtencionesIncompletas.mockResolvedValue({ cantidad: 0, error: null });
  dobles.listarMovimientos.mockResolvedValue({ datos: [], error: null });
});

describe("contarMovimientosPendientesDelBotiquin", () => {
  it("no llama a listarMovimientos si la jornada no tiene botiquin asignado", async () => {
    const { cantidad, error } = await contarMovimientosPendientesDelBotiquin(null);

    expect(cantidad).toBe(0);
    expect(error).toBeNull();
    expect(dobles.listarMovimientos).not.toHaveBeenCalled();
  });

  it("filtra por bodega del botiquin y estado pendiente", async () => {
    dobles.listarMovimientos.mockResolvedValue({
      datos: [{ id: "m1" }, { id: "m2" }],
      error: null,
    });

    const { cantidad, error } = await contarMovimientosPendientesDelBotiquin("bodega-1");

    expect(cantidad).toBe(2);
    expect(error).toBeNull();
    expect(dobles.listarMovimientos).toHaveBeenCalledWith({
      estado: "pendiente",
      bodega_id: "bodega-1",
    });
  });

  it("un error de listarMovimientos se refleja sin inventar una cantidad", async () => {
    const errorEsperado = { mensaje: "fallo de red" };
    dobles.listarMovimientos.mockResolvedValue({ datos: [], error: errorEsperado });

    const { cantidad, error } = await contarMovimientosPendientesDelBotiquin("bodega-1");

    expect(cantidad).toBe(0);
    expect(error).toBe(errorEsperado);
  });
});

describe("obtenerResumenCierre", () => {
  it("sin jornadaId no llama a ningun modulo y devuelve la forma vacia, sin ceros inventados", async () => {
    const resumen = await obtenerResumenCierre(null);

    expect(resumen).toEqual({
      indicadores: {
        pacientesAtendidos: null,
        consultasRealizadas: null,
        tratamientosEntregados: null,
      },
      atencionesIncompletas: null,
      movimientosPendientes: 0,
      error: null,
    });
    expect(dobles.contarPacientesDeJornada).not.toHaveBeenCalled();
  });

  it("administrador ve los cinco numeros reales", async () => {
    dobles.contarPacientesDeJornada.mockResolvedValue({ cantidad: 12, error: null });
    dobles.contarConsultasDeJornada.mockResolvedValue({ cantidad: 9, error: null });
    dobles.contarRecetasDeJornada.mockResolvedValue({ cantidad: 7, error: null });
    dobles.contarAtencionesIncompletas.mockResolvedValue({ cantidad: 2, error: null });
    dobles.listarMovimientos.mockResolvedValue({ datos: [{ id: "m1" }], error: null });

    const resumen = await obtenerResumenCierre(
      { id: "jor-1", botiquinBodegaId: "bodega-1" },
      { rol: ROLES.ADMINISTRADOR },
    );

    expect(resumen).toEqual({
      indicadores: { pacientesAtendidos: 12, consultasRealizadas: 9, tratamientosEntregados: 7 },
      atencionesIncompletas: 2,
      movimientosPendientes: 1,
      error: null,
    });
    expect(dobles.contarPacientesDeJornada).toHaveBeenCalledWith("jor-1");
    expect(dobles.contarConsultasDeJornada).toHaveBeenCalledWith("jor-1", {
      rol: ROLES.ADMINISTRADOR,
    });
    expect(dobles.contarRecetasDeJornada).toHaveBeenCalledWith("jor-1", {
      rol: ROLES.ADMINISTRADOR,
    });
    expect(dobles.contarAtencionesIncompletas).toHaveBeenCalledWith("jor-1");
    expect(dobles.listarMovimientos).toHaveBeenCalledWith({
      estado: "pendiente",
      bodega_id: "bodega-1",
    });
  });

  it("medico ve pacientesAtendidos y atencionesIncompletas reales, igual que administrador", async () => {
    dobles.contarPacientesDeJornada.mockResolvedValue({ cantidad: 5, error: null });
    dobles.contarAtencionesIncompletas.mockResolvedValue({ cantidad: 1, error: null });

    const resumen = await obtenerResumenCierre({ id: "jor-1" }, { rol: ROLES.MEDICO });

    expect(resumen.indicadores.pacientesAtendidos).toBe(5);
    expect(resumen.atencionesIncompletas).toBe(1);
    expect(dobles.contarPacientesDeJornada).toHaveBeenCalledWith("jor-1");
    expect(dobles.contarAtencionesIncompletas).toHaveBeenCalledWith("jor-1");
  });

  it("voluntario ve pacientesAtendidos real (esta en la politica de atenciones) pero atencionesIncompletas en null (no en consultas)", async () => {
    dobles.contarPacientesDeJornada.mockResolvedValue({ cantidad: 8, error: null });

    const resumen = await obtenerResumenCierre({ id: "jor-1" }, { rol: ROLES.VOLUNTARIO });

    expect(resumen.indicadores.pacientesAtendidos).toBe(8);
    expect(resumen.atencionesIncompletas).toBeNull();
    expect(dobles.contarPacientesDeJornada).toHaveBeenCalledWith("jor-1");
    expect(dobles.contarAtencionesIncompletas).not.toHaveBeenCalled();
  });

  it("junta directiva no tiene SELECT sobre atenciones ni consultas: pacientesAtendidos y atencionesIncompletas quedan en null, nunca en 0 falso", async () => {
    const resumen = await obtenerResumenCierre({ id: "jor-1" }, { rol: ROLES.JUNTA_DIRECTIVA });

    expect(resumen.indicadores.pacientesAtendidos).toBeNull();
    expect(resumen.atencionesIncompletas).toBeNull();
    expect(dobles.contarPacientesDeJornada).not.toHaveBeenCalled();
    expect(dobles.contarAtencionesIncompletas).not.toHaveBeenCalled();
  });

  it("socio fundador tampoco: mismo tratamiento que junta directiva", async () => {
    const resumen = await obtenerResumenCierre({ id: "jor-1" }, { rol: ROLES.SOCIO_FUNDADOR });

    expect(resumen.indicadores.pacientesAtendidos).toBeNull();
    expect(resumen.atencionesIncompletas).toBeNull();
  });

  it("una jornada sin botiquin no cuenta movimientos pendientes", async () => {
    const resumen = await obtenerResumenCierre({ id: "jor-1", botiquinBodegaId: null });

    expect(resumen.movimientosPendientes).toBe(0);
    expect(dobles.listarMovimientos).not.toHaveBeenCalled();
  });

  it("un rol sin permiso sobre datos clinicos deja consultas/recetas en null, no en cero", async () => {
    dobles.contarConsultasDeJornada.mockResolvedValue({ cantidad: null, error: null });
    dobles.contarRecetasDeJornada.mockResolvedValue({ cantidad: null, error: null });

    const resumen = await obtenerResumenCierre(
      { id: "jor-1", botiquinBodegaId: null },
      { rol: ROLES.VOLUNTARIO },
    );

    expect(resumen.indicadores.consultasRealizadas).toBeNull();
    expect(resumen.indicadores.tratamientosEntregados).toBeNull();
  });

  it("propaga el primer error que ocurra, sin dejar de devolver lo que si se pudo calcular", async () => {
    const errorEsperado = { mensaje: "fallo de red" };
    dobles.contarConsultasDeJornada.mockResolvedValue({ cantidad: null, error: errorEsperado });

    const resumen = await obtenerResumenCierre({ id: "jor-1" }, { rol: ROLES.ADMINISTRADOR });

    expect(resumen.error).toBe(errorEsperado);
    expect(resumen.indicadores.pacientesAtendidos).toBe(0);
  });
});

describe("hayAdvertenciasDeCierre", () => {
  it("false cuando no hay atenciones incompletas ni movimientos pendientes", () => {
    expect(hayAdvertenciasDeCierre({ atencionesIncompletas: 0, movimientosPendientes: 0 })).toBe(
      false,
    );
  });

  it("true si hay atenciones incompletas", () => {
    expect(hayAdvertenciasDeCierre({ atencionesIncompletas: 1, movimientosPendientes: 0 })).toBe(
      true,
    );
  });

  it("true si hay movimientos pendientes", () => {
    expect(hayAdvertenciasDeCierre({ atencionesIncompletas: 0, movimientosPendientes: 3 })).toBe(
      true,
    );
  });

  it("atencionesIncompletas en null (sin dato) no cuenta como advertencia", () => {
    expect(hayAdvertenciasDeCierre({ atencionesIncompletas: null, movimientosPendientes: 0 })).toBe(
      false,
    );
  });

  it("un resumen vacio no advierte nada", () => {
    expect(hayAdvertenciasDeCierre(undefined)).toBe(false);
    expect(hayAdvertenciasDeCierre({})).toBe(false);
  });
});
