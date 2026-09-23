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

  // ISSUE #864: socio fundador estaba fuera citando la guarda de la 00067, que la 00086 ya
  // habia reescrito a es_consultivo(). El cliente era mas estricto que el servidor y le escondia
  // un reporte que la base si le entrega. Se corrige el cliente; la base no se toca.
  it("administrador y los dos roles consultivos ven el reporte de pacientes (issue #864)", () => {
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
    // Los dos roles consultivos, identicos: cuatro de los cinco reportes. El de jornada no,
    // porque la 00054 les retiro el acceso a las tablas clinicas que agrega.
    //
    // `puedeVerReporteDeVencimientos` lo agrego la issue #862 al mezclar: el quinto reporte no
    // tenia guarda propia y el hook usaba la de los indicadores de impacto, que es otra regla.
    for (const rol of [ROLES.JUNTA_DIRECTIVA, ROLES.SOCIO_FUNDADOR]) {
      expect(permisosDeReportes(rol)).toEqual({
        puedeVerIndicadoresDeImpacto: true,
        puedeVerReporteDePacientes: true,
        puedeVerReporteJornada: false,
        puedeVerReporteDeInventario: true,
        puedeVerReporteDeVencimientos: true,
      });
    }

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
