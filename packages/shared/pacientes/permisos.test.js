// Pruebas de los permisos del modulo de pacientes.
//
// Se importan los modulos directamente y no el barril packages/shared/index.js: el barril
// arrastra @supabase/supabase-js y el modulo de entorno, y estas pruebas tienen que correr sin
// .env y sin conexion. Mismo patron que jornadas/permisos.test.js.

import { afterEach, describe, expect, it } from "vitest";

import { fijarAccesoDeSesion, limpiarAccesoDeSesion } from "../usuarios/acceso.js";
import { ROLES } from "../usuarios/roles.js";
import {
  permisosDePacientes,
  puedeAdministrarDiagnosticos,
  puedeDarDeBajaPaciente,
  puedeRetirarDiagnostico,
  puedeVerCatalogoDiagnosticos,
  puedeAnularReceta,
  puedeCorregirConsulta,
  puedeCorregirTriaje,
  puedeCrearConsulta,
  puedeCrearExpediente,
  puedeEditarExpediente,
  puedeEditarPaciente,
  puedeEmitirReceta,
  puedeFusionarPacientes,
  puedeRegistrarPaciente,
  puedeTomarTriaje,
  puedeVerExpedientes,
  puedeVerHistorial,
  puedeVerPacientes,
} from "./permisos.js";

const CAMPO = [ROLES.MEDICO, ROLES.VOLUNTARIO];
const CONSULTIVOS = [ROLES.JUNTA_DIRECTIVA, ROLES.SOCIO_FUNDADOR];

afterEach(() => {
  limpiarAccesoDeSesion();
});

