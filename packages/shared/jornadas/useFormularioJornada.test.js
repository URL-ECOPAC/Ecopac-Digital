// Pruebas de la logica pura del formulario de jornada (issue #179).
//
// El hook en si no se monta: packages/shared corre vitest con environment "node", sin DOM,
// mismo motivo que useAltaUsuario.test.js/useEdicionUsuario.test.js. valoresIniciales() y
// aDatosDeJornada() se exportan aparte justamente para poder probarlas sin montar nada.

import { describe, expect, it } from "vitest";

import { aDatosDeJornada, valoresIniciales } from "./useFormularioJornada.js";

describe("valoresIniciales", () => {
  it("sin jornada, arranca vacia (alta)", () => {
    expect(valoresIniciales(null)).toEqual({
      nombre: "",
      fecha: "",
      comunidad: "",
      responsable: "",
      proyecto: "",
    });
  });

  it("con jornada, traduce comunidadId/responsableId/proyectoId a los ids del formulario (edicion)", () => {
    const jornada = {
      id: "j1",
      nombre: "Jornada en Solola",
      fecha: "2026-09-01",
      comunidadId: "comunidad-1",
      responsableId: "perfil-1",
      proyectoId: "proyecto-1",
    };

    expect(valoresIniciales(jornada)).toEqual({
      nombre: "Jornada en Solola",
      fecha: "2026-09-01",
      comunidad: "comunidad-1",
      responsable: "perfil-1",
      proyecto: "proyecto-1",
    });
  });

  it("con jornada sin proyecto, deja proyecto en cadena vacia, no null ni undefined", () => {
    const jornada = {
      id: "j1",
      nombre: "Jornada sin proyecto",
      fecha: "2026-09-01",
      comunidadId: "comunidad-1",
      responsableId: "perfil-1",
      proyectoId: null,
    };

    expect(valoresIniciales(jornada).proyecto).toBe("");
  });
});

describe("aDatosDeJornada", () => {
  it("deja pasar los campos tal cual cuando hay proyecto elegido", () => {
    const valores = {
      nombre: "Jornada en Solola",
      fecha: "2026-09-01",
      comunidad: "comunidad-1",
      responsable: "perfil-1",
      proyecto: "proyecto-1",
    };

    expect(aDatosDeJornada(valores)).toEqual(valores);
  });

  it("convierte el proyecto vacio ('') a null, no a cadena vacia", () => {
    const valores = {
      nombre: "Jornada sin proyecto",
      fecha: "2026-09-01",
      comunidad: "comunidad-1",
      responsable: "perfil-1",
      proyecto: "",
    };

    expect(aDatosDeJornada(valores).proyecto).toBeNull();
  });
});
