// Pruebas de la seleccion de avisos del sistema del telefono (issue #755).

import { describe, expect, it } from "vitest";

import {
  avisosDelSistema,
  marcaMasReciente,
  MAXIMO_DE_AVISOS_INDIVIDUALES,
  notificacionesNuevasDesde,
} from "./avisos.js";

function n(id, createdAt, leida = false) {
  return { id, createdAt, leida, titulo: `Titulo ${id}`, cuerpo: `Cuerpo ${id}` };
}

describe("notificacionesNuevasDesde", () => {
  const lista = [
    n("3", "2026-09-19T10:00:00Z"),
    n("2", "2026-09-19T09:00:00Z", true),
    n("1", "2026-09-19T08:00:00Z"),
  ];

  it("en la primera carga (sin marca) no avisa de lo que ya estaba", () => {
    expect(notificacionesNuevasDesde(lista, null)).toEqual([]);
  });

  it("avisa solo de las sin leer que llegaron despues de la marca", () => {
    expect(notificacionesNuevasDesde(lista, "2026-09-19T08:30:00Z").map((x) => x.id)).toEqual([
      "3",
    ]);
  });

  it("marcaMasReciente toma la fecha mas nueva, o null sin notificaciones", () => {
    expect(marcaMasReciente(lista)).toBe("2026-09-19T10:00:00Z");
    expect(marcaMasReciente([])).toBeNull();
  });
});

describe("avisosDelSistema", () => {
  it("un aviso por notificacion nueva, con su titulo y su cuerpo", () => {
    expect(avisosDelSistema([n("1", "x")])).toEqual([{ titulo: "Titulo 1", cuerpo: "Cuerpo 1" }]);
  });

  it("si son demasiadas, un solo resumen", () => {
    const muchas = Array.from({ length: MAXIMO_DE_AVISOS_INDIVIDUALES + 1 }, (_, i) =>
      n(`${i}`, "x"),
    );
    const avisos = avisosDelSistema(muchas);
    expect(avisos).toHaveLength(1);
    expect(avisos[0].titulo).toBe(`${muchas.length} notificaciones nuevas`);
  });

  it("sin nuevas, ningun aviso", () => {
    expect(avisosDelSistema([])).toEqual([]);
  });
});
