import { describe, expect, it } from "vitest";

import { aEventos, TIPOS_DE_EVENTO } from "./historial.api.js";
import { FILTROS_HISTORIAL, FILTROS_HISTORIAL_VACIOS } from "./historial.filtros.js";
import {
  agruparPorJornada,
  filtrarPorTipo,
  hayFiltrosDeHistorial,
} from "./useHistorialPaciente.js";

const ATENCION = {
  id: "a-1",
  jornadaId: "j-1",
  createdAt: "2026-05-10T15:00:00Z",
  jornada: {
    nombre: "Jornada Chuicutama",
    fecha: "2026-05-10",
    comunidad: { nombre: "Chuicutama" },
  },
  triajes: {
    id: "t-1",
    tomadoEn: "2026-05-10T15:05:00Z",
    presionSistolica: 120,
    presionDiastolica: 80,
    profesional: { nombres: "Ana", apellidos: "Lopez" },
  },
  consultas: [
    {
      id: "c-1",
      createdAt: "2026-05-10T15:30:00Z",
      motivoConsulta: "Dolor de cabeza",
      profesional: { nombres: "Luis", apellidos: "Perez" },
      diagnosticos: [],
      recetas: [
        {
          id: "r-1",
          folio: "REC-1",
          estado: "emitida",
          createdAt: "2026-05-10T15:40:00Z",
          detalle: [],
        },
      ],
    },
  ],
};

const EVENTOS = aEventos(ATENCION);

describe("aEventos con la comunidad de la jornada", () => {
  it("lleva la comunidad a cada evento, que es lo que pide el criterio 2", () => {
    expect(EVENTOS).toHaveLength(3);
    for (const evento of EVENTOS) {
      expect(evento.comunidad).toBe("Chuicutama");
      expect(evento.jornada).toBe("Jornada Chuicutama");
      expect(evento.profesional).toBeTruthy();
    }
  });

  it("no falla si la jornada no trae comunidad", () => {
    const sinComunidad = aEventos({ ...ATENCION, jornada: { nombre: "X", fecha: "2026-05-10" } });
    expect(sinComunidad[0].comunidad).toBeNull();
  });
});

describe("agruparPorJornada", () => {
  it("junta los eventos de una misma jornada en un grupo", () => {
    const grupos = agruparPorJornada(EVENTOS);

    expect(grupos).toHaveLength(1);
    expect(grupos[0].jornada).toBe("Jornada Chuicutama");
    expect(grupos[0].comunidad).toBe("Chuicutama");
    expect(grupos[0].eventos).toHaveLength(3);
  });

  it("respeta el orden en que llegan los eventos, que ya viene invertido", () => {
    const grupos = agruparPorJornada([
      {
        jornadaId: "j-2",
        jornada: "Mayo",
        fechaDeJornada: "2026-05-01",
        tipo: "consulta",
        id: "1",
      },
      {
        jornadaId: "j-1",
        jornada: "Marzo",
        fechaDeJornada: "2026-03-01",
        tipo: "consulta",
        id: "2",
      },
    ]);

    expect(grupos.map((grupo) => grupo.jornada)).toEqual(["Mayo", "Marzo"]);
  });

  it("agrupa por atencion cuando no hay jornada", () => {
    const grupos = agruparPorJornada([
      { atencionId: "a-9", jornadaId: null, tipo: "consulta", id: "1", fecha: "2026-01-01" },
      { atencionId: "a-9", jornadaId: null, tipo: "receta", id: "2", fecha: "2026-01-01" },
    ]);

    expect(grupos).toHaveLength(1);
    expect(grupos[0].eventos).toHaveLength(2);
  });

  it("devuelve una lista vacia sin eventos", () => {
    expect(agruparPorJornada([])).toEqual([]);
    expect(agruparPorJornada()).toEqual([]);
  });
});

describe("filtrarPorTipo", () => {
  it("sin tipo devuelve todo", () => {
    expect(filtrarPorTipo(EVENTOS, "")).toHaveLength(3);
  });

  it("deja solo el tipo pedido", () => {
    expect(filtrarPorTipo(EVENTOS, TIPOS_DE_EVENTO.RECETA)).toHaveLength(1);
    expect(filtrarPorTipo(EVENTOS, TIPOS_DE_EVENTO.TRIAJE)[0].tipo).toBe(TIPOS_DE_EVENTO.TRIAJE);
  });

  it("un tipo sin eventos da una lista vacia, no todo", () => {
    expect(filtrarPorTipo([EVENTOS[0]], TIPOS_DE_EVENTO.RECETA)).toEqual([]);
  });
});

describe("hayFiltrosDeHistorial", () => {
  it("es falso con los filtros vacios", () => {
    expect(hayFiltrosDeHistorial(FILTROS_HISTORIAL_VACIOS)).toBe(false);
    expect(hayFiltrosDeHistorial({})).toBe(false);
  });

  it("es verdadero con cualquiera de los tres puesto", () => {
    expect(hayFiltrosDeHistorial({ ...FILTROS_HISTORIAL_VACIOS, desde: "2026-01-01" })).toBe(true);
    expect(hayFiltrosDeHistorial({ ...FILTROS_HISTORIAL_VACIOS, tipo: "consulta" })).toBe(true);
  });
});

describe("FILTROS_HISTORIAL", () => {
  it("declara los tres filtros que pide el criterio 4", () => {
    expect(FILTROS_HISTORIAL.map((filtro) => filtro.id)).toEqual(["desde", "hasta", "tipo"]);
  });

  it("cada filtro tiene contraparte en el estado vacio", () => {
    for (const filtro of FILTROS_HISTORIAL) {
      expect(FILTROS_HISTORIAL_VACIOS).toHaveProperty(filtro.id);
    }
  });
});
