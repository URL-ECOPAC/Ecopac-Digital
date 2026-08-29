// Pruebas de los permisos del modulo de proyectos.
//
// Se importan los modulos directamente y no el barril packages/shared/index.js: el barril
// arrastra @supabase/supabase-js y el modulo de entorno, y estas pruebas tienen que correr sin
// .env y sin conexion. Mismo patron que jornadas/permisos.test.js.

import { describe, expect, it } from "vitest";

import { ROLES } from "../usuarios/roles.js";
import {
  permisosDeProyectos,
  puedeAdministrarProyectos,
  puedeVerProyectos,
} from "./permisos.js";

describe("permisos de proyectos", () => {
  it("solo Administrador administra, espejo de la politica de proyectos (00039)", () => {
    expect(puedeAdministrarProyectos(ROLES.ADMINISTRADOR)).toBe(true);

    expect(puedeAdministrarProyectos(ROLES.JUNTA_DIRECTIVA)).toBe(false);
    expect(puedeAdministrarProyectos(ROLES.SOCIO_FUNDADOR)).toBe(false);
    expect(puedeAdministrarProyectos(ROLES.MEDICO)).toBe(false);
    expect(puedeAdministrarProyectos(ROLES.VOLUNTARIO)).toBe(false);
  });

  it("administrador y los dos roles consultivos ven proyectos; medico y voluntario no, espejo de la 00080", () => {
    expect(puedeVerProyectos(ROLES.ADMINISTRADOR)).toBe(true);
    expect(puedeVerProyectos(ROLES.JUNTA_DIRECTIVA)).toBe(true);
    expect(puedeVerProyectos(ROLES.SOCIO_FUNDADOR)).toBe(true);

    expect(puedeVerProyectos(ROLES.MEDICO)).toBe(false);
    expect(puedeVerProyectos(ROLES.VOLUNTARIO)).toBe(false);
  });

  it("un rol que no existe no puede nada", () => {
    expect(permisosDeProyectos("coordinador")).toEqual({
      puedeVer: false,
      puedeCrear: false,
      puedeEditar: false,
      puedeCambiarEstado: false,
      puedeAsociarJornadas: false,
    });
  });

  it("agrupa los permisos para que un hook no llame a las funciones sueltas", () => {
    expect(permisosDeProyectos(ROLES.JUNTA_DIRECTIVA)).toEqual({
      puedeVer: true,
      puedeCrear: false,
      puedeEditar: false,
      puedeCambiarEstado: false,
      puedeAsociarJornadas: false,
    });

    // socio fundador es identico a junta directiva: los dos son roles consultivos (00080).
    expect(permisosDeProyectos(ROLES.SOCIO_FUNDADOR)).toEqual({
      puedeVer: true,
      puedeCrear: false,
      puedeEditar: false,
      puedeCambiarEstado: false,
      puedeAsociarJornadas: false,
    });

    expect(permisosDeProyectos(ROLES.ADMINISTRADOR)).toEqual({
      puedeVer: true,
      puedeCrear: true,
      puedeEditar: true,
      puedeCambiarEstado: true,
      puedeAsociarJornadas: true,
    });

    expect(permisosDeProyectos(ROLES.MEDICO)).toEqual({
      puedeVer: false,
      puedeCrear: false,
      puedeEditar: false,
      puedeCambiarEstado: false,
      puedeAsociarJornadas: false,
    });
  });
});
