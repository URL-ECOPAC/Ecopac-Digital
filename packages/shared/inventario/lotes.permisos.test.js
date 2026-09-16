// Pruebas de los permisos de lotes.
//
// Se importan los modulos directamente y no el barril packages/shared/index.js: el barril
// arrastra @supabase/supabase-js y el modulo de entorno, y estas pruebas tienen que correr sin
// .env y sin conexion. Las funciones de lotes.api.js se prueban aparte, en lotes.api.test.js.

import { describe, expect, it } from "vitest";

import { ROLES } from "../usuarios/roles.js";
import {
  permisosDeLotes,
  puedeAdministrarLotes,
  puedeCorregirLote,
  puedeProponerLote,
  puedeVerLotes,
} from "./lotes.permisos.js";

describe("permisos de lotes", () => {
  it("solo Administrador administra el catalogo de lotes", () => {
    expect(puedeAdministrarLotes(ROLES.ADMINISTRADOR)).toBe(true);

    expect(puedeAdministrarLotes(ROLES.JUNTA_DIRECTIVA)).toBe(false);
    expect(puedeAdministrarLotes(ROLES.SOCIO_FUNDADOR)).toBe(false);
    expect(puedeAdministrarLotes(ROLES.MEDICO)).toBe(false);
    expect(puedeAdministrarLotes(ROLES.VOLUNTARIO)).toBe(false);
  });

  it("los roles de campo proponen lotes; los consultivos no (issue #625)", () => {
    // Lo que crean nace provisional (lotes.confirmado = FALSE) y lo confirma la administradora al
    // aprobar el ingreso. Junta directiva y socio fundador son consultivos: no registran nada.
    expect(puedeProponerLote(ROLES.ADMINISTRADOR)).toBe(true);
    expect(puedeProponerLote(ROLES.MEDICO)).toBe(true);
    expect(puedeProponerLote(ROLES.VOLUNTARIO)).toBe(true);

    expect(puedeProponerLote(ROLES.JUNTA_DIRECTIVA)).toBe(false);
    expect(puedeProponerLote(ROLES.SOCIO_FUNDADOR)).toBe(false);
  });

  it("cualquier rol conocido puede ver los lotes", () => {
    for (const rol of Object.values(ROLES)) {
      expect(puedeVerLotes(rol)).toBe(true);
    }
  });

  it("un rol que no existe no puede nada", () => {
    expect(permisosDeLotes("coordinador")).toEqual({
      puedeVer: false,
      puedeCrear: false,
      puedeAdministrar: false,
    });
  });

  it("agrupa los permisos para que un hook no llame a las funciones sueltas", () => {
    // El voluntario puede crear pero no administrar: es exactamente la distincion que la 00107
    // introduce, y la que la pantalla necesita para saber si lo que cree nace firme o a revision.
    expect(permisosDeLotes(ROLES.VOLUNTARIO)).toEqual({
      puedeVer: true,
      puedeCrear: true,
      puedeAdministrar: false,
    });
    expect(permisosDeLotes(ROLES.MEDICO)).toEqual({
      puedeVer: true,
      puedeCrear: true,
      puedeAdministrar: false,
    });
    expect(permisosDeLotes(ROLES.ADMINISTRADOR)).toEqual({
      puedeVer: true,
      puedeCrear: true,
      puedeAdministrar: true,
    });
    expect(permisosDeLotes(ROLES.JUNTA_DIRECTIVA)).toEqual({
      puedeVer: true,
      puedeCrear: false,
      puedeAdministrar: false,
    });
  });
});

describe("puedeCorregirLote (issue #752)", () => {
  const LOTE_PROVISIONAL_PROPIO = { registradoPor: "user-1", confirmado: false };
  const LOTE_PROVISIONAL_AJENO = { registradoPor: "user-2", confirmado: false };
  const LOTE_CONFIRMADO_PROPIO = { registradoPor: "user-1", confirmado: true };

  it("administrador corrige cualquier lote, confirmado o no, propio o ajeno", () => {
    expect(puedeCorregirLote(ROLES.ADMINISTRADOR, LOTE_PROVISIONAL_AJENO, "user-1")).toBe(true);
    expect(puedeCorregirLote(ROLES.ADMINISTRADOR, LOTE_CONFIRMADO_PROPIO, "user-1")).toBe(true);
    expect(puedeCorregirLote(ROLES.ADMINISTRADOR, null, "user-1")).toBe(true);
  });

  it("el autor corrige su propio lote mientras siga provisional", () => {
    expect(puedeCorregirLote(ROLES.MEDICO, LOTE_PROVISIONAL_PROPIO, "user-1")).toBe(true);
    expect(puedeCorregirLote(ROLES.VOLUNTARIO, LOTE_PROVISIONAL_PROPIO, "user-1")).toBe(true);
  });

  it("nadie mas puede corregir el lote de otra persona", () => {
    expect(puedeCorregirLote(ROLES.MEDICO, LOTE_PROVISIONAL_AJENO, "user-1")).toBe(false);
    expect(puedeCorregirLote(ROLES.VOLUNTARIO, LOTE_PROVISIONAL_AJENO, "user-1")).toBe(false);
  });

  it("en cuanto el lote se confirma, deja de ser corregible por su autor", () => {
    expect(puedeCorregirLote(ROLES.MEDICO, LOTE_CONFIRMADO_PROPIO, "user-1")).toBe(false);
  });

  it("sin lote o sin usuarioId, un rol de campo no puede nada", () => {
    expect(puedeCorregirLote(ROLES.MEDICO, null, "user-1")).toBe(false);
    expect(puedeCorregirLote(ROLES.MEDICO, LOTE_PROVISIONAL_PROPIO, undefined)).toBe(false);
  });

  it("la comprobacion es por autoria, no por rol: asi es la politica de la 00107 en la base", () => {
    // La politica de UPDATE no filtra por rol en su rama "autor" (a diferencia de la de INSERT,
    // que si exige medico/voluntario): USING (es_administrador() OR (registrado_por = auth.uid()
    // AND confirmado = false)). En la practica un rol consultivo nunca llega a ser autor de un
    // lote -no puede insertarlo (puedeProponerLote)-, pero si la fila lo dijera, la base lo
    // dejaria pasar igual; este espejo se queda fiel a esa regla en vez de inventar una mas
    // estricta que el servidor no aplica.
    expect(puedeCorregirLote(ROLES.JUNTA_DIRECTIVA, LOTE_PROVISIONAL_PROPIO, "user-1")).toBe(true);
  });
});
