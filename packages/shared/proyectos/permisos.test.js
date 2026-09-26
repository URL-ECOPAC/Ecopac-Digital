// Pruebas de los permisos del modulo de proyectos.
//
// Se importan los modulos directamente y no el barril packages/shared/index.js: el barril
// arrastra @supabase/supabase-js y el modulo de entorno, y estas pruebas tienen que correr sin
// .env y sin conexion. Mismo patron que jornadas/permisos.test.js.

import { describe, expect, it } from "vitest";

import { ROLES } from "../usuarios/roles.js";
import {
  permisosDeProyectos,
  puedeAdministrarProyectos,
  puedeVerInsumosYGastosDeProyecto,
  puedeVerProyectos,
} from "./permisos.js";

describe("permisos de proyectos", () => {
  it("solo Administrador administra, espejo de la politica de proyectos (00039)", () => {
    expect(puedeAdministrarProyectos(ROLES.ADMINISTRADOR)).toBe(true);

    expect(puedeAdministrarProyectos(ROLES.JUNTA_DIRECTIVA)).toBe(false);
    expect(puedeAdministrarProyectos(ROLES.SOCIO_FUNDADOR)).toBe(false);
    expect(puedeAdministrarProyectos(ROLES.MEDICO)).toBe(false);
    expect(puedeAdministrarProyectos(ROLES.VOLUNTARIO)).toBe(false);
  });

  // ISSUE #864, y es el reves de lo que decia antes: los dos roles consultivos leian proyectos
  // por la 00080 y ahora no -- su unica pantalla es Reportes --, y el medico, que no leia
  // ninguno, pasa a ver los de las jornadas en las que participa (politica de SELECT de la
  // 00141). Que sean SOLO esos no lo decide esta funcion: las filas las elige la base.
  it("administrador y medico ven proyectos; los consultivos y el voluntario no (issue #864)", () => {
    expect(puedeVerProyectos(ROLES.ADMINISTRADOR)).toBe(true);
    expect(puedeVerProyectos(ROLES.MEDICO)).toBe(true);

    expect(puedeVerProyectos(ROLES.JUNTA_DIRECTIVA)).toBe(false);
    expect(puedeVerProyectos(ROLES.SOCIO_FUNDADOR)).toBe(false);
    expect(puedeVerProyectos(ROLES.VOLUNTARIO)).toBe(false);
  });

  // El medico ve el proyecto de su jornada, pero no lo que costo (criterio 6 de la #864).
  it("solo administrador ve los insumos y los gastos de un proyecto", () => {
    expect(puedeVerInsumosYGastosDeProyecto(ROLES.ADMINISTRADOR)).toBe(true);

    for (const rol of [
      ROLES.JUNTA_DIRECTIVA,
      ROLES.SOCIO_FUNDADOR,
      ROLES.MEDICO,
      ROLES.VOLUNTARIO,
    ]) {
      expect(puedeVerInsumosYGastosDeProyecto(rol)).toBe(false);
    }
  });

  it("un rol que no existe no puede nada", () => {
    expect(permisosDeProyectos("coordinador")).toEqual({
      puedeVer: false,
      puedeCrear: false,
      puedeEditar: false,
      puedeCambiarEstado: false,
      puedeAsociarJornadas: false,
      puedeGestionarEquipo: false,
      puedeGestionarInsumos: false,
      puedeVerInsumosYGastos: false,
      puedeVerHistorial: false,
    });
  });

  it("agrupa los permisos para que un hook no llame a las funciones sueltas", () => {
    // socio fundador es identico a junta directiva: los dos son roles consultivos (00080).
    for (const rol of [ROLES.JUNTA_DIRECTIVA, ROLES.SOCIO_FUNDADOR, ROLES.VOLUNTARIO]) {
      expect(permisosDeProyectos(rol)).toEqual({
        puedeVer: false,
        puedeCrear: false,
        puedeEditar: false,
        puedeCambiarEstado: false,
        puedeAsociarJornadas: false,
        puedeGestionarEquipo: false,
        puedeGestionarInsumos: false,
        puedeVerInsumosYGastos: false,
        puedeVerHistorial: false,
      });
    }

    expect(permisosDeProyectos(ROLES.ADMINISTRADOR)).toEqual({
      puedeVer: true,
      puedeCrear: true,
      puedeEditar: true,
      puedeCambiarEstado: true,
      puedeAsociarJornadas: true,
      puedeGestionarEquipo: true,
      puedeGestionarInsumos: true,
      puedeVerInsumosYGastos: true,
      puedeVerHistorial: true,
    });

    // El medico entra a la pantalla y no puede tocar nada: ni crear, ni editar, ni ver el
    // dinero. Solo mirar el proyecto de la jornada en la que esta.
    expect(permisosDeProyectos(ROLES.MEDICO)).toEqual({
      puedeVer: true,
      puedeCrear: false,
      puedeEditar: false,
      puedeCambiarEstado: false,
      puedeAsociarJornadas: false,
      puedeGestionarEquipo: false,
      puedeGestionarInsumos: false,
      puedeVerInsumosYGastos: false,
      puedeVerHistorial: false,
    });
  });
});
