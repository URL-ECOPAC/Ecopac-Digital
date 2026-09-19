// Prueba de la logica pura del hook de gestion de lotes.
//
// No se monta el hook: packages/shared corre vitest con environment "node", sin DOM (ver
// vitest.config.js). Antes de la issue #709, InventarioPage.jsx nunca llamaba a registrarLote()
// (lotes.api.js): el boton de alta de lote no guardaba nada. Esta prueba cubre la traduccion que
// handleGuardarLote() ahora usa para llamar a registrarLote(), con exactamente los argumentos
// camelCase que esa funcion declara (aColumnasDeTabla() los traduce a columnas snake_case).

import { describe, expect, it } from "vitest";

import { conZonaHorariaDeGuatemala } from "../pruebas/zonaHoraria.js";
import {
  calcularAlertaDeLote,
  datosLoteParaRegistrar,
  procesarLotes,
  validarDatosDeLote,
} from "./useGestionLotes.js";

// Issue #840 (B1): el formulario usa los ids de CAMPOS_LOTE, que son los argumentos de
// registrarLote(). Antes eran snake_case propios del modal y habia que traducirlos.
const VALORES = {
  medicamento: "med-1",
  numeroLote: "L-002",
  proveedor: "prov-1",
  origen: "compra",
  cantidadIngresada: "50",
  fechaIngreso: "2026-09-01",
  fechaVencimiento: "2027-09-01",
  costoUnitario: "",
};

describe("datosLoteParaRegistrar", () => {
  it("entrega los argumentos de registrarLote, con la cantidad como numero", () => {
    expect(datosLoteParaRegistrar(VALORES)).toEqual({
      medicamento: "med-1",
      numeroLote: "L-002",
      proveedor: "prov-1",
      origen: "compra",
      cantidadIngresada: 50,
      fechaIngreso: "2026-09-01",
      fechaVencimiento: "2027-09-01",
    });
  });

  it("sin costo unitario, no incluye costoUnitario (issue #752)", () => {
    expect(datosLoteParaRegistrar(VALORES)).not.toHaveProperty("costoUnitario");
  });

  it("con costo unitario, lo entrega como numero (issue #752)", () => {
    expect(datosLoteParaRegistrar({ ...VALORES, costoUnitario: "8.5" }).costoUnitario).toBe(8.5);
  });

  it("sin fecha de ingreso no la manda: la pone la base (DEFAULT CURRENT_DATE)", () => {
    expect(datosLoteParaRegistrar({ ...VALORES, fechaIngreso: "" })).not.toHaveProperty(
      "fechaIngreso",
    );
  });
});

describe("validarDatosDeLote", () => {
  it("acepta datos completos y validos", () => {
    expect(validarDatosDeLote(VALORES)).toEqual({});
  });

  it("rechaza una cantidad de 0, en el campo de la cantidad", () => {
    expect(validarDatosDeLote({ ...VALORES, cantidadIngresada: "0" })).toHaveProperty(
      "cantidadIngresada",
    );
  });

  it("marca el campo obligatorio que falta, no un mensaje general", () => {
    expect(Object.keys(validarDatosDeLote({ ...VALORES, proveedor: "" }))).toEqual(["proveedor"]);
  });

  it("ya no pide bodega: registrarLote() nunca la guardaba", () => {
    expect(validarDatosDeLote(VALORES)).not.toHaveProperty("bodega");
  });

  it("la fecha de ingreso es opcional", () => {
    expect(validarDatosDeLote({ ...VALORES, fechaIngreso: "" })).toEqual({});
  });

  // 00096: el CHECK es >=. El cliente seguia con la regla estricta y rechazaba lo que la base acepta.
  it("acepta un lote que vence el mismo dia que ingresa", () => {
    expect(
      validarDatosDeLote({
        ...VALORES,
        fechaIngreso: "2027-09-01",
        fechaVencimiento: "2027-09-01",
      }),
    ).toEqual({});
  });

  it("rechaza una fecha de vencimiento anterior a la de ingreso", () => {
    expect(
      validarDatosDeLote({
        ...VALORES,
        fechaIngreso: "2027-09-02",
        fechaVencimiento: "2027-09-01",
      }),
    ).toHaveProperty("fechaVencimiento");
  });
});

