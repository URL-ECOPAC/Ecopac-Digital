// Pruebas de los permisos del catalogo de medicamentos.
//
// Se importan los modulos directamente y no el barril packages/shared/index.js: el barril
// arrastra @supabase/supabase-js y el modulo de entorno, y estas pruebas tienen que correr sin
// .env y sin conexion. Las funciones de medicamentos.api.js se prueban aparte, en
// medicamentos.api.test.js, con el doble de obtenerSupabase() que ya establecio
// packages/shared/presupuestos/api.test.js.

import { describe, expect, it } from "vitest";

import { ROLES } from "../usuarios/roles.js";
import {
  permisosDeMedicamentos,
  puedeAdministrarMedicamentos,
  puedeVerMedicamentos,
} from "./medicamentos.permisos.js";

describe("permisos del catalogo de medicamentos", () => {
  it("solo Administrador administra (registra, edita, desactiva)", () => {
    expect(puedeAdministrarMedicamentos(ROLES.ADMINISTRADOR)).toBe(true);

    expect(puedeAdministrarMedicamentos(ROLES.JUNTA_DIRECTIVA)).toBe(false);
    expect(puedeAdministrarMedicamentos(ROLES.SOCIO_FUNDADOR)).toBe(false);
    expect(puedeAdministrarMedicamentos(ROLES.MEDICO)).toBe(false);
    expect(puedeAdministrarMedicamentos(ROLES.VOLUNTARIO)).toBe(false);
  });

  it("cualquier rol conocido puede ver el catalogo", () => {
    for (const rol of Object.values(ROLES)) {
      expect(puedeVerMedicamentos(rol)).toBe(true);
    }
  });

  it("un rol que no existe no puede nada", () => {
    expect(permisosDeMedicamentos("coordinador")).toEqual({
      puedeVer: false,
      puedeCrear: false,
      puedeEditar: false,
      puedeEliminar: false,
    });
  });

  it("agrupa los permisos para que un hook no llame a las funciones sueltas", () => {
    expect(permisosDeMedicamentos(ROLES.MEDICO)).toEqual({
      puedeVer: true,
      puedeCrear: false,
      puedeEditar: false,
      puedeEliminar: false,
    });

    expect(permisosDeMedicamentos(ROLES.ADMINISTRADOR)).toEqual({
      puedeVer: true,
      puedeCrear: true,
      puedeEditar: true,
      puedeEliminar: true,
    });
  });
});
