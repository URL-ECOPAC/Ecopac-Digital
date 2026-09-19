// Pruebas de modulosVisibles() para los cinco roles reales (issue #426).
//
// Se importan los modulos directamente, no el barril packages/shared/index.js: el barril
// arrastra @supabase/supabase-js y el modulo de entorno, y estas pruebas tienen que correr sin
// .env y sin conexion. Mismo patron que jornadas/permisos.test.js.

import { describe, expect, it } from "vitest";

import { MODULOS, modulosVisibles, tabsMoviles } from "./navegacion.js";
import { ROLES } from "./usuarios/roles.js";

function idsDe(modulos) {
  return modulos.map((m) => m.id);
}

describe("modulosVisibles", () => {
  it("administrador ve los diez modulos", () => {
    expect(idsDe(modulosVisibles(ROLES.ADMINISTRADOR))).toEqual([
      "inicio",
      "pacientes",
      "donaciones",
      "inventario",
      "presupuestos",
      "proyectos",
      "reportes",
      "jornadas",
      "colaboradores",
      "bitacora-auditoria",
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
      expect(ids).not.toContain("colaboradores");
      expect(ids).not.toContain("bitacora-auditoria");
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
      expect(ids).not.toContain("bitacora-auditoria");
    }
  });

  // Issue #756: perfiles_directorio (00038/00080) da a junta directiva -y solo a junta
  // directiva, no a socio fundador- una vista de solo lectura del personal, sin datos de
  // contacto ajenos. La ruta tiene que reflejar exactamente esa misma linea, o la vista queda
  // sin ninguna forma de llegar a ella.
  it("colaboradores: solo administrador y junta directiva, no socio fundador", () => {
    expect(idsDe(modulosVisibles(ROLES.ADMINISTRADOR))).toContain("colaboradores");
    expect(idsDe(modulosVisibles(ROLES.JUNTA_DIRECTIVA))).toContain("colaboradores");
    expect(idsDe(modulosVisibles(ROLES.SOCIO_FUNDADOR))).not.toContain("colaboradores");
  });

  // Issue #643: la bitacora de auditoria expone valoresAnteriores/valoresNuevos de tablas con
  // datos de pacientes -- solo administrador puede verla, ningun otro rol, ni siquiera los que
  // ya ven informacion administrativa como junta directiva.
  it("bitacora de auditoria: solo administrador", () => {
    expect(idsDe(modulosVisibles(ROLES.ADMINISTRADOR))).toContain("bitacora-auditoria");
    for (const rol of [
      ROLES.JUNTA_DIRECTIVA,
      ROLES.SOCIO_FUNDADOR,
      ROLES.MEDICO,
      ROLES.VOLUNTARIO,
    ]) {
      expect(idsDe(modulosVisibles(rol))).not.toContain("bitacora-auditoria");
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

// La guarda del defecto que arreglo la issue #700: navegacion.js declaraba ROLES.FARMACEUTICO y
// ROLES.ENFERMERO, dos claves que usuarios/roles.js nunca tuvo -- ese archivo replica el enum
// rol_usuario de la 00001, que son cinco valores y ninguno es esos dos--. El resultado eran dos
// `undefined` dentro del array `roles` de pacientes y de inventario.
//
// No rompia la autorizacion, porque ningun perfil tiene rol `undefined` y quien protege de verdad
// es RLS. Lo que rompia es lo que este archivo pretende ser: la declaracion de quien ve que. Un
// rol mal escrito aqui se lee como si el modulo estuviera abierto a alguien que no existe, y nada
// lo desmentia.
describe("los roles que declara cada modulo", () => {
  it("ningun modulo declara un rol que no exista en ROLES", () => {
    const validos = Object.values(ROLES);

    for (const modulo of MODULOS) {
      for (const rol of modulo.roles) {
        expect(validos, `el modulo "${modulo.id}" declara un rol que no existe`).toContain(rol);
      }
    }
  });

  it("y ninguno declara undefined, que es como se veia el defecto", () => {
    for (const modulo of MODULOS) {
      expect(modulo.roles, `el modulo "${modulo.id}"`).not.toContain(undefined);
    }
  });
});
