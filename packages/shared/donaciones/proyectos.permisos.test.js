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
} from "./proyectos.permisos.js";

describe("permisos de proyectos", () => {
  it("solo Administrador administra, espejo de la politica de proyectos (00039)", () => {
    expect(puedeAdministrarProyectos(ROLES.ADMINISTRADOR)).toBe(true);

    expect(puedeAdministrarProyectos(ROLES.JUNTA_DIRECTIVA)).toBe(false);
    expect(puedeAdministrarProyectos(ROLES.SOCIO_FUNDADOR)).toBe(false);
    expect(puedeAdministrarProyectos(ROLES.MEDICO)).toBe(false);
    expect(puedeAdministrarProyectos(ROLES.VOLUNTARIO)).toBe(false);
  });

  it("cualquier rol conocido puede ver los proyectos", () => {
    for (const rol of Object.values(ROLES)) {
      expect(puedeVerProyectos(rol)).toBe(true);
    }
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

    expect(permisosDeProyectos(ROLES.ADMINISTRADOR)).toEqual({
      puedeVer: true,
      puedeCrear: true,
      puedeEditar: true,
      puedeCambiarEstado: true,
      puedeAsociarJornadas: true,
    });
  });
});
