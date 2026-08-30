import { describe, it, expect } from "vitest";

import { ROLES } from "../usuarios/roles.js";
import {
  permisosDeDonaciones,
  puedeRegistrarDonaciones,
  puedeVerDonaciones,
} from "./permisos.js";

describe("permisos de donaciones (#598)", () => {
  describe("puedeVerDonaciones", () => {
    it("deja leer a administrador y a los dos roles consultivos", () => {
      expect(puedeVerDonaciones(ROLES.ADMINISTRADOR)).toBe(true);
      expect(puedeVerDonaciones(ROLES.JUNTA_DIRECTIVA)).toBe(true);
      expect(puedeVerDonaciones(ROLES.SOCIO_FUNDADOR)).toBe(true);
    });

    it("no deja leer a los roles de campo", () => {
      expect(puedeVerDonaciones(ROLES.MEDICO)).toBe(false);
      expect(puedeVerDonaciones(ROLES.VOLUNTARIO)).toBe(false);
    });

    it("no deja leer sin rol", () => {
      expect(puedeVerDonaciones(undefined)).toBe(false);
      expect(puedeVerDonaciones(null)).toBe(false);
      expect(puedeVerDonaciones("")).toBe(false);
    });

    // La razon de ser de la issue #598: los hooks comparaban contra estas cadenas, que el enum
    // rol_usuario de la 00001 no tiene. Ninguna coincidia nunca, asi que tieneAccesoLectura era
    // false para todo el mundo y las cuatro pantallas de donaciones respondian "Acceso
    // denegado" incluso a la administradora.
    it("no reconoce los roles con la inicial en mayuscula que se usaban antes", () => {
      expect(puedeVerDonaciones("Administrador")).toBe(false);
      expect(puedeVerDonaciones("Junta Directiva")).toBe(false);
      expect(puedeVerDonaciones("Socio Fundador")).toBe(false);
    });
  });

  describe("puedeRegistrarDonaciones", () => {
    it("solo deja escribir a administrador", () => {
      expect(puedeRegistrarDonaciones(ROLES.ADMINISTRADOR)).toBe(true);
    });

    it("no deja escribir a los consultivos, que son de solo lectura", () => {
      expect(puedeRegistrarDonaciones(ROLES.JUNTA_DIRECTIVA)).toBe(false);
      expect(puedeRegistrarDonaciones(ROLES.SOCIO_FUNDADOR)).toBe(false);
    });

    it("no deja escribir a los roles de campo ni sin rol", () => {
      expect(puedeRegistrarDonaciones(ROLES.MEDICO)).toBe(false);
      expect(puedeRegistrarDonaciones(ROLES.VOLUNTARIO)).toBe(false);
      expect(puedeRegistrarDonaciones(undefined)).toBe(false);
    });
  });

  describe("permisosDeDonaciones", () => {
    it("da lectura y escritura a administrador", () => {
      expect(permisosDeDonaciones(ROLES.ADMINISTRADOR)).toEqual({
        tieneAccesoLectura: true,
        puedeEscribir: true,
      });
    });

    it("da solo lectura a junta directiva", () => {
      expect(permisosDeDonaciones(ROLES.JUNTA_DIRECTIVA)).toEqual({
        tieneAccesoLectura: true,
        puedeEscribir: false,
      });
    });

    it("no da nada a un medico", () => {
      expect(permisosDeDonaciones(ROLES.MEDICO)).toEqual({
        tieneAccesoLectura: false,
        puedeEscribir: false,
      });
    });
  });

  // No hay prueba que invoque a los cuatro hooks del modulo: packages/shared corre sin DOM a
  // proposito, asi que un hook no se puede llamar fuera de un render. Lo que se prueba aqui es
  // el predicado que ahora consultan los cuatro; que lo consulten se ve en el diff de cada uno.
});
