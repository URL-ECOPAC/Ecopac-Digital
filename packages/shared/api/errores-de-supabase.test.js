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

describe("normalizarError", () => {
  it("clasifica el SQLSTATE 53400 (limite de peticiones, issue #761) y no lo marca reintentable", () => {
    const error = {
      code: "53400",
      message: "Se alcanzo el limite de 20 peticiones cada 01:00:00.",
    };
    const resultado = normalizarError(error);

    expect(resultado.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.LIMITE_EXCEDIDO);
    expect(resultado.esReintentable).toBe(false);
  });

  // Los RAISE EXCEPTION ... USING ERRCODE de fn_atender_alerta_caducidad (00138/00143) usan estos
  // dos codigos ademas de los ya cubiertos por otras pruebas (42501, 23514, 23502). Sin esta
  // entrada caian en el "default" -> DESCONOCIDO, y quien atendia una alerta veia "Ocurrio un
  // error inesperado" para un fallo que en realidad tenia explicacion (la alerta ya no existe, o
  // -el caso mas comun- reubicar a la misma bodega donde ya esta todo el lote).
  it("clasifica P0002 (fila no encontrada) como sin resultados, no como desconocido", () => {
    const error = { code: "P0002", message: "La alerta no existe." };
    expect(normalizarError(error).codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.SIN_RESULTADOS);
  });

  it("clasifica 55000 (no se pudo completar la accion) como una regla incumplida, no como desconocido", () => {
    const error = { code: "55000", message: "No se pudo completar la accion." };
    expect(normalizarError(error).codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.CHECK);
  });
});
