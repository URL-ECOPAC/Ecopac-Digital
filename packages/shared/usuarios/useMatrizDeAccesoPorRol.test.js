// Pruebas de la logica pura de la matriz de acceso a modulos (00148). No se monta el hook:
// packages/shared corre vitest sin DOM.

import { describe, expect, it } from "vitest";

import { MODULOS_DE_LA_MATRIZ } from "../navegacion.js";
import { ROLES } from "./roles.js";
import { ESTADOS_DE_ACCESO, estadoDeCeldaDeAcceso } from "./useMatrizDeAccesoPorRol.js";

const modulo = (id) => MODULOS_DE_LA_MATRIZ.find((m) => m.id === id);

describe("estadoDeCeldaDeAcceso", () => {
  it("la administradora tiene todo, siempre", () => {
    expect(estadoDeCeldaDeAcceso(ROLES.ADMINISTRADOR, modulo("donaciones"), new Set())).toBe(
      ESTADOS_DE_ACCESO.SIEMPRE,
    );
  });

  it("un modulo del rol es por defecto, aunque tenga fila (no se cierra desde la matriz)", () => {
    expect(
      estadoDeCeldaDeAcceso(
        ROLES.VOLUNTARIO,
        modulo("presupuestos"),
        new Set(["voluntario general|presupuestos"]),
      ),
    ).toBe(ESTADOS_DE_ACCESO.POR_DEFECTO);
    expect(estadoDeCeldaDeAcceso(ROLES.JUNTA_DIRECTIVA, modulo("reportes"), new Set())).toBe(
      ESTADOS_DE_ACCESO.POR_DEFECTO,
    );
  });

  it("abierto si rol_modulo tiene la fila, cerrado si no", () => {
    const abiertos = new Set(["junta directiva|pacientes"]);

    expect(estadoDeCeldaDeAcceso(ROLES.JUNTA_DIRECTIVA, modulo("pacientes"), abiertos)).toBe(
      ESTADOS_DE_ACCESO.ABIERTO,
    );
    expect(estadoDeCeldaDeAcceso(ROLES.SOCIO_FUNDADOR, modulo("pacientes"), abiertos)).toBe(
      ESTADOS_DE_ACCESO.CERRADO,
    );
  });
});