describe("permisos de pacientes y expedientes (00148)", () => {
  it("administrador y personal de campo ven y registran pacientes", () => {
    for (const rol of [ROLES.ADMINISTRADOR, ...CAMPO]) {
      expect(puedeVerPacientes(rol)).toBe(true);
      expect(puedeRegistrarPaciente(rol)).toBe(true);
      expect(puedeVerExpedientes(rol)).toBe(true);
      expect(puedeCrearExpediente(rol)).toBe(true);
    }

    for (const rol of CONSULTIVOS) {
      expect(puedeVerPacientes(rol)).toBe(false);
    }
  });

  it("medico y colaborador editan pacientes y expedientes (pacientes.editar por defecto)", () => {
    for (const rol of [ROLES.ADMINISTRADOR, ...CAMPO]) {
      expect(puedeEditarPaciente(rol)).toBe(true);
      expect(puedeEditarExpediente(rol)).toBe(true);
    }

    for (const rol of CONSULTIVOS) {
      expect(puedeEditarPaciente(rol)).toBe(false);
    }
  });

  it("una revocacion puntual de pacientes.editar se respeta en la sesion", () => {
    fijarAccesoDeSesion({ rol: ROLES.MEDICO, permisos: [] });
    expect(puedeEditarPaciente(ROLES.MEDICO)).toBe(false);
  });

  it("dar de baja a un paciente (eliminarlo) es solo de la administradora", () => {
    expect(puedeDarDeBajaPaciente(ROLES.ADMINISTRADOR)).toBe(true);
    for (const rol of [...CAMPO, ...CONSULTIVOS]) {
      expect(puedeDarDeBajaPaciente(rol)).toBe(false);
    }
  });

  it("quien ve pacientes ve el historial clinico completo: el colaborador tambien", () => {
    for (const rol of [ROLES.ADMINISTRADOR, ...CAMPO]) {
      expect(puedeVerHistorial(rol)).toBe(true);
    }
    for (const rol of CONSULTIVOS) {
      expect(puedeVerHistorial(rol)).toBe(false);
    }
  });

  it("consultas y recetas siguen siendo del medico: las firma un medico", () => {
    expect(puedeCrearConsulta(ROLES.MEDICO)).toBe(true);
    expect(puedeEmitirReceta(ROLES.MEDICO)).toBe(true);
    expect(puedeCrearConsulta(ROLES.VOLUNTARIO)).toBe(false);
    expect(puedeEmitirReceta(ROLES.VOLUNTARIO)).toBe(false);
  });

  it("el personal de campo toma y corrige triaje", () => {
    for (const rol of [ROLES.ADMINISTRADOR, ...CAMPO]) {
      expect(puedeTomarTriaje(rol)).toBe(true);
      expect(puedeCorregirTriaje(rol)).toBe(true);
    }
    for (const rol of CONSULTIVOS) {
      expect(puedeCorregirTriaje(rol)).toBe(false);
    }
  });

  it("un rol consultivo con Pacientes abierto por la matriz lee, no registra", () => {
    fijarAccesoDeSesion({ rol: ROLES.JUNTA_DIRECTIVA, modulos: ["pacientes"] });

    expect(puedeVerPacientes(ROLES.JUNTA_DIRECTIVA)).toBe(true);
    expect(puedeVerHistorial(ROLES.JUNTA_DIRECTIVA)).toBe(true);
    expect(puedeRegistrarPaciente(ROLES.JUNTA_DIRECTIVA)).toBe(false);
    expect(puedeEditarPaciente(ROLES.JUNTA_DIRECTIVA)).toBe(false);
  });

  it("solo administrador fusiona expedientes (issue #140)", () => {
    expect(puedeFusionarPacientes(ROLES.ADMINISTRADOR)).toBe(true);
    for (const rol of [...CAMPO, ...CONSULTIVOS]) {
      expect(puedeFusionarPacientes(rol)).toBe(false);
    }
  });

  it("un rol que no existe no puede nada", () => {
    expect(permisosDePacientes("coordinador")).toEqual({
      puedeVer: false,
      puedeCrear: false,
      puedeEditar: false,
      puedeDarDeBaja: false,
      puedeVerHistorial: false,
      puedeTomarTriaje: false,
      puedeCorregirTriaje: false,
      puedeCrearConsulta: false,
      puedeEmitirReceta: false,
      puedeFusionarPacientes: false,
      puedeVerCatalogoDiagnosticos: false,
      puedeAdministrarDiagnosticos: false,
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
      puedeEditar: true,
      puedeDarDeBaja: false,
      puedeVerHistorial: true,
      puedeTomarTriaje: true,
      puedeCorregirTriaje: true,
      puedeCrearConsulta: false,
      puedeEmitirReceta: false,
      puedeFusionarPacientes: false,
      puedeVerCatalogoDiagnosticos: true,
      puedeAdministrarDiagnosticos: true,
    });

    expect(permisosDePacientes(ROLES.ADMINISTRADOR)).toEqual({
      puedeVer: true,
      puedeCrear: true,
      puedeEditar: true,
      puedeDarDeBaja: true,
      puedeVerHistorial: true,
      puedeTomarTriaje: true,
      puedeCorregirTriaje: true,
      puedeCrearConsulta: true,
      puedeEmitirReceta: true,
      puedeFusionarPacientes: true,
      puedeVerCatalogoDiagnosticos: true,
      puedeAdministrarDiagnosticos: true,
    });
  });

  it("el personal de campo agrega y corrige diagnosticos; retirarlos es de la administradora", () => {
    for (const rol of [ROLES.ADMINISTRADOR, ...CAMPO]) {
      expect(puedeAdministrarDiagnosticos(rol)).toBe(true);
      expect(puedeVerCatalogoDiagnosticos(rol)).toBe(true);
    }
    for (const rol of CONSULTIVOS) {
      expect(puedeAdministrarDiagnosticos(rol)).toBe(false);
      expect(puedeVerCatalogoDiagnosticos(rol)).toBe(false);
    }

    expect(puedeRetirarDiagnostico(ROLES.ADMINISTRADOR)).toBe(true);
    for (const rol of [...CAMPO, ...CONSULTIVOS]) {
      expect(puedeRetirarDiagnostico(rol)).toBe(false);
    }
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

// Issue #756: actualizarConsulta() ya existia, probada, pero ninguna pantalla la llamaba.
describe("puedeCorregirConsulta", () => {
  const CONSULTA_PROPIA = { profesionalId: "per-medico" };

  it("el medico corrige la consulta que el registro", () => {
    expect(puedeCorregirConsulta(ROLES.MEDICO, CONSULTA_PROPIA, "per-medico")).toBe(true);
  });

  it("no corrige la consulta de otro medico: espejo de la politica de UPDATE (00033)", () => {
    const ajena = { profesionalId: "per-otro" };

    expect(puedeCorregirConsulta(ROLES.MEDICO, ajena, "per-medico")).toBe(false);
  });

  it("la administradora corrige cualquiera", () => {
    const ajena = { profesionalId: "per-otro" };

    expect(puedeCorregirConsulta(ROLES.ADMINISTRADOR, ajena, "per-admin")).toBe(true);
    expect(puedeCorregirConsulta(ROLES.ADMINISTRADOR, null, null)).toBe(true);
  });

  it("los demas roles no corrigen ninguna consulta", () => {
    for (const rol of [ROLES.VOLUNTARIO, ROLES.JUNTA_DIRECTIVA, ROLES.SOCIO_FUNDADOR]) {
      expect(puedeCorregirConsulta(rol, CONSULTA_PROPIA, "per-medico")).toBe(false);
    }
  });

  it("sin consulta o sin perfil no concede nada a un medico", () => {
    expect(puedeCorregirConsulta(ROLES.MEDICO, null, "per-medico")).toBe(false);
    expect(puedeCorregirConsulta(ROLES.MEDICO, CONSULTA_PROPIA, null)).toBe(false);
  });
});
