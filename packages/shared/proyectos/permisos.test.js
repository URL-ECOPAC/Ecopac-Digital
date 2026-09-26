// Pruebas de los permisos del modulo de proyectos.
//
// Se importan los modulos directamente y no el barril packages/shared/index.js: el barril
// arrastra @supabase/supabase-js y el modulo de entorno, y estas pruebas tienen que correr sin
// .env y sin conexion. Mismo patron que jornadas/permisos.test.js.

import { afterEach, describe, expect, it } from "vitest";

import { fijarAccesoDeSesion, limpiarAccesoDeSesion } from "../usuarios/acceso.js";
import { ROLES } from "../usuarios/roles.js";
import {
  permisosDeProyectos,
  puedeAdministrarProyectos,
  puedeVerInsumosYGastosDeProyecto,
  puedeVerProyectos,
  puedeVerSeguimientoProyecto,
} from "./permisos.js";

const NADA = {
  puedeVer: false,
  puedeCrear: false,
  puedeEditar: false,
  puedeCambiarEstado: false,
  puedeAsociarJornadas: false,
  puedeGestionarEquipo: false,
  puedeGestionarInsumos: false,
  puedeVerInsumosYGastos: false,
  puedeVerHistorial: false,
  puedeVerSeguimiento: false,
};

afterEach(() => {
  limpiarAccesoDeSesion();
});

describe("permisos de proyectos", () => {
  it("solo Administrador administra por defecto, espejo de la politica de proyectos (00039)", () => {
    expect(puedeAdministrarProyectos(ROLES.ADMINISTRADOR)).toBe(true);

    for (const rol of [
      ROLES.JUNTA_DIRECTIVA,
      ROLES.SOCIO_FUNDADOR,
      ROLES.MEDICO,
      ROLES.VOLUNTARIO,
    ]) {
      expect(puedeAdministrarProyectos(rol)).toBe(false);
    }
  });

  // 00148: medico y colaborador ven los proyectos a los que pertenecen (las filas las elige
  // pertenece_a_proyecto() en la base). Los consultivos no, salvo que la matriz se los abra.
  it("administrador y personal de campo ven proyectos; los consultivos no", () => {
    for (const rol of [ROLES.ADMINISTRADOR, ROLES.MEDICO, ROLES.VOLUNTARIO]) {
      expect(puedeVerProyectos(rol)).toBe(true);
    }
    expect(puedeVerProyectos(ROLES.JUNTA_DIRECTIVA)).toBe(false);
    expect(puedeVerProyectos(ROLES.SOCIO_FUNDADOR)).toBe(false);
  });

  it("el personal de campo no ve dinero ni seguimiento: su detalle es de consulta", () => {
    for (const rol of [ROLES.MEDICO, ROLES.VOLUNTARIO]) {
      expect(puedeVerInsumosYGastosDeProyecto(rol)).toBe(false);
      expect(puedeVerSeguimientoProyecto(rol)).toBe(false);
    }
    expect(puedeVerInsumosYGastosDeProyecto(ROLES.ADMINISTRADOR)).toBe(true);
    expect(puedeVerSeguimientoProyecto(ROLES.ADMINISTRADOR)).toBe(true);
  });

  it("con proyectos.gestionar delegado, el medico administra el proyecto entero", () => {
    fijarAccesoDeSesion({ rol: ROLES.MEDICO, permisos: ["proyectos.gestionar"] });

    expect(permisosDeProyectos(ROLES.MEDICO)).toEqual({
      puedeVer: true,
      puedeCrear: true,
      puedeEditar: true,
      puedeCambiarEstado: true,
      puedeAsociarJornadas: true,
      puedeGestionarEquipo: true,
      puedeGestionarInsumos: true,
      puedeVerInsumosYGastos: true,
      puedeVerHistorial: true,
      puedeVerSeguimiento: true,
    });
  });

  it("con Proyectos abierto por la matriz, un rol consultivo lo ve entero sin tocar nada", () => {
    fijarAccesoDeSesion({ rol: ROLES.JUNTA_DIRECTIVA, modulos: ["proyectos"] });

    expect(permisosDeProyectos(ROLES.JUNTA_DIRECTIVA)).toEqual({
      ...NADA,
      puedeVer: true,
      puedeVerInsumosYGastos: true,
      puedeVerHistorial: true,
      puedeVerSeguimiento: true,
    });
  });

  it("un rol que no existe no puede nada", () => {
    expect(permisosDeProyectos("coordinador")).toEqual(NADA);
  });

  it("agrupa los permisos para que un hook no llame a las funciones sueltas", () => {
    // socio fundador es identico a junta directiva: los dos son roles consultivos (00080).
    for (const rol of [ROLES.JUNTA_DIRECTIVA, ROLES.SOCIO_FUNDADOR]) {
      expect(permisosDeProyectos(rol)).toEqual(NADA);
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
      puedeVerSeguimiento: true,
    });

    // El personal de campo entra a la pantalla y no puede tocar nada: ni crear, ni editar, ni ver
    // el dinero ni el seguimiento. Solo mirar los proyectos a los que pertenece.
    for (const rol of [ROLES.MEDICO, ROLES.VOLUNTARIO]) {
      expect(permisosDeProyectos(rol)).toEqual({ ...NADA, puedeVer: true });
    }
  });
});
