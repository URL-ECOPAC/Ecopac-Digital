// Pruebas de corsHeadersPara() (issue #760): el origen de la peticion solo se refleja en
// Access-Control-Allow-Origin si esta en ALLOWED_ORIGINS.
//
// Corre con: deno test --config supabase/functions/deno.json --allow-env supabase/functions
//
// Mismo criterio que index_test.ts: sin @std/assert, un assertEquals casero para no sumar una
// dependencia al import map solo para comparaciones.

import { corsHeadersPara } from "./cors.ts";

function assertEquals(actual: unknown, esperado: unknown) {
  if (actual !== esperado) {
    throw new Error(`Se esperaba ${JSON.stringify(esperado)}, se obtuvo ${JSON.stringify(actual)}`);
  }
}

function solicitudConOrigen(origen: string | null) {
  const headers: Record<string, string> = {};
  if (origen) headers["Origin"] = origen;
  return new Request("http://localhost/invitar-usuario", { method: "POST", headers });
}

Deno.test("un origen en la lista se refleja en Access-Control-Allow-Origin", () => {
  Deno.env.set("ALLOWED_ORIGINS", "https://app.ecopac.test, https://otro.test");
  const encabezados = corsHeadersPara(solicitudConOrigen("https://app.ecopac.test"));
  assertEquals(encabezados["Access-Control-Allow-Origin"], "https://app.ecopac.test");
  Deno.env.delete("ALLOWED_ORIGINS");
});

Deno.test("un origen fuera de la lista no aparece en la respuesta", () => {
  Deno.env.set("ALLOWED_ORIGINS", "https://app.ecopac.test");
  const encabezados = corsHeadersPara(solicitudConOrigen("https://otro-origen.test"));
  assertEquals(encabezados["Access-Control-Allow-Origin"], undefined);
  Deno.env.delete("ALLOWED_ORIGINS");
});

Deno.test("sin header Origin tampoco aparece la cabecera", () => {
  Deno.env.set("ALLOWED_ORIGINS", "https://app.ecopac.test");
  const encabezados = corsHeadersPara(solicitudConOrigen(null));
  assertEquals(encabezados["Access-Control-Allow-Origin"], undefined);
  Deno.env.delete("ALLOWED_ORIGINS");
});

Deno.test("sin ALLOWED_ORIGINS configurado, ningun origen se refleja (fail-closed)", () => {
  const encabezados = corsHeadersPara(solicitudConOrigen("https://cualquiera.test"));
  assertEquals(encabezados["Access-Control-Allow-Origin"], undefined);
});
