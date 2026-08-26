// Pruebas de los permisos de lotes.
//
// Se importan los modulos directamente y no el barril packages/shared/index.js: el barril
// arrastra @supabase/supabase-js y el modulo de entorno, y estas pruebas tienen que correr sin
// .env y sin conexion. Las funciones de lotes.api.js se prueban aparte, en lotes.api.test.js.

import { describe, expect, it } from "vitest";

import { ROLES } from "../usuarios/roles.js";
import { permisosDeLotes, puedeAdministrarLotes, puedeVerLotes } from "./lotes.permisos.js";

describe("permisos de lotes", () => {
  it("solo Administrador registra lotes", () => {
    expect(puedeAdministrarLotes(ROLES.ADMINISTRADOR)).toBe(true);

    expect(puedeAdministrarLotes(ROLES.JUNTA_DIRECTIVA)).toBe(false);
    expect(puedeAdministrarLotes(ROLES.SOCIO_FUNDADOR)).toBe(false);
    expect(puedeAdministrarLotes(ROLES.MEDICO)).toBe(false);
    expect(puedeAdministrarLotes(ROLES.VOLUNTARIO)).toBe(false);
  });

  it("cualquier rol conocido puede ver los lotes", () => {
    for (const rol of Object.values(ROLES)) {
      expect(puedeVerLotes(rol)).toBe(true);
    }
  });

  it("un rol que no existe no puede nada", () => {
    expect(permisosDeLotes("coordinador")).toEqual({ puedeVer: false, puedeCrear: false });
  });

  it("agrupa los permisos para que un hook no llame a las funciones sueltas", () => {
    expect(permisosDeLotes(ROLES.MEDICO)).toEqual({ puedeVer: true, puedeCrear: false });
    expect(permisosDeLotes(ROLES.ADMINISTRADOR)).toEqual({ puedeVer: true, puedeCrear: true });
  });
});
