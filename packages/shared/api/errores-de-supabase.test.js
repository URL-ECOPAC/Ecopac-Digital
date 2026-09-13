// Reconocimiento de fallos de red en esErrorDeRed().

import { describe, expect, it } from "vitest";

import {
  CODIGOS_DE_ERROR_DE_SUPABASE,
  esErrorDeRed,
  normalizarError,
} from "./errores-de-supabase.js";

describe("esErrorDeRed", () => {
  it("reconoce el mensaje del navegador y el de React Native", () => {
    expect(esErrorDeRed(new TypeError("Failed to fetch"))).toBe(true);
    expect(esErrorDeRed(new TypeError("Network request failed"))).toBe(true);
  });

  it("reconoce el FunctionsFetchError de functions.invoke()", () => {
    const error = new Error("Failed to send a request to the Edge Function");
    error.name = "FunctionsFetchError";

    expect(esErrorDeRed(error)).toBe(true);
    expect(normalizarError(error).codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.FALLO_DE_RED);
  });

  it("no confunde un error de la base con uno de red", () => {
    expect(esErrorDeRed({ code: "42501", message: "permission denied" })).toBe(false);
    expect(esErrorDeRed(null)).toBe(false);
  });
});
