// Pruebas de que cada rol ve los destinos que le tocan en la app movil (issue #702).
//
// La tab bar y el menu de la app se dibujan desde tabsMoviles()/modulosVisibles(), en
// packages/shared/navegacion.js. Esas funciones ya se prueban alli como funciones puras; lo que
// se fija aqui es el contrato del que depende ESTA app: que los nombres de ruta de ROUTES existan
// para los destinos que cada rol puede ver, y que "Reportes" -- que es soloWeb -- no se cuele.
//
// Es una prueba de la navegacion, no del control de acceso: ocultar una opcion del menu no
// protege nada, quien protege es RLS. Que la opcion no aparezca es lo unico que se afirma.

import { modulosVisibles, ROLES, tabsMoviles } from "@ecopac/shared";

import { ROUTES } from "./rutas";

describe("tabs de la app movil por rol", () => {
  it("todos los roles reciben tabs, y ninguna se queda sin nombre en ROUTES", () => {
    const nombresDeRuta = Object.values(ROUTES);

    for (const rol of Object.values(ROLES)) {
      const tabs = tabsMoviles(rol);
      expect(tabs.length).toBeGreaterThan(0);

      for (const tab of tabs) {
        expect(nombresDeRuta).toContain(tab.tabMovil);
      }
    }
  });

  it("el administrador ve las cinco tabs del diseno", () => {
    const tabs = tabsMoviles(ROLES.ADMINISTRADOR).map((t) => t.tabMovil);

    expect(tabs).toEqual([
      ROUTES.TAB_INICIO,
      ROUTES.TAB_PACIENTES,
      ROUTES.TAB_INVENTARIO,
      ROUTES.TAB_JORNADAS,
    ]);
  });

  it("el voluntario ve pacientes, inventario y jornadas, pero no voluntarios", () => {
    const modulos = modulosVisibles(ROLES.VOLUNTARIO, { plataforma: "mobile" }).map((m) => m.id);

    expect(modulos).toContain("pacientes");
    expect(modulos).toContain("inventario");
    expect(modulos).toContain("jornadas");
    expect(modulos).not.toContain("voluntarios");
  });

  it("los roles consultivos no ven pacientes en el movil", () => {
    // Es la decision de la organizacion que documenta navegacion.js y hace cumplir la 00032:
    // junta directiva y socio fundador ven agregados, no informacion clinica.
    for (const rol of [ROLES.JUNTA_DIRECTIVA, ROLES.SOCIO_FUNDADOR]) {
      const modulos = modulosVisibles(rol, { plataforma: "mobile" }).map((m) => m.id);
      expect(modulos).not.toContain("pacientes");
    }
  });

  it("reportes no aparece en el movil para ningun rol: es soloWeb", () => {
    for (const rol of Object.values(ROLES)) {
      const modulos = modulosVisibles(rol, { plataforma: "mobile" }).map((m) => m.id);
      expect(modulos).not.toContain("reportes");
    }
  });
});
