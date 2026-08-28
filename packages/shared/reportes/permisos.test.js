// Pruebas de los permisos del modulo de reportes.
//
// Se importan los modulos directamente y no el barril packages/shared/index.js: el barril
// arrastra @supabase/supabase-js y el modulo de entorno, y estas pruebas tienen que correr sin
// .env y sin conexion. Mismo patron que jornadas/permisos.test.js.

import { describe, expect, it } from "vitest";

import { ROLES } from "../usuarios/roles.js";
import {
  permisosDeReportes,
  puedeVerIndicadoresDeImpacto,
  puedeVerReporteDePacientes,
} from "./permisos.js";

describe("permisos de reportes", () => {
  it("administrador y los dos consultivos ven los indicadores de impacto (vista_reporte_impacto, 00054)", () => {
    expect(puedeVerIndicadoresDeImpacto(ROLES.ADMINISTRADOR)).toBe(true);
    expect(puedeVerIndicadoresDeImpacto(ROLES.JUNTA_DIRECTIVA)).toBe(true);
    expect(puedeVerIndicadoresDeImpacto(ROLES.SOCIO_FUNDADOR)).toBe(true);

    expect(puedeVerIndicadoresDeImpacto(ROLES.MEDICO)).toBe(false);
    expect(puedeVerIndicadoresDeImpacto(ROLES.VOLUNTARIO)).toBe(false);
  });

  it("administrador y junta directiva ven el reporte de pacientes; socio fundador NO (00067, excepcion deliberada)", () => {
    expect(puedeVerReporteDePacientes(ROLES.ADMINISTRADOR)).toBe(true);
    expect(puedeVerReporteDePacientes(ROLES.JUNTA_DIRECTIVA)).toBe(true);

    expect(puedeVerReporteDePacientes(ROLES.SOCIO_FUNDADOR)).toBe(false);
    expect(puedeVerReporteDePacientes(ROLES.MEDICO)).toBe(false);
    expect(puedeVerReporteDePacientes(ROLES.VOLUNTARIO)).toBe(false);
  });

  it("un rol que no existe no puede nada", () => {
    expect(permisosDeReportes("coordinador")).toEqual({
      puedeVerIndicadoresDeImpacto: false,
      puedeVerReporteDePacientes: false,
    });
  });

  it("agrupa los permisos para que un hook no llame a las funciones sueltas", () => {
    expect(permisosDeReportes(ROLES.SOCIO_FUNDADOR)).toEqual({
      puedeVerIndicadoresDeImpacto: true,
      puedeVerReporteDePacientes: false,
    });

    expect(permisosDeReportes(ROLES.ADMINISTRADOR)).toEqual({
      puedeVerIndicadoresDeImpacto: true,
      puedeVerReporteDePacientes: true,
    });
  });
});
