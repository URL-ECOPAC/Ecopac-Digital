// Pruebas de la logica pura del formulario de jornada (issue #179, ampliado por la issue #756
// con cupoEstimado y botiquinBodega).
//
// El hook en si no se monta: packages/shared corre vitest con environment "node", sin DOM,
// mismo motivo que useAltaUsuario.test.js/useEdicionUsuario.test.js. valoresInicialesDeJornada() y
// aDatosDeJornada() se exportan aparte justamente para poder probarlas sin montar nada.

import { describe, expect, it } from "vitest";

import { aDatosDeJornada, valoresInicialesDeJornada } from "./useFormularioJornada.js";

describe("valoresInicialesDeJornada", () => {
  it("sin jornada, arranca vacia (alta)", () => {
    expect(valoresInicialesDeJornada(null)).toEqual({
      nombre: "",
      fecha: "",
      comunidad: "",
      responsable: "",
      proyecto: "",
      cupoEstimado: null,
      botiquinBodega: "",
    });
  });

  it("con jornada, traduce comunidadId/responsableId/proyectoId/botiquinBodegaId a los ids del formulario (edicion)", () => {
    const jornada = {
      id: "j1",
      nombre: "Jornada en Solola",
      fecha: "2026-09-01",
      comunidadId: "comunidad-1",
      responsableId: "perfil-1",
      proyectoId: "proyecto-1",
      cupoEstimado: 80,
      botiquinBodegaId: "bodega-1",
    };

    expect(valoresInicialesDeJornada(jornada)).toEqual({
      nombre: "Jornada en Solola",
      fecha: "2026-09-01",
      comunidad: "comunidad-1",
      responsable: "perfil-1",
      proyecto: "proyecto-1",
      cupoEstimado: 80,
      botiquinBodega: "bodega-1",
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

    expect(valoresInicialesDeJornada(jornada).proyecto).toBe("");
  });

  it("con jornada sin cupoEstimado ni botiquinBodegaId, cae a null y a cadena vacia respectivamente", () => {
    const jornada = {
      id: "j1",
      nombre: "Jornada sin cupo",
      fecha: "2026-09-01",
      comunidadId: "comunidad-1",
      responsableId: "perfil-1",
      cupoEstimado: null,
      botiquinBodegaId: null,
    };

    const valores = valoresInicialesDeJornada(jornada);
    expect(valores.cupoEstimado).toBeNull();
    expect(valores.botiquinBodega).toBe("");
  });

  it("un cupoEstimado de 0 no se confunde con vacio (0 es un valor real, no ausencia)", () => {
    expect(valoresInicialesDeJornada({ cupoEstimado: 0 }).cupoEstimado).toBe(0);
  });
});

describe("aDatosDeJornada", () => {
  it("deja pasar los campos tal cual cuando hay proyecto y botiquinBodega elegidos", () => {
    const valores = {
      nombre: "Jornada en Solola",
      fecha: "2026-09-01",
      comunidad: "comunidad-1",
      responsable: "perfil-1",
      proyecto: "proyecto-1",
      cupoEstimado: 80,
      botiquinBodega: "bodega-1",
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

  it("convierte el botiquinBodega vacio ('') a null, no a cadena vacia", () => {
    const valores = {
      nombre: "Jornada sin botiquin",
      fecha: "2026-09-01",
      comunidad: "comunidad-1",
      responsable: "perfil-1",
      botiquinBodega: "",
    };

    expect(aDatosDeJornada(valores).botiquinBodega).toBeNull();
  });

  it("no toca cupoEstimado: NumberField ya entrega numero o null", () => {
    expect(aDatosDeJornada({ cupoEstimado: 50 }).cupoEstimado).toBe(50);
    expect(aDatosDeJornada({ cupoEstimado: null }).cupoEstimado).toBeNull();
  });
});
