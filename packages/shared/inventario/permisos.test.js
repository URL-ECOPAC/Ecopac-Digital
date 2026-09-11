// Pruebas de los permisos de movimientos de inventario.
//
// Se importan los modulos directamente y no el barril packages/shared/index.js: el barril
// arrastra @supabase/supabase-js y el modulo de entorno, y estas pruebas tienen que correr sin
// .env y sin conexion. Mismo patron que jornadas/permisos.test.js.

import { describe, expect, it } from "vitest";

import { ROLES } from "../usuarios/roles.js";
import {
  permisosDeMovimientos,
  puedeAprobarMovimiento,
  puedeRechazarMovimiento,
  puedeRegistrarMovimiento,
  puedeVerMovimientos,
  puedeVerValorizacion,
} from "./permisos.js";

describe("permisos de movimientos de inventario", () => {
  it("cualquier rol conocido puede ver movimientos (SELECT abierto, 00034)", () => {
    for (const rol of Object.values(ROLES)) {
      expect(puedeVerMovimientos(rol)).toBe(true);
    }
  });

  it("administrador, medico y voluntario registran movimientos (INSERT, 00034)", () => {
    expect(puedeRegistrarMovimiento(ROLES.ADMINISTRADOR)).toBe(true);
    expect(puedeRegistrarMovimiento(ROLES.MEDICO)).toBe(true);
    expect(puedeRegistrarMovimiento(ROLES.VOLUNTARIO)).toBe(true);

    expect(puedeRegistrarMovimiento(ROLES.JUNTA_DIRECTIVA)).toBe(false);
    expect(puedeRegistrarMovimiento(ROLES.SOCIO_FUNDADOR)).toBe(false);
  });

  it("solo administrador aprueba o rechaza (UPDATE, 00048)", () => {
    expect(puedeAprobarMovimiento(ROLES.ADMINISTRADOR)).toBe(true);
    expect(puedeRechazarMovimiento(ROLES.ADMINISTRADOR)).toBe(true);

    expect(puedeAprobarMovimiento(ROLES.MEDICO)).toBe(false);
    expect(puedeAprobarMovimiento(ROLES.VOLUNTARIO)).toBe(false);
    expect(puedeAprobarMovimiento(ROLES.JUNTA_DIRECTIVA)).toBe(false);
    expect(puedeAprobarMovimiento(ROLES.SOCIO_FUNDADOR)).toBe(false);
    expect(puedeRechazarMovimiento(ROLES.JUNTA_DIRECTIVA)).toBe(false);
    expect(puedeRechazarMovimiento(ROLES.SOCIO_FUNDADOR)).toBe(false);
  });

  it("un rol que no existe no puede nada", () => {
    expect(permisosDeMovimientos("coordinador")).toEqual({
      puedeVer: false,
      puedeRegistrar: false,
      puedeAprobar: false,
      puedeRechazar: false,
    });
  });

  it("agrupa los permisos para que un hook no llame a las funciones sueltas", () => {
    expect(permisosDeMovimientos(ROLES.VOLUNTARIO)).toEqual({
      puedeVer: true,
      puedeRegistrar: true,
      puedeAprobar: false,
      puedeRechazar: false,
    });

    expect(permisosDeMovimientos(ROLES.ADMINISTRADOR)).toEqual({
      puedeVer: true,
      puedeRegistrar: true,
      puedeAprobar: true,
      puedeRechazar: true,
    });
  });
});

describe("puedeVerValorizacion (issue #752)", () => {
  it("administrador y los roles consultivos ven el valor monetario del inventario", () => {
    expect(puedeVerValorizacion(ROLES.ADMINISTRADOR)).toBe(true);
    expect(puedeVerValorizacion(ROLES.JUNTA_DIRECTIVA)).toBe(true);
    expect(puedeVerValorizacion(ROLES.SOCIO_FUNDADOR)).toBe(true);
  });

  it("medico y voluntario general no ven costo_unitario: es informacion financiera", () => {
    expect(puedeVerValorizacion(ROLES.MEDICO)).toBe(false);
    expect(puedeVerValorizacion(ROLES.VOLUNTARIO)).toBe(false);
  });

  it("un rol que no existe no ve nada", () => {
    expect(puedeVerValorizacion("coordinador")).toBe(false);
  });
});
