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
  puedeVerReporteDeInventario,
  puedeVerReporteDePacientes,
  puedeVerReporteJornada,
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
      puedeVerReporteJornada: false,
      puedeVerReporteDeInventario: false,
    });
  });

  it("agrupa los permisos para que un hook no llame a las funciones sueltas", () => {
    expect(permisosDeReportes(ROLES.SOCIO_FUNDADOR)).toEqual({
      puedeVerIndicadoresDeImpacto: true,
      puedeVerReporteDePacientes: false,
      // La 00054 le retiro el acceso a las tablas clinicas que agrega el reporte de jornada.
      puedeVerReporteJornada: false,
      puedeVerReporteDeInventario: true,
    });

    expect(permisosDeReportes(ROLES.ADMINISTRADOR)).toEqual({
      puedeVerIndicadoresDeImpacto: true,
      puedeVerReporteDePacientes: true,
      puedeVerReporteJornada: true,
      puedeVerReporteDeInventario: true,
    });
  });

  // Las dos guardas que agrego la issue #693 al conectar los cuatro reportes a su API.
  describe("reporte de jornada", () => {
    it("lo ven administrador y medico, que son quienes leen las tablas clinicas (00033)", () => {
      expect(puedeVerReporteJornada(ROLES.ADMINISTRADOR)).toBe(true);
      expect(puedeVerReporteJornada(ROLES.MEDICO)).toBe(true);
    });

    it("no lo ven los roles consultivos ni el voluntario", () => {
      expect(puedeVerReporteJornada(ROLES.JUNTA_DIRECTIVA)).toBe(false);
      expect(puedeVerReporteJornada(ROLES.SOCIO_FUNDADOR)).toBe(false);
      expect(puedeVerReporteJornada(ROLES.VOLUNTARIO)).toBe(false);
    });
  });

  describe("reporte de inventario", () => {
    it("lo ve cualquier rol conocido: la politica de existencias es de sesion activa", () => {
      for (const rol of Object.values(ROLES)) {
        expect(puedeVerReporteDeInventario(rol)).toBe(true);
      }
    });

    it("no lo ve quien no trae un rol del enum", () => {
      expect(puedeVerReporteDeInventario(undefined)).toBe(false);
      expect(puedeVerReporteDeInventario("coordinador")).toBe(false);
    });
  });
});
