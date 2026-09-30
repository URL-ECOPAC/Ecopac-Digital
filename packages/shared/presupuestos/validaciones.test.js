// Pruebas de las reglas de negocio de gastos (issue #296).
//
// La version anterior de estas pruebas pasaba en verde con datos que la base rechaza: usaba
// `categoria_id` y `fecha_gasto` (las columnas son `categoria` y `fecha`) y una lista de
// categorias inventada -['insumos', 'transporte', 'alimentacion']- que no esta en el enum
// categoria_gasto de 00025_presupuesto_gastos.sql. Cada caso de aqui usa las columnas y los
// valores reales.

import { describe, expect, it } from "vitest";

import { ORIGENES_DE_PRESUPUESTO } from "../enums.js";
import { aCadenaFechaLocal } from "../formato/fechas.js";
import { conZonaHorariaDeGuatemala } from "../pruebas/zonaHoraria.js";
import { validarGasto, validarOrigenDePresupuesto } from "./validaciones.js";

// Issue #840, bloque D: el presupuesto de una jornada se forma con aportes de origen conocido.
describe("validarOrigenDePresupuesto", () => {
  it("acepta un aporte de fondos propios", () => {
    expect(
      validarOrigenDePresupuesto({ origen: ORIGENES_DE_PRESUPUESTO.FONDOS_PROPIOS, monto: "300" }),
    ).toEqual({});
  });

  it("exige el origen, y no deja registrar uno sin clasificar a mano", () => {
    expect(validarOrigenDePresupuesto({ monto: 10 }).origen).toBeTruthy();
    expect(
      validarOrigenDePresupuesto({ origen: ORIGENES_DE_PRESUPUESTO.SIN_CLASIFICAR, monto: 10 })
        .origen,
    ).toBeTruthy();
  });

  it.each([[""], [null], ["abc"], [0], [-1]])("rechaza el monto %s", (monto) => {
    expect(
      validarOrigenDePresupuesto({ origen: ORIGENES_DE_PRESUPUESTO.APORTE_EXTERNO, monto }).monto,
    ).toBeTruthy();
  });

  it("un aporte de donacion exige elegir la donacion", () => {
    expect(
      validarOrigenDePresupuesto({ origen: ORIGENES_DE_PRESUPUESTO.DONACION, monto: 10 })
        .donacionId,
    ).toBeTruthy();
  });

  it("no deja asignar de una donacion mas de lo que le queda", () => {
    const errores = validarOrigenDePresupuesto(
      { origen: ORIGENES_DE_PRESUPUESTO.DONACION, donacionId: "d1", monto: 301 },
      { disponibleDeDonacion: 300 },
    );
    expect(errores.monto).toMatch(/300/);
  });

  it("acepta exactamente lo que le queda a la donacion", () => {
    expect(
      validarOrigenDePresupuesto(
        { origen: ORIGENES_DE_PRESUPUESTO.DONACION, donacionId: "d1", monto: 300 },
        { disponibleDeDonacion: 300 },
      ),
    ).toEqual({});
  });
});

// Fijo, y no el reloj real: `hoy` entra por parametro en validarGasto() (issue #725) para que
// estas pruebas no dependan de cuando ni en que zona horaria se corran. Antes de la #725 el dia
// se tomaba con toISOString(), y en Guatemala, despues de las 18:00, el gasto "de hoy" salia en
// el futuro; el CI no lo veia porque corre en UTC.
const HOY = new Date(2026, 5, 15, 10, 0);

function hoy() {
  return aCadenaFechaLocal(HOY);
}

function enDias(dias) {
  return aCadenaFechaLocal(new Date(HOY.getFullYear(), HOY.getMonth(), HOY.getDate() + dias));
}

const jornadaConPresupuesto = {
  fecha: "2026-06-20",
  presupuesto_asignado: 1000.0,
  comprometido: 200.0,
};

