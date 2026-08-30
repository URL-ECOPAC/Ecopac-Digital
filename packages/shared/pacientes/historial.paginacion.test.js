import { describe, expect, it } from "vitest";

import { agruparPorJornada } from "./useHistorialPaciente.js";

function atencionesDe(cantidad) {
  return Array.from({ length: cantidad }, (_, indice) => ({
    jornadaId: `j-${indice}`,
    jornada: `Jornada ${indice}`,
    comunidad: "Chuicutama",
    fechaDeJornada: `2026-0${indice + 1}-01`,
    tipo: "consulta",
    id: `c-${indice}`,
    fecha: `2026-0${indice + 1}-01T10:00:00Z`,
  }));
}

describe("paginacion del historial por atencion", () => {
  it("pedir un limite mas uno permite saber si hay mas sin una consulta de conteo", () => {
    const limite = 3;
    const grupos = agruparPorJornada(atencionesDe(limite + 1));

    expect(grupos.length > limite).toBe(true);
    expect(grupos.slice(0, limite)).toHaveLength(limite);
  });

  it("con exactamente el limite no anuncia mas atenciones", () => {
    const limite = 3;
    const grupos = agruparPorJornada(atencionesDe(limite));

    expect(grupos.length > limite).toBe(false);
  });

  it("varios eventos de una misma atencion cuentan como una sola", () => {
    const grupos = agruparPorJornada([
      { jornadaId: "j-1", jornada: "Mayo", tipo: "triaje", id: "t-1", fecha: "2026-05-10T15:00:00Z" },
      { jornadaId: "j-1", jornada: "Mayo", tipo: "consulta", id: "c-1", fecha: "2026-05-10T15:30:00Z" },
      { jornadaId: "j-1", jornada: "Mayo", tipo: "receta", id: "r-1", fecha: "2026-05-10T15:40:00Z" },
    ]);

    expect(grupos).toHaveLength(1);
    expect(grupos[0].eventos).toHaveLength(3);
  });

  it("el corte respeta el orden que ya trae la consulta", () => {
    const grupos = agruparPorJornada(atencionesDe(5)).slice(0, 3);

    expect(grupos.map((grupo) => grupo.jornada)).toEqual([
      "Jornada 0",
      "Jornada 1",
      "Jornada 2",
    ]);
  });
});
