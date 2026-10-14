import { describe, expect, it } from "vitest";

import {
  puedeCrearComunidad,
  puedeEditarComunidad,
  puedeRetirarComunidad,
  puedeVerCatalogoComunidades,
} from "./permisos.js";
import { ROLES } from "../usuarios/roles.js";

// 00148: el personal de campo crea y corrige comunidades; retirarlas sigue siendo de la
// administradora (trigger impedir_retirar_sin_ser_administrador). Nadie las borra.
const QUIENES_MANTIENEN = [ROLES.ADMINISTRADOR, ROLES.MEDICO, ROLES.VOLUNTARIO];
const CONSULTIVOS = [ROLES.JUNTA_DIRECTIVA, ROLES.SOCIO_FUNDADOR];

describe("puedeCrearComunidad", () => {
  it.each(QUIENES_MANTIENEN)("%s crea comunidades", (rol) => {
    expect(puedeCrearComunidad(rol)).toBe(true);
  });

  it.each(CONSULTIVOS)("%s no crea comunidades", (rol) => {
    expect(puedeCrearComunidad(rol)).toBe(false);
  });

  it("sin rol no puede", () => {
    expect(puedeCrearComunidad(undefined)).toBe(false);
    expect(puedeCrearComunidad(null)).toBe(false);
  });
});

describe("puedeEditarComunidad", () => {
  it("administrador y personal de campo, espejo de la politica de UPDATE de la 00148", () => {
    for (const rol of QUIENES_MANTIENEN) {
      expect(puedeEditarComunidad(rol)).toBe(true);
    }
    for (const rol of CONSULTIVOS) {
      expect(puedeEditarComunidad(rol)).toBe(false);
    }
  });
});

describe("puedeRetirarComunidad", () => {
  it("solo el administrador retira una comunidad", () => {
    expect(puedeRetirarComunidad(ROLES.ADMINISTRADOR)).toBe(true);
    for (const rol of [ROLES.MEDICO, ROLES.VOLUNTARIO, ...CONSULTIVOS]) {
      expect(puedeRetirarComunidad(rol)).toBe(false);
    }
  });
});

describe("puedeVerCatalogoComunidades", () => {
  it.each(QUIENES_MANTIENEN)("%s entra a la pantalla de catalogo", (rol) => {
    expect(puedeVerCatalogoComunidades(rol)).toBe(true);
  });

  it.each(CONSULTIVOS)("%s no ve el catalogo de comunidades", (rol) => {
    expect(puedeVerCatalogoComunidades(rol)).toBe(false);
  });

  it("sin rol no puede", () => {
    expect(puedeVerCatalogoComunidades(undefined)).toBe(false);
  });
});
