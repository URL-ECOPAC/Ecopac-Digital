// Pruebas de reportarErrorDeFuncion() (issue #762): sin SENTRY_DSN solo escribe el log; con el,
// manda a Sentry un evento sin datos de paciente.
//
// Corre con: deno test --config supabase/functions/deno.json --allow-env supabase/functions
//
// Mismo criterio que cors_test.ts: un assertEquals casero para no sumar @std/assert.

import { construirEnvelope, reportarErrorDeFuncion, urlDeEnvioDeSentry } from "./errores.ts";

function assertEquals(actual: unknown, esperado: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(esperado)) {
    throw new Error(`Se esperaba ${JSON.stringify(esperado)}, se obtuvo ${JSON.stringify(actual)}`);
  }
}

function silenciarConsola() {
  const original = console.error;
  console.error = () => {};
  return () => {
    console.error = original;
  };
}

Deno.test("el DSN se convierte en la URL del envelope", () => {
  assertEquals(
    urlDeEnvioDeSentry("https://abc@o1.ingest.sentry.io/77"),
    "https://o1.ingest.sentry.io/api/77/envelope/?sentry_key=abc&sentry_version=7&sentry_client=ecopac-digital%2F1.0",
  );
  assertEquals(urlDeEnvioDeSentry("no es un dsn"), null);
});

Deno.test("el evento no lleva correos ni UUID", () => {
  const cuerpo = construirEnvelope(
    "invitar-usuario",
    "error inesperado",
    new Error("persona@ejemplo.org ya existe, id 0b8e2a64-1111-4a4a-9c9c-222233334444"),
  );
  const evento = JSON.parse(cuerpo.split("\n")[2]);
  assertEquals(evento.exception.values[0].value, "error inesperado: [correo] ya existe, id [id]");
  assertEquals(evento.tags, { origen: "edge-function", funcion: "invitar-usuario" });
});

Deno.test("sin SENTRY_DSN no se envia nada", async () => {
  Deno.env.delete("SENTRY_DSN");
  const restaurar = silenciarConsola();
  let llamadas = 0;
  await reportarErrorDeFuncion("alertas-vencimiento", "fallo", new Error("x"), () => {
    llamadas += 1;
    return Promise.resolve(new Response(null));
  });
  restaurar();
  assertEquals(llamadas, 0);
});

Deno.test("con SENTRY_DSN se envia, y un fallo del envio no lanza", async () => {
  Deno.env.set("SENTRY_DSN", "https://abc@o1.ingest.sentry.io/77");
  const restaurar = silenciarConsola();
  let url = "";
  await reportarErrorDeFuncion("alertas-vencimiento", "fallo", new Error("x"), (destino) => {
    url = String(destino);
    return Promise.reject(new Error("sin red"));
  });
  restaurar();
  Deno.env.delete("SENTRY_DSN");
  assertEquals(url.startsWith("https://o1.ingest.sentry.io/api/77/envelope/"), true);
});
