import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { construirReporteDeError } from "./errores.js";
import { construirEnvelopeDeSentry, crearDestinoSentry, interpretarDsnDeSentry } from "./sentry.js";

const DSN = "https://abc123@o42.ingest.sentry.io/4507";

function lineasDe(envelope) {
  return envelope.split("\n").map((linea) => JSON.parse(linea));
}

describe("interpretarDsnDeSentry", () => {
  it("arma la URL del envelope con la llave en la query string", () => {
    expect(interpretarDsnDeSentry(DSN)).toEqual({
      urlDeEnvio:
        "https://o42.ingest.sentry.io/api/4507/envelope/?sentry_key=abc123&sentry_version=7&sentry_client=ecopac-digital%2F1.0",
    });
  });

  it("conserva un prefijo de ruta", () => {
    expect(interpretarDsnDeSentry("https://llave@sentry.ejemplo.org/prefijo/9").urlDeEnvio).toMatch(
      /^https:\/\/sentry\.ejemplo\.org\/prefijo\/api\/9\/envelope\//,
    );
  });

  it("rechaza lo que no es un DSN", () => {
    expect(interpretarDsnDeSentry("https://o42.ingest.sentry.io/4507")).toBeNull();
    expect(interpretarDsnDeSentry("no es un dsn")).toBeNull();
    expect(interpretarDsnDeSentry(undefined)).toBeNull();
  });
});

describe("construirEnvelopeDeSentry", () => {
  it("manda solo lo que trae el reporte, ya limpio", () => {
    const reporte = construirReporteDeError(
      new TypeError("Fallo al abrir /pacientes/0b8e2a64-1111-4a4a-9c9c-222233334444"),
      {
        origen: "pantalla",
        ruta: "/pacientes/0b8e2a64-1111-4a4a-9c9c-222233334444",
        modulo: "pacientes",
      },
    );

    const [cabecera, item, evento] = lineasDe(
      construirEnvelopeDeSentry(reporte, { ambiente: "production", plataforma: "web" }),
    );

    expect(cabecera.event_id).toMatch(/^[0-9a-f]{32}$/);
    expect(item).toEqual({ type: "event" });
    expect(evento.event_id).toBe(cabecera.event_id);
    expect(evento.environment).toBe("production");
    expect(evento.level).toBe("error");
    expect(evento.exception.values[0]).toEqual({
      type: "TypeError",
      value: "Fallo al abrir /pacientes/[id]",
    });
    expect(evento.tags).toEqual({ origen: "pantalla", plataforma: "web", modulo: "pacientes" });
    expect(evento.extra.ruta).toBe("/pacientes/[id]");
    expect(evento).not.toHaveProperty("request");
    expect(evento).not.toHaveProperty("user");
    expect(JSON.stringify(evento)).not.toContain("0b8e2a64");
  });

  it("marca como fatal un error global fatal", () => {
    const reporte = construirReporteDeError(new Error("x"), { origen: "error-global-fatal" });
    const [, , evento] = lineasDe(construirEnvelopeDeSentry(reporte));
    expect(evento.level).toBe("fatal");
  });
});

describe("crearDestinoSentry", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sin DSN devuelve null: los errores se quedan en la consola", () => {
    expect(crearDestinoSentry({ dsn: undefined })).toBeNull();
    expect(crearDestinoSentry({ dsn: "  " })).toBeNull();
  });

  it("con un DSN mal escrito lanza, en vez de quedarse sin monitoreo en silencio", () => {
    expect(() => crearDestinoSentry({ dsn: "https://sin-llave.sentry.io/1" })).toThrow(
      /VITE_SENTRY_DSN/,
    );
  });

  it("envia el envelope por POST sin preflight de CORS", async () => {
    const enviar = vi.fn().mockResolvedValue({ ok: true });
    const destino = crearDestinoSentry({ dsn: DSN, ambiente: "development", enviar });

    destino(construirReporteDeError(new Error("Algo fallo"), { origen: "pantalla" }));
    await vi.waitFor(() => expect(enviar).toHaveBeenCalledTimes(1));

    const [url, peticion] = enviar.mock.calls[0];
    expect(url).toBe(interpretarDsnDeSentry(DSN).urlDeEnvio);
    expect(peticion.method).toBe("POST");
    expect(peticion.headers).toEqual({ "Content-Type": "text/plain;charset=UTF-8" });
    expect(lineasDe(peticion.body)[2].exception.values[0].value).toBe("Algo fallo");
  });

  it("no manda dos veces el mismo error dentro del mismo minuto", async () => {
    const enviar = vi.fn().mockResolvedValue({ ok: true });
    let momento = 0;
    const destino = crearDestinoSentry({ dsn: DSN, enviar, ahora: () => momento });
    const reporte = construirReporteDeError(new Error("En bucle"), { origen: "pantalla" });

    destino(reporte);
    momento = 30_000;
    destino(reporte);
    momento = 61_000;
    destino(reporte);

    await vi.waitFor(() => expect(enviar).toHaveBeenCalledTimes(2));
  });

  it("un fallo del envio no llega a quien reporto", async () => {
    const enviar = vi.fn().mockRejectedValue(new Error("sin red"));
    const destino = crearDestinoSentry({ dsn: DSN, enviar });

    expect(() =>
      destino(construirReporteDeError(new Error("x"), { origen: "pantalla" })),
    ).not.toThrow();
    await vi.waitFor(() => expect(enviar).toHaveBeenCalled());
  });
});
