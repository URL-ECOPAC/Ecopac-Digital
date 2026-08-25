// Pruebas de los permisos del catalogo de principios activos.
//
// Se importan los modulos directamente y no el barril packages/shared/index.js: el barril
// arrastra @supabase/supabase-js y el modulo de entorno, y estas pruebas tienen que correr sin
// .env y sin conexion. Las funciones de principios-activos.api.js se prueban aparte, en
// principios-activos.api.test.js, con el doble de obtenerSupabase() que ya establecio
// packages/shared/presupuestos/api.test.js.

import { describe, expect, it } from "vitest";

import { ROLES } from "../usuarios/roles.js";
import {
  permisosDePrincipiosActivos,
  puedeAdministrarPrincipiosActivos,
  puedeVerPrincipiosActivos,
} from "./principios-activos.permisos.js";

describe("permisos del catalogo de principios activos", () => {
  it("solo Administrador administra, como pide el criterio de aceptacion", () => {
    expect(puedeAdministrarPrincipiosActivos(ROLES.ADMINISTRADOR)).toBe(true);

    expect(puedeAdministrarPrincipiosActivos(ROLES.JUNTA_DIRECTIVA)).toBe(false);
    expect(puedeAdministrarPrincipiosActivos(ROLES.SOCIO_FUNDADOR)).toBe(false);
    expect(puedeAdministrarPrincipiosActivos(ROLES.MEDICO)).toBe(false);
    expect(puedeAdministrarPrincipiosActivos(ROLES.VOLUNTARIO)).toBe(false);
  });

  it("cualquier rol conocido puede ver el catalogo", () => {
    for (const rol of Object.values(ROLES)) {
      expect(puedeVerPrincipiosActivos(rol)).toBe(true);
    }
  });

  it("un rol que no existe no puede nada", () => {
    expect(permisosDePrincipiosActivos("coordinador")).toEqual({
      puedeVer: false,
      puedeCrear: false,
      puedeEditar: false,
      puedeEliminar: false,
    });
  });

  it("agrupa los permisos para que un hook no llame a las funciones sueltas", () => {
    expect(permisosDePrincipiosActivos(ROLES.MEDICO)).toEqual({
      puedeVer: true,
      puedeCrear: false,
      puedeEditar: false,
      puedeEliminar: false,
    });

    expect(permisosDePrincipiosActivos(ROLES.ADMINISTRADOR)).toEqual({
      puedeVer: true,
      puedeCrear: true,
      puedeEditar: true,
      puedeEliminar: true,
    });
  });
});