describe("calcularAlertaDeLote", () => {
  const HOY = new Date("2026-06-15T10:30:00");

  it("un lote que vence hoy da diasRestantes 0 y estado danger", () => {
    expect(calcularAlertaDeLote("2026-06-15", HOY)).toEqual({
      diasRestantes: 0,
      estadoAlerta: "danger",
    });
  });

  it("un lote ya vencido da estado danger", () => {
    expect(calcularAlertaDeLote("2026-06-14", HOY).estadoAlerta).toBe("danger");
  });

  it("dentro de 30 dias da estado warning", () => {
    expect(calcularAlertaDeLote("2026-07-15", HOY).estadoAlerta).toBe("warning");
  });

  it("a mas de 30 dias da estado normal", () => {
    expect(calcularAlertaDeLote("2026-08-01", HOY).estadoAlerta).toBe("normal");
  });

  it("la hora del dia no mueve el corte: casi medianoche sigue siendo el mismo dia de calendario", () => {
    const casiMedianoche = new Date("2026-06-15T23:59:59");
    expect(calcularAlertaDeLote("2026-06-15", casiMedianoche).diasRestantes).toBe(0);
  });

  it("sin fecha de vencimiento no calcula dias, y queda en estado normal por defecto", () => {
    expect(calcularAlertaDeLote(null, HOY)).toEqual({
      diasRestantes: null,
      estadoAlerta: "normal",
    });
  });

  describe("el borde de las 18:00 en Guatemala (issue #725)", () => {
    conZonaHorariaDeGuatemala();

    it("un lote que vence hoy sigue dando diasRestantes 0 entrada la noche local", () => {
      // 15 de junio de 2026, 20:00 en Guatemala (UTC-6) = 16 de junio, 02:00 UTC. El bug que
      // corrigio esta issue restaba `new Date(fecha_vencimiento) - new Date()` a mano: la
      // medianoche UTC del lote (00:00Z) ya habia pasado respecto de las 02:00Z de esta hora,
      // asi que un lote que vencia hoy podia salir con dias fraccionarios o negativos.
      const hoyDeNoche = new Date("2026-06-16T02:00:00Z");
      expect(calcularAlertaDeLote("2026-06-15", hoyDeNoche)).toEqual({
        diasRestantes: 0,
        estadoAlerta: "danger",
      });
    });
  });
});

describe("procesarLotes", () => {
  const HOY = new Date("2026-06-15T10:30:00");

  // La forma real de aLote() (lotes.api.js): fechaVencimiento y numeroLote en camelCase,
  // medicamento ya es el nombre (una cadena, no un objeto). Probar con esta forma -y no con un
  // lote inventado en snake_case- es lo que hubiera atrapado el bug encontrado auditando el fix
  // de #725 en el navegador: diasRestantes/estadoAlerta salian siempre null/"normal" contra los
  // datos que listarLotes() de verdad entrega.
  function loteDeALote(datos) {
    return {
      id: "lote-1",
      medicamento: "Ciprofloxacino",
      numeroLote: "L-001",
      fechaVencimiento: "2026-07-01",
      existencias: undefined,
      ...datos,
    };
  }

  it("calcula diasRestantes/estadoAlerta leyendo fechaVencimiento (camelCase), no fecha_vencimiento", () => {
    const [lote] = procesarLotes([loteDeALote({ fechaVencimiento: "2026-06-15" })], {}, HOY);

    expect(lote.diasRestantes).toBe(0);
    expect(lote.estadoAlerta).toBe("danger");
  });

  it("la busqueda encuentra por el nombre del medicamento (una cadena) y por numeroLote", () => {
    const lotes = [
      loteDeALote({ id: "l1", medicamento: "Ciprofloxacino", numeroLote: "L-001" }),
      loteDeALote({ id: "l2", medicamento: "Amoxicilina", numeroLote: "L-002" }),
    ];

    expect(procesarLotes(lotes, { busqueda: "cipro" }, HOY).map((l) => l.id)).toEqual(["l1"]);
    expect(procesarLotes(lotes, { busqueda: "l-002" }, HOY).map((l) => l.id)).toEqual(["l2"]);
  });

  it("ordena FEFO por fechaVencimiento, el mas proximo a vencer primero", () => {
    const lotes = [
      loteDeALote({ id: "tarde", fechaVencimiento: "2026-12-01" }),
      loteDeALote({ id: "pronto", fechaVencimiento: "2026-06-20" }),
    ];

    expect(procesarLotes(lotes, {}, HOY).map((l) => l.id)).toEqual(["pronto", "tarde"]);
  });

  it("sin busqueda ni filtros, con los valores por defecto del hook, no descarta ningun lote", () => {
    const lotes = [loteDeALote({ id: "l1" }), loteDeALote({ id: "l2" })];

    expect(procesarLotes(lotes, undefined, HOY)).toHaveLength(2);
  });
});
