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
  puedeVerReporteDeVencimientos,
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

  // ISSUE #862. Este caso afirmaba lo contrario -que socio fundador NO podia, "excepcion
  // deliberada" de la 00067- y era una afirmacion caduca: esa guarda desaparecio en la 00080 y la
  // vigente (00132) es es_administrador() OR es_consultivo() OR tiene_permiso('reportes.exportar').
  // El cliente le negaba una pestana que el servidor le concede.
  it("administrador y los DOS consultivos ven el reporte de pacientes (00132)", () => {
    expect(puedeVerReporteDePacientes(ROLES.ADMINISTRADOR)).toBe(true);
    expect(puedeVerReporteDePacientes(ROLES.JUNTA_DIRECTIVA)).toBe(true);
    expect(puedeVerReporteDePacientes(ROLES.SOCIO_FUNDADOR)).toBe(true);

    expect(puedeVerReporteDePacientes(ROLES.MEDICO)).toBe(false);
    expect(puedeVerReporteDePacientes(ROLES.VOLUNTARIO)).toBe(false);
  });

  it("un rol que no existe no puede nada", () => {
    expect(permisosDeReportes("coordinador")).toEqual({
      puedeVerIndicadoresDeImpacto: false,
      puedeVerReporteDePacientes: false,
      puedeVerReporteJornada: false,
      puedeVerReporteDeInventario: false,
      puedeVerReporteDeVencimientos: false,
    });
  });

  it("agrupa los permisos para que un hook no llame a las funciones sueltas", () => {
    expect(permisosDeReportes(ROLES.SOCIO_FUNDADOR)).toEqual({
      puedeVerIndicadoresDeImpacto: true,
      puedeVerReporteDePacientes: true,
      // La 00054 le retiro el acceso a las tablas clinicas que agrega el reporte de jornada.
      puedeVerReporteJornada: false,
      puedeVerReporteDeInventario: true,
      puedeVerReporteDeVencimientos: true,
    });

    expect(permisosDeReportes(ROLES.ADMINISTRADOR)).toEqual({
      puedeVerIndicadoresDeImpacto: true,
      puedeVerReporteDePacientes: true,
      puedeVerReporteJornada: true,
      puedeVerReporteDeInventario: true,
      puedeVerReporteDeVencimientos: true,
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

  // ISSUE #862. useReporteMedicamentosPorVencer usaba puedeVerIndicadoresDeImpacto, la regla de
  // la vista agregada, que es mas estrecha y describe otro reporte. Este lee existencias, lotes y
  // medicamentos, igual que el de inventario.
  describe("reporte de medicamentos por vencer", () => {
    it("misma regla que el reporte de inventario: cualquier rol conocido", () => {
      for (const rol of Object.values(ROLES)) {
        expect(puedeVerReporteDeVencimientos(rol)).toBe(true);
      }
    });

    it("no lo ve quien no trae un rol del enum", () => {
      expect(puedeVerReporteDeVencimientos(undefined)).toBe(false);
      expect(puedeVerReporteDeVencimientos("coordinador")).toBe(false);
    });

    it("no hereda la restriccion de los indicadores de impacto", () => {
      expect(puedeVerIndicadoresDeImpacto(ROLES.MEDICO)).toBe(false);
      expect(puedeVerReporteDeVencimientos(ROLES.MEDICO)).toBe(true);
    });
  });
});
