// Pruebas de las reglas de negocio de donantes y donaciones (issue #189).
//
// Reemplazan a validaciones.test.ts. Aquella version pasaba en verde validando valores que la base
// rechaza ('DINERO', 'MEDICAMENTOS'), que es justo lo que estas pruebas ahora impiden: cada caso
// usa los valores del enum de 00022_donantes_donaciones.sql.

import { describe, expect, it } from "vitest";

import {
  TIPOS_DE_DONACION,
  TIPOS_DE_DONANTE,
  validarAnulacionDeDonacion,
  validarDonacion,
  validarDonante,
} from "./validaciones.js";

function hoy() {
  return new Date().toISOString();
}

function enDias(dias) {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  return fecha.toISOString();
}

describe("validarDonante", () => {
  it("exige nombre, tipo y algun dato de contacto", () => {
    const errores = validarDonante({});

    expect(errores.nombre).toBeDefined();
    expect(errores.tipo).toBeDefined();
    expect(errores.contacto).toBeDefined();
  });

  it("acepta un donante con telefono como unico contacto", () => {
    const errores = validarDonante({
      nombre: "Fundacion Esperanza",
      tipo: TIPOS_DE_DONANTE.ORGANIZACION,
      telefono: "12345678",
    });

    expect(errores).toEqual({});
  });

  it("acepta un donante con correo como unico contacto", () => {
    const errores = validarDonante({
      nombre: "Ana Perez",
      tipo: TIPOS_DE_DONANTE.PERSONA,
      email: "ana@example.org",
    });

    expect(errores).toEqual({});
  });

  it("rechaza un tipo que no esta en el enum tipo_donante", () => {
    const errores = validarDonante({
      nombre: "Ana Perez",
      tipo: "INDIVIDUAL",
      telefono: "12345678",
    });

    expect(errores.tipo).toBe("El tipo de donante seleccionado no es valido.");
  });
});

describe("validarDonacion", () => {
  it("rechaza una fecha futura", () => {
    const errores = validarDonacion({
      donanteId: "uuid-1",
      tipo: TIPOS_DE_DONACION.DINERO,
      fecha: enDias(5),
      detalles: [{ descripcion: "Aporte mensual", monto: 100 }],
    });

    expect(errores.fecha).toBe("La fecha de la donacion no puede ser futura.");
  });

  it("acepta una donacion registrada hoy", () => {
    const errores = validarDonacion({
      donanteId: "uuid-1",
      tipo: TIPOS_DE_DONACION.DINERO,
      fecha: hoy(),
      detalles: [{ descripcion: "Aporte mensual", monto: 100 }],
    });

    expect(errores).toEqual({});
  });

  it("exige un importe mayor a cero si la donacion es en dinero", () => {
    const errores = validarDonacion({
      donanteId: "uuid-1",
      tipo: TIPOS_DE_DONACION.DINERO,
      fecha: hoy(),
      detalles: [{ descripcion: "Aporte mensual" }],
    });

    expect(errores.monto).toBe("Una donacion en dinero exige un monto mayor a cero.");
  });

  it("exige al menos un renglon de detalle", () => {
    const errores = validarDonacion({
      donanteId: "uuid-1",
      tipo: TIPOS_DE_DONACION.MEDICAMENTOS,
      fecha: hoy(),
      detalles: [],
    });

    expect(errores.detalles).toBeDefined();
  });

  it("exige cantidad y vencimiento en cada renglon de medicamentos", () => {
    const errores = validarDonacion({
      donanteId: "uuid-1",
      tipo: TIPOS_DE_DONACION.MEDICAMENTOS,
      fecha: hoy(),
      detalles: [{ descripcion: "Amoxicilina 500mg" }],
    });

    expect(errores.detalles_0_cantidad).toBeDefined();
    expect(errores.detalles_0_fechaVencimiento).toBeDefined();
  });

  it("acepta una donacion de medicamentos completa", () => {
    const errores = validarDonacion({
      donanteId: "uuid-1",
      tipo: TIPOS_DE_DONACION.MEDICAMENTOS,
      fecha: hoy(),
      detalles: [
        {
          descripcion: "Amoxicilina 500mg",
          cantidad: 120,
          unidad: "tabletas",
          fechaVencimiento: enDias(400),
        },
      ],
    });

    expect(errores).toEqual({});
  });

  it("acepta insumos, que la version anterior no contemplaba", () => {
    const errores = validarDonacion({
      donanteId: "uuid-1",
      tipo: TIPOS_DE_DONACION.INSUMOS,
      fecha: hoy(),
      detalles: [{ descripcion: "Guantes de latex", cantidad: 500, unidad: "pares" }],
    });

    expect(errores).toEqual({});
  });

  it("acepta servicios sin cantidad", () => {
    const errores = validarDonacion({
      donanteId: "uuid-1",
      tipo: TIPOS_DE_DONACION.SERVICIOS,
      fecha: hoy(),
      detalles: [{ descripcion: "Transporte de brigada" }],
    });

    expect(errores).toEqual({});
  });

  it("rechaza un tipo que no esta en el enum tipo_donacion", () => {
    const errores = validarDonacion({
      donanteId: "uuid-1",
      tipo: "EQUIPO",
      fecha: hoy(),
      detalles: [{ descripcion: "Camilla" }],
    });

    expect(errores.tipo).toBe("El tipo de donacion seleccionado no es valido.");
  });
});

describe("validarAnulacionDeDonacion", () => {
  it("exige el motivo que pide chk_donaciones_anulacion_coherente", () => {
    expect(validarAnulacionDeDonacion({}).motivo).toBeDefined();
    expect(validarAnulacionDeDonacion({ motivo: "Duplicada" })).toEqual({});
  });
});
