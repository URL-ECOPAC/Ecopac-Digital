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
  it("administrador y personal de campo registran y editan (00148); los consultivos no", () => {
    expect(puedeAdministrarMedicamentos(ROLES.ADMINISTRADOR)).toBe(true);
    expect(puedeAdministrarMedicamentos(ROLES.MEDICO)).toBe(true);
    expect(puedeAdministrarMedicamentos(ROLES.VOLUNTARIO)).toBe(true);

    expect(puedeAdministrarMedicamentos(ROLES.JUNTA_DIRECTIVA)).toBe(false);
    expect(puedeAdministrarMedicamentos(ROLES.SOCIO_FUNDADOR)).toBe(false);
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
    // Registra y edita, nunca desactiva: trigger impedir_desactivar_sin_ser_administrador (00148).
    expect(permisosDeMedicamentos(ROLES.MEDICO)).toEqual({
      puedeVer: true,
      puedeCrear: true,
      puedeEditar: true,
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
