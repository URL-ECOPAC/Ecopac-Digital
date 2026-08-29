// Pruebas de los permisos del modulo de pacientes.
//
// Se importan los modulos directamente y no el barril packages/shared/index.js: el barril
// arrastra @supabase/supabase-js y el modulo de entorno, y estas pruebas tienen que correr sin
// .env y sin conexion. Mismo patron que jornadas/permisos.test.js.

import { describe, expect, it } from "vitest";

import { ROLES } from "../usuarios/roles.js";
import {
  permisosDePacientes,
  puedeAnularReceta,
  puedeCorregirTriaje,
  puedeCrearExpediente,
  puedeEditarExpediente,
  puedeEditarPaciente,
  puedeRegistrarPaciente,
  puedeTomarTriaje,
  puedeVerExpedientes,
  puedeVerHistorial,
  puedeVerPacientes,
} from "./permisos.js";

describe("permisos de pacientes y expedientes", () => {
  it("administrador, medico y voluntario ven y registran pacientes (00032)", () => {
    for (const rol of [ROLES.ADMINISTRADOR, ROLES.MEDICO, ROLES.VOLUNTARIO]) {
      expect(puedeVerPacientes(rol)).toBe(true);
      expect(puedeRegistrarPaciente(rol)).toBe(true);
      expect(puedeVerExpedientes(rol)).toBe(true);
      expect(puedeCrearExpediente(rol)).toBe(true);
    }

    expect(puedeVerPacientes(ROLES.JUNTA_DIRECTIVA)).toBe(false);
    expect(puedeVerPacientes(ROLES.SOCIO_FUNDADOR)).toBe(false);
  });

  it("solo administrador y medico editan pacientes y expedientes", () => {
    expect(puedeEditarPaciente(ROLES.ADMINISTRADOR)).toBe(true);
    expect(puedeEditarPaciente(ROLES.MEDICO)).toBe(true);

    expect(puedeEditarPaciente(ROLES.VOLUNTARIO)).toBe(false);
    expect(puedeEditarPaciente(ROLES.JUNTA_DIRECTIVA)).toBe(false);
    expect(puedeEditarPaciente(ROLES.SOCIO_FUNDADOR)).toBe(false);

    expect(puedeEditarExpediente(ROLES.ADMINISTRADOR)).toBe(true);
    expect(puedeEditarExpediente(ROLES.MEDICO)).toBe(true);
    expect(puedeEditarExpediente(ROLES.VOLUNTARIO)).toBe(false);
  });

  it("solo administrador y medico ven el historial clinico (00033)", () => {
    expect(puedeVerHistorial(ROLES.ADMINISTRADOR)).toBe(true);
    expect(puedeVerHistorial(ROLES.MEDICO)).toBe(true);

    expect(puedeVerHistorial(ROLES.VOLUNTARIO)).toBe(false);
    expect(puedeVerHistorial(ROLES.JUNTA_DIRECTIVA)).toBe(false);
    expect(puedeVerHistorial(ROLES.SOCIO_FUNDADOR)).toBe(false);
  });

  it("administrador, medico y voluntario toman triaje; solo administrador y medico lo corrigen", () => {
    for (const rol of [ROLES.ADMINISTRADOR, ROLES.MEDICO, ROLES.VOLUNTARIO]) {
      expect(puedeTomarTriaje(rol)).toBe(true);
    }

    expect(puedeCorregirTriaje(ROLES.ADMINISTRADOR)).toBe(true);
    expect(puedeCorregirTriaje(ROLES.MEDICO)).toBe(true);
    expect(puedeCorregirTriaje(ROLES.VOLUNTARIO)).toBe(false);
    expect(puedeCorregirTriaje(ROLES.JUNTA_DIRECTIVA)).toBe(false);
    expect(puedeCorregirTriaje(ROLES.SOCIO_FUNDADOR)).toBe(false);
  });

  it("un rol que no existe no puede nada", () => {
    expect(permisosDePacientes("coordinador")).toEqual({
      puedeVer: false,
      puedeCrear: false,
      puedeEditar: false,
      puedeVerHistorial: false,
      puedeTomarTriaje: false,
      puedeCorregirTriaje: false,
    });
  });

  it("no arrastra configuracion: importar permisos.js no exige entorno ni conexion", async () => {
    // permisos.js importa ESTADOS_RECETA de recetas.api.js, que a su vez llega a
    // @supabase/supabase-js. Es seguro porque obtenerSupabase() crea el cliente al llamarlo, no
    // al importar el modulo; esta prueba lo fija para que nadie convierta eso en efecto de
    // importacion sin enterarse.
    await expect(import("./permisos.js")).resolves.toBeTruthy();
  });

  it("agrupa los permisos para que un hook no llame a las funciones sueltas", () => {
    expect(permisosDePacientes(ROLES.VOLUNTARIO)).toEqual({
      puedeVer: true,
      puedeCrear: true,
      puedeEditar: false,
      puedeVerHistorial: false,
      puedeTomarTriaje: true,
      puedeCorregirTriaje: false,
    });

    expect(permisosDePacientes(ROLES.ADMINISTRADOR)).toEqual({
      puedeVer: true,
      puedeCrear: true,
      puedeEditar: true,
      puedeVerHistorial: true,
      puedeTomarTriaje: true,
      puedeCorregirTriaje: true,
    });
  });
});

describe("puedeAnularReceta", () => {
  const RECETA_PROPIA_EMITIDA = { medicoId: "per-medico", estado: "emitida" };

  it("el medico anula la receta que el firmo mientras siga emitida", () => {
    expect(puedeAnularReceta(ROLES.MEDICO, RECETA_PROPIA_EMITIDA, "per-medico")).toBe(true);
  });

  it("no anula la receta de otro medico: es el bug de la issue #510", () => {
    const ajena = { medicoId: "per-otro", estado: "emitida" };

    expect(puedeAnularReceta(ROLES.MEDICO, ajena, "per-medico")).toBe(false);
  });

  it("no vuelve a tocar la suya una vez anulada", () => {
    const anulada = { medicoId: "per-medico", estado: "anulada" };

    expect(puedeAnularReceta(ROLES.MEDICO, anulada, "per-medico")).toBe(false);
  });

  it("la administradora anula cualquiera, en cualquier estado: es la via de correccion", () => {
    const ajena = { medicoId: "per-otro", estado: "anulada" };

    expect(puedeAnularReceta(ROLES.ADMINISTRADOR, ajena, "per-admin")).toBe(true);
    expect(puedeAnularReceta(ROLES.ADMINISTRADOR, null, null)).toBe(true);
  });

  it("los demas roles no anulan nada", () => {
    for (const rol of [ROLES.VOLUNTARIO, ROLES.JUNTA_DIRECTIVA, ROLES.SOCIO_FUNDADOR]) {
      expect(puedeAnularReceta(rol, RECETA_PROPIA_EMITIDA, "per-medico")).toBe(false);
    }
  });

  it("sin receta o sin perfil no concede nada a un medico", () => {
    expect(puedeAnularReceta(ROLES.MEDICO, null, "per-medico")).toBe(false);
    expect(puedeAnularReceta(ROLES.MEDICO, RECETA_PROPIA_EMITIDA, null)).toBe(false);
  });
});
