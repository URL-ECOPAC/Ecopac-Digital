// Pruebas de los permisos del modulo de pacientes.
//
// Se importan los modulos directamente y no el barril packages/shared/index.js: el barril
// arrastra @supabase/supabase-js y el modulo de entorno, y estas pruebas tienen que correr sin
// .env y sin conexion. Mismo patron que jornadas/permisos.test.js.

import { describe, expect, it } from "vitest";

import { ROLES } from "../usuarios/roles.js";
import {
  permisosDePacientes,
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