describe("validarGasto", () => {
  it("acepta un gasto valido dentro del presupuesto", () => {
    const resultado = validarGasto(
      {
        jornada_id: "j1",
        concepto: "Compra de mascarillas",
        categoria: "Medicamentos",
        monto: 150.0,
        fecha: hoy(),
      },
      jornadaConPresupuesto,
      HOY,
    );

    expect(resultado.valido).toBe(true);
    expect(resultado.errores).toEqual([]);
    expect(resultado.esExcedente).toBe(false);
  });

  it("rechaza montos menores o iguales a cero", () => {
    const resultado = validarGasto(
      {
        jornada_id: "j1",
        concepto: "Prueba",
        categoria: "Logistica",
        monto: 0,
        fecha: hoy(),
      },
      null,
      HOY,
    );

    expect(resultado.valido).toBe(false);
    expect(resultado.errores).toContain("El monto del gasto debe ser mayor que cero.");
  });

  it("exige la jornada", () => {
    const resultado = validarGasto(
      { concepto: "Bus", categoria: "Logistica", monto: 10, fecha: hoy() },
      null,
      HOY,
    );

    expect(resultado.valido).toBe(false);
    expect(resultado.errores).toContain("La jornada del gasto es obligatoria.");
  });

  it("exige concepto y categoria", () => {
    const resultado = validarGasto({ monto: 10, fecha: hoy() }, null, HOY);

    expect(resultado.errores).toContain("El concepto del gasto es obligatorio.");
    expect(resultado.errores).toContain("La categoría de gasto es obligatoria.");
  });

  it("acepta una categoria recien creada: la valida el catalogo de la base (00158)", () => {
    const resultado = validarGasto(
      { jornada_id: "j1", concepto: "Bus", categoria: "Transporte", monto: 100, fecha: hoy() },
      null,
      HOY,
    );

    expect(resultado.valido).toBe(true);
  });

  it("sin jornada, rechaza una fecha posterior a hoy", () => {
    const resultado = validarGasto(
      {
        jornada_id: "j1",
        concepto: "Compra adelantada",
        categoria: "Logistica",
        monto: 100,
        fecha: enDias(3),
      },
      null,
      HOY,
    );

    expect(resultado.errores).toContain("La fecha de un gasto no puede ser posterior a hoy.");
  });

  it("acepta la fecha de su jornada aunque sea futura", () => {
    const resultado = validarGasto(
      {
        jornada_id: "j1",
        concepto: "Reserva",
        categoria: "Logistica",
        monto: 100,
        fecha: "2026-06-20",
      },
      jornadaConPresupuesto,
      HOY,
    );

    expect(resultado.valido).toBe(true);
  });

  it("rechaza una fecha posterior a su jornada", () => {
    const resultado = validarGasto(
      {
        jornada_id: "j1",
        concepto: "Reserva",
        categoria: "Logistica",
        monto: 100,
        fecha: "2026-06-21",
      },
      jornadaConPresupuesto,
      HOY,
    );

    expect(resultado.valido).toBe(false);
    expect(resultado.errores[0]).toContain("hasta el día de su jornada (20/06/2026)");
  });

  it("acepta un gasto de preparacion de antes de la jornada", () => {
    const resultado = validarGasto(
      {
        jornada_id: "j1",
        concepto: "Compra previa",
        categoria: "Logistica",
        monto: 100,
        fecha: "2026-03-01",
      },
      jornadaConPresupuesto,
      HOY,
    );

    expect(resultado.valido).toBe(true);
  });

  it("pasada la jornada, la fecha llega hasta hoy", () => {
    const jornadaPasada = { ...jornadaConPresupuesto, fecha: "2026-06-01" };

    expect(
      validarGasto(
        { jornada_id: "j1", concepto: "Factura", categoria: "Logistica", monto: 100, fecha: hoy() },
        jornadaPasada,
        HOY,
      ).valido,
    ).toBe(true);
    expect(
      validarGasto(
        {
          jornada_id: "j1",
          concepto: "Factura",
          categoria: "Logistica",
          monto: 100,
          fecha: enDias(1),
        },
        jornadaPasada,
        HOY,
      ).valido,
    ).toBe(false);
  });

  it("bloquea un gasto que pasa el presupuesto contando lo comprometido", () => {
    const resultado = validarGasto(
      {
        jornada_id: "j1",
        concepto: "Alquiler extra de planta",
        categoria: "Infraestructura",
        monto: 500.0,
        fecha: hoy(),
      },
      { ...jornadaConPresupuesto, comprometido: 800.0 },
      HOY,
    );

    expect(resultado.valido).toBe(false);
    expect(resultado.esExcedente).toBe(true);
    expect(resultado.errores).toContain("El gasto pasa el presupuesto disponible de la jornada.");
    expect(resultado.mensajeExcedente).toContain("300.00");
    expect(resultado.mensajeExcedente).toContain("200.00");
  });

  it("rechaza un gasto en una jornada finalizada", () => {
    const resultado = validarGasto(
      { jornada_id: "j1", concepto: "Factura", categoria: "Logistica", monto: 10, fecha: hoy() },
      { ...jornadaConPresupuesto, estado: "finalizada" },
      HOY,
    );

    expect(resultado.valido).toBe(false);
    expect(resultado.errores).toContain("La jornada ya cerró: no admite gastos nuevos.");
  });

  it("acepta un gasto que llega justo al presupuesto", () => {
    const resultado = validarGasto(
      { jornada_id: "j1", concepto: "Resto", categoria: "Logistica", monto: 800, fecha: hoy() },
      jornadaConPresupuesto,
      HOY,
    );

    expect(resultado.valido).toBe(true);
    expect(resultado.esExcedente).toBe(false);
  });

  it("no evalua el excedente cuando la jornada no trae presupuesto asignado", () => {
    const resultado = validarGasto(
      {
        jornada_id: "j1",
        concepto: "Insumos varios",
        categoria: "Medicamentos",
        monto: 5000,
        fecha: hoy(),
      },
      { fecha: "2026-06-20" },
      HOY,
    );

    expect(resultado.valido).toBe(true);
    expect(resultado.esExcedente).toBe(false);
    expect(resultado.mensajeExcedente).toBeNull();
  });

  describe("el borde de las 18:00 en Guatemala (issue #725)", () => {
    conZonaHorariaDeGuatemala();

    // 15 de junio de 2026, 20:00 en Guatemala (UTC-6) = 16 de junio, 02:00 UTC.
    const HOY_DE_NOCHE = new Date("2026-06-16T02:00:00Z");

    it("rechaza un gasto fechado manana, aunque su medianoche UTC ya haya pasado", () => {
      const resultado = validarGasto(
        {
          jornada_id: "j1",
          concepto: "Compra adelantada",
          categoria: "Logistica",
          monto: 100,
          fecha: "2026-06-16",
        },
        null,
        HOY_DE_NOCHE,
      );

      expect(resultado.errores).toContain("La fecha de un gasto no puede ser posterior a hoy.");
    });

    it("acepta un gasto fechado hoy, aunque ya sean las 20:00 en Guatemala", () => {
      const resultado = validarGasto(
        {
          jornada_id: "j1",
          concepto: "Compra de la tarde",
          categoria: "Logistica",
          monto: 100,
          fecha: "2026-06-15",
        },
        null,
        HOY_DE_NOCHE,
      );

      expect(resultado.errores).not.toContain("La fecha de un gasto no puede ser posterior a hoy.");
    });
  });
});
