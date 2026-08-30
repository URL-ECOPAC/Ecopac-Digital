// Pruebas de las reglas de negocio de donantes y donaciones (issue #189).
//
// Reemplazan a validaciones.test.ts. Aquella version pasaba en verde validando valores que la base
// rechaza ('DINERO', 'MEDICAMENTOS'), que es justo lo que estas pruebas ahora impiden: cada caso
// usa los valores del enum de 00022_donantes_donaciones.sql.

import { describe, expect, it } from "vitest";

import { TIPOS_DE_DONACION, TIPOS_DE_DONANTE } from "./campos.js";
import { validarAnulacionDeDonacion, validarDonacion, validarDonante } from "./validaciones.js";

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

  // Los casos de abajo son las reglas que la medicion de cobertura (issue #219) encontro sin
  // ejercer: existian en el codigo y ninguna prueba entraba en ellas.

  it("una donacion vacia reporta los tres campos obligatorios a la vez", () => {
    const errores = validarDonacion({});

    expect(errores.donanteId).toBeDefined();
    expect(errores.tipo).toBeDefined();
    expect(errores.fecha).toBeDefined();
    expect(errores.detalles).toBeDefined();
  });

  it("distingue la fecha ilegible de la fecha ausente", () => {
    // Son dos mensajes distintos a proposito: "falta la fecha" y "esa fecha no se entiende" le
    // piden cosas distintas a quien llena el formulario.
    expect(validarDonacion({ fecha: "" }).fecha).toBe("La fecha de la donacion es obligatoria.");
    expect(validarDonacion({ fecha: "31/02/2026" }).fecha).toBe(
      "La fecha proporcionada no es valida.",
    );
  });

  it("exige descripcion en cada renglon, y dice cual", () => {
    const errores = validarDonacion({
      donanteId: "uuid-1",
      tipo: TIPOS_DE_DONACION.SERVICIOS,
      fecha: hoy(),
      detalles: [{ descripcion: "Traslado" }, {}],
    });

    expect(errores.detalles_0_descripcion).toBeUndefined();
    expect(errores.detalles_1_descripcion).toContain("2");
  });

  it("fuera de medicamentos e insumos la cantidad es opcional, pero si viene debe ser positiva", () => {
    // La rama del `else if`: servicios no exige cantidad, y aun asi un cero la invalida, porque
    // es lo que rechaza el CHECK de la tabla.
    const sinCantidad = validarDonacion({
      donanteId: "uuid-1",
      tipo: TIPOS_DE_DONACION.SERVICIOS,
      fecha: hoy(),
      detalles: [{ descripcion: "Traslado de pacientes" }],
    });
    expect(sinCantidad).toEqual({});

    const conCero = validarDonacion({
      donanteId: "uuid-1",
      tipo: TIPOS_DE_DONACION.SERVICIOS,
      fecha: hoy(),
      detalles: [{ descripcion: "Traslado de pacientes", cantidad: 0 }],
    });
    expect(conCero.detalles_0_cantidad).toContain("mayor a cero");
  });

  it("un monto negativo se rechaza; el cero no es negativo", () => {
    const negativo = validarDonacion({
      donanteId: "uuid-1",
      tipo: TIPOS_DE_DONACION.SERVICIOS,
      fecha: hoy(),
      detalles: [{ descripcion: "Traslado", monto: -1 }],
    });
    expect(negativo.detalles_0_monto).toContain("no puede ser negativo");

    const cero = validarDonacion({
      donanteId: "uuid-1",
      tipo: TIPOS_DE_DONACION.SERVICIOS,
      fecha: hoy(),
      detalles: [{ descripcion: "Traslado", monto: 0 }],
    });
    expect(cero.detalles_0_monto).toBeUndefined();
  });

  it("en medicamentos, un vencimiento ilegible no es lo mismo que un vencimiento ausente", () => {
    const ilegible = validarDonacion({
      donanteId: "uuid-1",
      tipo: TIPOS_DE_DONACION.MEDICAMENTOS,
      fecha: hoy(),
      detalles: [{ descripcion: "Amoxicilina 500mg", cantidad: 10, fechaVencimiento: "pronto" }],
    });

    expect(ilegible.detalles_0_fechaVencimiento).toContain("no es valida");
  });
});

describe("validarAnulacionDeDonacion", () => {
  it("exige el motivo que pide chk_donaciones_anulacion_coherente", () => {
    expect(validarAnulacionDeDonacion({}).motivo).toBeDefined();
    expect(validarAnulacionDeDonacion({ motivo: "Duplicada" })).toEqual({});
  });
});
