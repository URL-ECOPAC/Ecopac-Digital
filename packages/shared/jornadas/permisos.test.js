// Pruebas de los permisos del modulo de jornadas.
//
// Se importan los modulos directamente y no el barril packages/shared/index.js: el barril
// arrastra @supabase/supabase-js y el modulo de entorno, y estas pruebas tienen que correr sin
// .env y sin conexion. Las funciones de api.js se prueban aparte, en api.test.js, con el doble
// de obtenerSupabase() que ya establecio packages/shared/presupuestos/api.test.js.

import { describe, expect, it } from "vitest";

import { ROLES } from "../usuarios/roles.js";
import {
  permisosDeJornadas,
  puedeAdministrarJornadas,
  puedeEditarJornada,
  puedeReabrirJornada,
  puedeVerHistorialJornada,
  puedeVerJornadas,
  puedeVerRosterCompleto,
} from "./permisos.js";
import { ESTADOS_JORNADA } from "../enums.js";

describe("permisos de jornadas", () => {
  it("solo Administrador administra, como pide el criterio de aceptacion", () => {
    expect(puedeAdministrarJornadas(ROLES.ADMINISTRADOR)).toBe(true);

    expect(puedeAdministrarJornadas(ROLES.JUNTA_DIRECTIVA)).toBe(false);
    expect(puedeAdministrarJornadas(ROLES.SOCIO_FUNDADOR)).toBe(false);
    expect(puedeAdministrarJornadas(ROLES.MEDICO)).toBe(false);
    expect(puedeAdministrarJornadas(ROLES.VOLUNTARIO)).toBe(false);
  });

  it("cualquier rol conocido puede ver el listado", () => {
    for (const rol of Object.values(ROLES)) {
      expect(puedeVerJornadas(rol)).toBe(true);
    }
  });

  it("una jornada finalizada solo la edita la administradora", () => {
    expect(puedeEditarJornada(ROLES.ADMINISTRADOR, ESTADOS_JORNADA.FINALIZADA)).toBe(true);
    expect(puedeEditarJornada(ROLES.JUNTA_DIRECTIVA, ESTADOS_JORNADA.FINALIZADA)).toBe(false);
    expect(puedeEditarJornada(ROLES.MEDICO, ESTADOS_JORNADA.FINALIZADA)).toBe(false);
  });

  it("una jornada no finalizada la edita quien administra", () => {
    expect(puedeEditarJornada(ROLES.ADMINISTRADOR, ESTADOS_JORNADA.EN_CURSO)).toBe(true);
    expect(puedeEditarJornada(ROLES.MEDICO, ESTADOS_JORNADA.EN_CURSO)).toBe(false);
    expect(puedeEditarJornada(ROLES.MEDICO, ESTADOS_JORNADA.PLANIFICADA)).toBe(false);
  });

  it("solo Administrador reabre una jornada finalizada, como pide el criterio de aceptacion", () => {
    expect(puedeReabrirJornada(ROLES.ADMINISTRADOR)).toBe(true);

    expect(puedeReabrirJornada(ROLES.JUNTA_DIRECTIVA)).toBe(false);
    expect(puedeReabrirJornada(ROLES.SOCIO_FUNDADOR)).toBe(false);
    expect(puedeReabrirJornada(ROLES.MEDICO)).toBe(false);
    expect(puedeReabrirJornada(ROLES.VOLUNTARIO)).toBe(false);
  });

  it("solo Administrador lee el historial de estados, espejo de 00039:83-85", () => {
    expect(puedeVerHistorialJornada(ROLES.ADMINISTRADOR)).toBe(true);

    expect(puedeVerHistorialJornada(ROLES.JUNTA_DIRECTIVA)).toBe(false);
    expect(puedeVerHistorialJornada(ROLES.SOCIO_FUNDADOR)).toBe(false);
    expect(puedeVerHistorialJornada(ROLES.MEDICO)).toBe(false);
    expect(puedeVerHistorialJornada(ROLES.VOLUNTARIO)).toBe(false);
  });

  it("un rol que no existe no puede nada", () => {
    expect(permisosDeJornadas("coordinador")).toEqual({
      puedeVer: false,
      puedeCrear: false,
      puedeEditar: false,
      puedeReabrir: false,
      puedeVerHistorial: false,
    });
  });

  it("solo administrador y junta directiva ven el personal completo, espejo de 00039:63-69 (issue #182)", () => {
    expect(puedeVerRosterCompleto(ROLES.ADMINISTRADOR)).toBe(true);
    expect(puedeVerRosterCompleto(ROLES.JUNTA_DIRECTIVA)).toBe(true);

    expect(puedeVerRosterCompleto(ROLES.SOCIO_FUNDADOR)).toBe(false);
    expect(puedeVerRosterCompleto(ROLES.MEDICO)).toBe(false);
    expect(puedeVerRosterCompleto(ROLES.VOLUNTARIO)).toBe(false);
  });

  it("agrupa los permisos para que un hook no llame a las cinco por separado", () => {
    expect(permisosDeJornadas(ROLES.MEDICO)).toEqual({
      puedeVer: true,
      puedeCrear: false,
      puedeEditar: false,
      puedeReabrir: false,
      puedeVerHistorial: false,
    });

    expect(permisosDeJornadas(ROLES.ADMINISTRADOR)).toEqual({
      puedeVer: true,
      puedeCrear: true,
      puedeEditar: true,
      puedeReabrir: true,
      puedeVerHistorial: true,
    });
  });
});
