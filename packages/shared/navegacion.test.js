// Pruebas de modulosVisibles() para los cinco roles reales (issue #426).
//
// Se importan los modulos directamente, no el barril packages/shared/index.js: el barril
// arrastra @supabase/supabase-js y el modulo de entorno, y estas pruebas tienen que correr sin
// .env y sin conexion. Mismo patron que jornadas/permisos.test.js.

import { describe, expect, it } from "vitest";

import { MODULOS, modulosVisibles, puedeUsarAppMovil, tabsMoviles } from "./navegacion.js";
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
      "matriz-permisos",
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
      expect(ids).not.toContain("reportes");
      expect(ids).not.toContain("colaboradores");
      expect(ids).not.toContain("matriz-permisos");
      expect(ids).not.toContain("bitacora-auditoria");
    }
  });

  // ISSUE #864: el medico ve Proyectos -- solo los de las jornadas en las que participa, que lo
  // decide la politica de SELECT de `proyectos` de la 00141, no esta lista -- y el voluntario
  // general no. Es la unica diferencia de menu entre los dos roles de campo.
  it("proyectos: el medico si, el voluntario general no", () => {
    expect(idsDe(modulosVisibles(ROLES.MEDICO))).toContain("proyectos");
    expect(idsDe(modulosVisibles(ROLES.VOLUNTARIO))).not.toContain("proyectos");
  });

  // El caso central de la issue #426 era que junta directiva y socio fundador no vieran
  // informacion clinica ni pacientes identificables (00032), solo agregados.
  //
  // ISSUE #864 lo lleva hasta el final: los dos roles consultivos **solo ven Reportes**. Antes
  // veian ocho y siete modulos respectivamente -- donaciones, inventario, presupuestos,
  // proyectos, jornadas y, junta directiva, colaboradores --, que es gobernanza mirando la
  // operacion del dia. Inicio se queda porque es la ruta "/" y su rejilla ya se filtra sola.
  it("junta directiva y socio fundador solo ven Inicio y Reportes", () => {
    for (const rol of [ROLES.JUNTA_DIRECTIVA, ROLES.SOCIO_FUNDADOR]) {
      expect(idsDe(modulosVisibles(rol))).toEqual(["inicio", "reportes"]);
    }
  });

  // La issue #756 habia abierto esta pantalla a junta directiva, porque perfiles_directorio
  // (00038/00080) le daba una vista de solo lectura del personal y el guard la dejaba fuera.
  //
  // ISSUE #864 la cierra otra vez, y no por descuido: la issue dice "Junta directiva: solo ve
  // reportes". Se cierran las tres capas a la vez -- esta lista, puedeVerListadoUsuarios() y la
  // propia vista perfiles_directorio (00141) --, que es justo lo que la #756 pedia: que la ruta
  // y la vista digan lo mismo.
  it("colaboradores: solo administrador", () => {
    expect(idsDe(modulosVisibles(ROLES.ADMINISTRADOR))).toContain("colaboradores");
    for (const rol of [
      ROLES.JUNTA_DIRECTIVA,
      ROLES.SOCIO_FUNDADOR,
      ROLES.MEDICO,
      ROLES.VOLUNTARIO,
    ]) {
      expect(idsDe(modulosVisibles(rol))).not.toContain("colaboradores");
    }
  });

  // Issue #638: la matriz de permisos por rol cambia el default de acceso de TODO un rol -mas
  // grave que la excepcion individual de usuario_permiso-, asi que solo administrador entra,
  // ningun otro rol, ni siquiera los que ya ven pantallas administrativas como colaboradores.
  it("matriz de permisos por rol: solo administrador", () => {
    expect(idsDe(modulosVisibles(ROLES.ADMINISTRADOR))).toContain("matriz-permisos");
    for (const rol of [
      ROLES.JUNTA_DIRECTIVA,
      ROLES.SOCIO_FUNDADOR,
      ROLES.MEDICO,
      ROLES.VOLUNTARIO,
    ]) {
      expect(idsDe(modulosVisibles(rol))).not.toContain("matriz-permisos");
    }
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

  it("reportes no declara `movil`: no aparece en la plataforma movil, aunque el rol lo alcance", () => {
    const paraWeb = idsDe(modulosVisibles(ROLES.ADMINISTRADOR, { plataforma: "web" }));
    const paraMovil = idsDe(modulosVisibles(ROLES.ADMINISTRADOR, { plataforma: "mobile" }));

    expect(paraWeb).toContain("reportes");
    expect(paraMovil).not.toContain("reportes");
  });
});

describe("acceso a la app movil (issue #866)", () => {
  it("entran administrador, medico y colaborador; junta directiva y socio fundador no", () => {
    expect(puedeUsarAppMovil(ROLES.ADMINISTRADOR)).toBe(true);
    expect(puedeUsarAppMovil(ROLES.MEDICO)).toBe(true);
    expect(puedeUsarAppMovil(ROLES.VOLUNTARIO)).toBe(true);

    expect(puedeUsarAppMovil(ROLES.JUNTA_DIRECTIVA)).toBe(false);
    expect(puedeUsarAppMovil(ROLES.SOCIO_FUNDADOR)).toBe(false);
  });

  it("un rol sin acceso no recibe ningun modulo movil, aunque en web vea varios", () => {
    for (const rol of [ROLES.JUNTA_DIRECTIVA, ROLES.SOCIO_FUNDADOR]) {
      expect(idsDe(modulosVisibles(rol, { plataforma: "web" })).length).toBeGreaterThan(0);
      expect(modulosVisibles(rol, { plataforma: "mobile" })).toEqual([]);
      expect(tabsMoviles(rol)).toEqual([]);
    }
  });

  it("la app movil son cuatro modulos: inicio, pacientes, inventario y jornadas", () => {
    expect(idsDe(modulosVisibles(ROLES.ADMINISTRADOR, { plataforma: "mobile" }))).toEqual([
      "inicio",
      "pacientes",
      "inventario",
      "jornadas",
    ]);
  });

  it("ningun modulo marcado `movil` deja de tener una tab o una pantalla que lo dibuje", () => {
    for (const modulo of MODULOS.filter((m) => m.movil)) {
      expect(Boolean(modulo.tabMovil), `el modulo "${modulo.id}"`).toBe(true);
    }
  });

  it("todo modulo declara `movil` como booleano, para que ninguno quede sin decidir", () => {
    for (const modulo of MODULOS) {
      expect(typeof modulo.movil, `el modulo "${modulo.id}"`).toBe("boolean");
    }
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
