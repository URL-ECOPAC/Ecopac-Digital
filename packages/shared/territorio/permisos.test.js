import { describe, expect, it } from "vitest";

import {
  puedeCrearComunidad,
  puedeEditarComunidad,
  puedeVerCatalogoComunidades,
} from "./permisos.js";
import { ROLES } from "../usuarios/roles.js";

describe("puedeCrearComunidad", () => {
  it("solo el administrador, espejo de la politica de INSERT de la 00116", () => {
    expect(puedeCrearComunidad(ROLES.ADMINISTRADOR)).toBe(true);
  });

  it.each(Object.values(ROLES).filter((rol) => rol !== ROLES.ADMINISTRADOR))(
    "%s no puede crear comunidades",
    (rol) => {
      expect(puedeCrearComunidad(rol)).toBe(false);
    },
  );

  it("sin rol no puede", () => {
    expect(puedeCrearComunidad(undefined)).toBe(false);
    expect(puedeCrearComunidad(null)).toBe(false);
  });
});

describe("puedeEditarComunidad", () => {
  it("solo el administrador, espejo de la politica de UPDATE de la 00116", () => {
    expect(puedeEditarComunidad(ROLES.ADMINISTRADOR)).toBe(true);
    expect(puedeEditarComunidad(ROLES.MEDICO)).toBe(false);
  });
});

describe("puedeVerCatalogoComunidades", () => {
  it("solo el administrador entra a la pantalla de catalogo", () => {
    expect(puedeVerCatalogoComunidades(ROLES.ADMINISTRADOR)).toBe(true);
  });

  it.each(Object.values(ROLES).filter((rol) => rol !== ROLES.ADMINISTRADOR))(
    "%s no ve el catalogo de comunidades",
    (rol) => {
      expect(puedeVerCatalogoComunidades(rol)).toBe(false);
    },
  );

  it("sin rol no puede", () => {
    expect(puedeVerCatalogoComunidades(undefined)).toBe(false);
  });
});
