// Pruebas de modulosVisibles() para los cinco roles reales (issue #426).
//
// Se importan los modulos directamente, no el barril packages/shared/index.js: el barril
// arrastra @supabase/supabase-js y el modulo de entorno, y estas pruebas tienen que correr sin
// .env y sin conexion. Mismo patron que jornadas/permisos.test.js.

import { describe, expect, it } from "vitest";

import { modulosVisibles, tabsMoviles } from "./navegacion.js";
import { ROLES } from "./usuarios/roles.js";

function idsDe(modulos) {
  return modulos.map((m) => m.id);
}

describe("modulosVisibles", () => {
  it("administrador ve los nueve modulos", () => {
    expect(idsDe(modulosVisibles(ROLES.ADMINISTRADOR))).toEqual([
      "inicio",
      "pacientes",
      "donaciones",
      "inventario",
      "presupuestos",
      "proyectos",
      "reportes",
      "jornadas",
      "voluntarios",
    ]);
  });

  it("medico y voluntario general ven pacientes, inventario y jornadas, no lo administrativo", () => {
    for (const rol of [ROLES.MEDICO, ROLES.VOLUNTARIO]) {
      const ids = idsDe(modulosVisibles(rol));
      expect(ids).toContain("pacientes");
      expect(ids).toContain("inventario");
      expect(ids).toContain("jornadas");

      expect(ids).not.toContain("donaciones");
      expect(ids).not.toContain("presupuestos");
      expect(ids).not.toContain("proyectos");
      expect(ids).not.toContain("reportes");
      expect(ids).not.toContain("voluntarios");
    }
  });

  // El caso central de la issue #426: junta directiva y socio fundador no ven informacion
  // clinica ni pacientes identificables (00032), solo agregados -- misma decision que #407 del
  // lado de la base de datos. Antes de este fix, OPERATIVOS los incluia y la RLS les devolvia
  // una pantalla vacia sin explicacion.
  it("junta directiva y socio fundador NO ven pacientes, pero si inventario y jornadas", () => {
    for (const rol of [ROLES.JUNTA_DIRECTIVA, ROLES.SOCIO_FUNDADOR]) {
      const ids = idsDe(modulosVisibles(rol));

      expect(ids).not.toContain("pacientes");

      expect(ids).toContain("inventario");
      expect(ids).toContain("jornadas");
      expect(ids).toContain("donaciones");
      expect(ids).toContain("presupuestos");
      expect(ids).toContain("proyectos");
      expect(ids).toContain("reportes");

      expect(ids).not.toContain("voluntarios");
    }
  });

  it("un rol desconocido no ve ningun modulo salvo los que no restringen roles", () => {
    expect(idsDe(modulosVisibles("coordinador"))).toEqual([]);
  });

  it("reportes es soloWeb: no aparece en la plataforma movil, aunque el rol lo alcance", () => {
    const paraWeb = idsDe(modulosVisibles(ROLES.ADMINISTRADOR, { plataforma: "web" }));
    const paraMovil = idsDe(modulosVisibles(ROLES.ADMINISTRADOR, { plataforma: "mobile" }));

    expect(paraWeb).toContain("reportes");
    expect(paraMovil).not.toContain("reportes");
  });
});

describe("tabsMoviles", () => {
  it("medico ve la tab de Pacientes; junta directiva no la ve", () => {
    expect(idsDe(tabsMoviles(ROLES.MEDICO))).toContain("pacientes");
    expect(idsDe(tabsMoviles(ROLES.JUNTA_DIRECTIVA))).not.toContain("pacientes");
  });
});
