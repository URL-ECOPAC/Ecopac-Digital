// Pruebas de los permisos de lotes.
//
// Se importan los modulos directamente y no el barril packages/shared/index.js: el barril
// arrastra @supabase/supabase-js y el modulo de entorno, y estas pruebas tienen que correr sin
// .env y sin conexion. Las funciones de lotes.api.js se prueban aparte, en lotes.api.test.js.

import { describe, expect, it } from "vitest";

import { ROLES } from "../usuarios/roles.js";
import {
  permisosDeLotes,
  puedeAdministrarLotes,
  puedeProponerLote,
  puedeVerLotes,
} from "./lotes.permisos.js";

describe("permisos de lotes", () => {
  it("solo Administrador administra el catalogo de lotes", () => {
    expect(puedeAdministrarLotes(ROLES.ADMINISTRADOR)).toBe(true);

    expect(puedeAdministrarLotes(ROLES.JUNTA_DIRECTIVA)).toBe(false);
    expect(puedeAdministrarLotes(ROLES.SOCIO_FUNDADOR)).toBe(false);
    expect(puedeAdministrarLotes(ROLES.MEDICO)).toBe(false);
    expect(puedeAdministrarLotes(ROLES.VOLUNTARIO)).toBe(false);
  });

  it("los roles de campo proponen lotes; los consultivos no (issue #625)", () => {
    // Lo que crean nace provisional (lotes.confirmado = FALSE) y lo confirma la administradora al
    // aprobar el ingreso. Junta directiva y socio fundador son consultivos: no registran nada.
    expect(puedeProponerLote(ROLES.ADMINISTRADOR)).toBe(true);
    expect(puedeProponerLote(ROLES.MEDICO)).toBe(true);
    expect(puedeProponerLote(ROLES.VOLUNTARIO)).toBe(true);

    expect(puedeProponerLote(ROLES.JUNTA_DIRECTIVA)).toBe(false);
    expect(puedeProponerLote(ROLES.SOCIO_FUNDADOR)).toBe(false);
  });

  it("cualquier rol conocido puede ver los lotes", () => {
    for (const rol of Object.values(ROLES)) {
      expect(puedeVerLotes(rol)).toBe(true);
    }
  });

  it("un rol que no existe no puede nada", () => {
    expect(permisosDeLotes("coordinador")).toEqual({
      puedeVer: false,
      puedeCrear: false,
      puedeAdministrar: false,
    });
  });

  it("agrupa los permisos para que un hook no llame a las funciones sueltas", () => {
    // El voluntario puede crear pero no administrar: es exactamente la distincion que la 00107
    // introduce, y la que la pantalla necesita para saber si lo que cree nace firme o a revision.
    expect(permisosDeLotes(ROLES.VOLUNTARIO)).toEqual({
      puedeVer: true,
      puedeCrear: true,
      puedeAdministrar: false,
    });
    expect(permisosDeLotes(ROLES.MEDICO)).toEqual({
      puedeVer: true,
      puedeCrear: true,
      puedeAdministrar: false,
    });
    expect(permisosDeLotes(ROLES.ADMINISTRADOR)).toEqual({
      puedeVer: true,
      puedeCrear: true,
      puedeAdministrar: true,
    });
    expect(permisosDeLotes(ROLES.JUNTA_DIRECTIVA)).toEqual({
      puedeVer: true,
      puedeCrear: false,
      puedeAdministrar: false,
    });
  });
});
