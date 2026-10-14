// Pruebas de las etapas de la cola.
//
// Se importa el modulo directamente y no el barril packages/shared/index.js: el barril arrastra
// @supabase/supabase-js y el modulo de entorno, y estas pruebas tienen que correr sin .env.
//
// Ningun dato real: los pacientes son inventados.

import { describe, expect, it } from "vitest";

import { ETAPAS_DE_COLA, minutosEsperando, NOMBRES_DE_ETAPA, ORDEN_DE_ETAPAS } from "./etapas.js";

describe("ETAPAS_DE_COLA", () => {
  it("usa exactamente los valores que produce vista_cola_jornada (00060)", () => {
    // Si aqui se escribe un valor que el CASE de la vista no genera, la cola llega vacia sin
    // que nada avise: el agrupado busca una clave que ninguna fila trae.
    expect(Object.values(ETAPAS_DE_COLA)).toEqual([
      "espera triaje",
      "espera consulta",
      "espera entrega",
      "lista para cerrar",
    ]);
  });

  it("ORDEN_DE_ETAPAS las lista en el orden del flujo, sin faltar ninguna", () => {
    expect(ORDEN_DE_ETAPAS).toEqual(Object.values(ETAPAS_DE_COLA));
  });

  it("cada etapa tiene nombre para mostrar", () => {
    // Una etapa sin nombre se pintaria como la cadena cruda o como un hueco en blanco.
    for (const etapa of ORDEN_DE_ETAPAS) {
      expect(NOMBRES_DE_ETAPA[etapa]).toBeTruthy();
    }
  });

  it("no se pueden modificar por accidente", () => {
    expect(Object.isFrozen(ETAPAS_DE_COLA)).toBe(true);
    expect(Object.isFrozen(ORDEN_DE_ETAPAS)).toBe(true);
  });
});

describe("minutosEsperando", () => {
  const ahora = new Date("2026-08-26T10:00:00Z");

  it("cuenta los minutos completos desde que entro a la etapa", () => {
    expect(minutosEsperando("2026-08-26T09:00:00Z", ahora)).toBe(60);
    expect(minutosEsperando("2026-08-26T09:59:00Z", ahora)).toBe(1);
  });

  it("redondea hacia abajo: 90 segundos es 1 minuto, no 2", () => {
    expect(minutosEsperando("2026-08-26T09:58:30Z", ahora)).toBe(1);
  });

  it("nunca devuelve negativo", () => {
    // El reloj del dispositivo puede ir atrasado respecto del servidor. "-3 minutos esperando"
    // en la pantalla es peor que 0.
    expect(minutosEsperando("2026-08-26T10:05:00Z", ahora)).toBe(0);
  });

  it("acepta un Date igual que una cadena", () => {
    expect(minutosEsperando(new Date("2026-08-26T09:30:00Z"), ahora)).toBe(30);
  });

  it("devuelve null si la fecha no sirve", () => {
    expect(minutosEsperando(null, ahora)).toBeNull();
    expect(minutosEsperando("no es una fecha", ahora)).toBeNull();
    expect(minutosEsperando("2026-08-26T09:00:00Z", new Date("x"))).toBeNull();
  });
});
