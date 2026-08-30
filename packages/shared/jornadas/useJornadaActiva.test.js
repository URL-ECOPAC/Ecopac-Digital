// Pruebas de la parte pura del hook de jornada activa.
//
// El hook en si no se monta: packages/shared corre vitest con environment "node" a proposito
// (ver cabecera de vitest.config.js), mismo motivo que useAltaUsuario.test.js y
// usePerfilPropio.test.js. Lo que se puede probar sin DOM es la logica de seleccion, que por
// eso vive en funciones puras y exportadas aparte del hook.

import { describe, expect, it } from "vitest";

import {
  claveDeAlmacenamiento,
  elegirJornadaInicial,
  filtrarJornadasEnCurso,
} from "./useJornadaActiva.js";
import { ESTADOS_JORNADA } from "./permisos.js";

function jornada(id, estado) {
  return { id, estado };
}

describe("claveDeAlmacenamiento", () => {
  it("incluye el perfilId para no mezclar la seleccion de dos personas en el mismo dispositivo", () => {
    expect(claveDeAlmacenamiento("perfil-1")).toBe("jornada_activa:perfil-1");
    expect(claveDeAlmacenamiento("perfil-2")).not.toBe(claveDeAlmacenamiento("perfil-1"));
  });
});

describe("filtrarJornadasEnCurso", () => {
  it("deja solo las jornadas en estado 'en curso'", () => {
    const jornadas = [
      jornada("J1", ESTADOS_JORNADA.EN_CURSO),
      jornada("J2", ESTADOS_JORNADA.PLANIFICADA),
      jornada("J3", ESTADOS_JORNADA.FINALIZADA),
      jornada("J4", ESTADOS_JORNADA.EN_CURSO),
    ];

    expect(filtrarJornadasEnCurso(jornadas).map((j) => j.id)).toEqual(["J1", "J4"]);
  });

  it("sin jornadas devuelve una lista vacia, no lanza", () => {
    expect(filtrarJornadasEnCurso([])).toEqual([]);
    expect(filtrarJornadasEnCurso(undefined)).toEqual([]);
  });
});

describe("elegirJornadaInicial", () => {
  it("elige la persistida si sigue en curso", () => {
    const enCurso = [
      jornada("J1", ESTADOS_JORNADA.EN_CURSO),
      jornada("J2", ESTADOS_JORNADA.EN_CURSO),
    ];
    expect(elegirJornadaInicial(enCurso, "J2")).toBe("J2");
  });

  it("ignora la persistida si ya no esta en curso, y cae a la unica candidata", () => {
    const enCurso = [jornada("J1", ESTADOS_JORNADA.EN_CURSO)];
    expect(elegirJornadaInicial(enCurso, "J-vieja-finalizada")).toBe("J1");
  });

  it("sin persistida y con una sola candidata, la elige automaticamente", () => {
    const enCurso = [jornada("J1", ESTADOS_JORNADA.EN_CURSO)];
    expect(elegirJornadaInicial(enCurso, null)).toBe("J1");
  });

  it("sin candidatas devuelve null: no hay nada que elegir", () => {
    expect(elegirJornadaInicial([], null)).toBeNull();
    expect(elegirJornadaInicial([], "J-cualquiera")).toBeNull();
  });

  it("con varias candidatas y sin persistida que decida, devuelve null (criterio 2: elige la pantalla)", () => {
    const enCurso = [
      jornada("J1", ESTADOS_JORNADA.EN_CURSO),
      jornada("J2", ESTADOS_JORNADA.EN_CURSO),
    ];
    expect(elegirJornadaInicial(enCurso, null)).toBeNull();
  });

  it("con varias candidatas, la persistida SI decide si esta entre ellas", () => {
    const enCurso = [
      jornada("J1", ESTADOS_JORNADA.EN_CURSO),
      jornada("J2", ESTADOS_JORNADA.EN_CURSO),
    ];
    expect(elegirJornadaInicial(enCurso, "J2")).toBe("J2");
  });
});
