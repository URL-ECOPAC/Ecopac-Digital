// Pruebas de varias consultas por visita y de la consulta agendada (issue #927, 00184). Datos
// inventados.

import { describe, expect, it } from "vitest";

import { aVisita } from "./historial.api.js";
import {
  aDatosDeConsulta,
  agendadaDeConsulta,
  claveDeBorrador,
  consultaObjetivoDeVisita,
  permisosDeConsulta,
  valoresDeConsulta,
} from "./useConsulta.js";
import { ROLES } from "../usuarios/roles.js";

const SIN_CITA = {
  id: "c-1",
  citaId: null,
  motivoConsulta: "Dolor",
  areaId: null,
  diagnosticos: [],
};
const CON_CITA = {
  id: "c-2",
  citaId: "cita-1",
  motivoConsulta: "Control dental",
  areaId: "a-odo",
  diagnosticos: [],
};
const VISITA = {
  atencionId: "at-1",
  jornadaId: "j-1",
  consulta: SIN_CITA,
  consultas: [SIN_CITA, CON_CITA],
};

describe("consultaObjetivoDeVisita", () => {
  it("sin cita trabaja sobre la consulta que no salio de una cita", () => {
    expect(consultaObjetivoDeVisita(VISITA)).toBe(SIN_CITA);
    expect(consultaObjetivoDeVisita({ consultas: [CON_CITA] })).toBeNull();
  });

  it("con cita, sobre la consulta de esa cita, o ninguna si todavia no se registro", () => {
    expect(consultaObjetivoDeVisita(VISITA, { cita: { id: "cita-1" } })).toBe(CON_CITA);
    expect(consultaObjetivoDeVisita(VISITA, { cita: { id: "cita-2" } })).toBeNull();
  });

  it("con consultaId, sobre esa; y acepta una visita vieja que solo trae `consulta`", () => {
    expect(consultaObjetivoDeVisita(VISITA, { consultaId: "c-2" })).toBe(CON_CITA);
    expect(consultaObjetivoDeVisita({ consulta: SIN_CITA })).toBe(SIN_CITA);
    expect(consultaObjetivoDeVisita(null)).toBeNull();
  });
});

describe("la consulta agendada en el formulario", () => {
  it("los valores salen de la consulta elegida, con su area", () => {
    expect(valoresDeConsulta(VISITA, CON_CITA)).toMatchObject({
      motivoConsulta: "Control dental",
      areaId: "a-odo",
    });
    expect(valoresDeConsulta(VISITA).motivoConsulta).toBe("Dolor");
  });

  it("viaja con la cita y el area", () => {
    const datos = aDatosDeConsulta(
      { motivoConsulta: "X", areaId: "a-odo", diagnosticos: [] },
      { expedienteId: "e", atencionId: "a", medicoId: "m", jornadaId: "j", citaId: "cita-1" },
    );
    expect(datos).toMatchObject({ citaId: "cita-1", areaId: "a-odo" });
    expect(
      aDatosDeConsulta(
        { motivoConsulta: "X" },
        { expedienteId: "e", atencionId: "a", medicoId: "m", jornadaId: "j" },
      ),
    ).toMatchObject({ citaId: null, areaId: null });
  });

  it("el borrador de una cita no pisa el de la otra consulta de la visita", () => {
    expect(claveDeBorrador("p", "j")).toBe("ecopac:consulta:p:j");
    expect(claveDeBorrador("p", "j", "cita-1")).toBe("ecopac:consulta:p:j:cita-1");
  });

  it("los permisos se calculan sobre la consulta elegida", () => {
    const ajena = { ...CON_CITA, profesionalId: "otro" };
    expect(permisosDeConsulta(ROLES.MEDICO, VISITA, "yo", null).consulta).toBe(true);
    expect(typeof permisosDeConsulta(ROLES.MEDICO, VISITA, "yo", ajena).consulta).toBe("boolean");
  });
});

describe("aVisita con varias consultas", () => {
  const atencion = {
    id: "at-1",
    jornadaId: "j-1",
    createdAt: "2026-10-03T14:00:00Z",
    jornada: { nombre: "Jornada", fecha: "2026-10-03", comunidad: { nombre: "Aldea" } },
    triajes: [],
    consultas: [
      {
        id: "c-tarde",
        createdAt: "2026-10-03T17:00:00Z",
        motivoConsulta: "Segunda",
        citaId: "cita-1",
        areaId: "a-odo",
        area: { nombre: "Odontología", esVigente: true },
        cita: {
          iniciaEn: "2026-10-03T16:30:00Z",
          terminaEn: "2026-10-03T17:00:00Z",
          clinica: { nombre: "Clínica Central" },
          profesionalDeLaCita: { nombres: "Ana", apellidos: "Medica" },
        },
        diagnosticos: [],
        recetas: [],
      },
      {
        id: "c-temprano",
        createdAt: "2026-10-03T15:00:00Z",
        motivoConsulta: "Primera",
        citaId: null,
        area: null,
        diagnosticos: [],
        recetas: [],
      },
    ],
  };

  it("ordena las consultas de la primera a la ultima y conserva la primera como `consulta`", () => {
    const visita = aVisita(atencion);
    expect(visita.consultas.map((consulta) => consulta.id)).toEqual(["c-temprano", "c-tarde"]);
    expect(visita.consulta.id).toBe("c-temprano");
  });

  it("marca la agendada con su area, clinica, hora y profesional", () => {
    const agendada = aVisita(atencion).consultas[1];
    expect(agendada).toMatchObject({
      agendada: true,
      citaId: "cita-1",
      area: "Odontología",
      cita: {
        clinica: "Clínica Central",
        profesional: "Ana Medica",
        iniciaEn: "2026-10-03T16:30:00Z",
      },
    });
    expect(aVisita(atencion).consultas[0].agendada).toBe(false);
  });
});

describe("agruparPacientesAtendidos (#927)", async () => {
  const { agruparPacientesAtendidos } = await import("./consultas.api.js");

  it("un paciente con dos consultas en la jornada sale una vez, con sus diagnosticos", () => {
    const gripe = { id: "d-1", nombre: "Gripe", esPrincipal: true };
    const caries = { id: "d-2", nombre: "Caries", esPrincipal: true };
    const filas = agruparPacientesAtendidos([
      {
        consultaId: "c-2",
        createdAt: "2026-10-03T17:00:00Z",
        pacienteId: "p-1",
        diagnosticos: [caries, gripe],
        diagnosticoPrincipal: caries,
      },
      {
        consultaId: "c-1",
        createdAt: "2026-10-03T15:00:00Z",
        pacienteId: "p-1",
        diagnosticos: [gripe],
        diagnosticoPrincipal: gripe,
      },
      {
        consultaId: "c-3",
        createdAt: "2026-10-03T16:00:00Z",
        pacienteId: "p-2",
        diagnosticos: [],
        diagnosticoPrincipal: null,
      },
    ]);
    expect(filas).toHaveLength(2);
    expect(filas[0]).toMatchObject({
      consultaId: "c-1",
      consultas: 2,
      diagnosticoPrincipal: gripe,
    });
    expect(filas[0].diagnosticos.map((uno) => uno.id)).toEqual(["d-1", "d-2"]);
    expect(filas[1]).toMatchObject({ pacienteId: "p-2", consultas: 1 });
    expect(agruparPacientesAtendidos()).toEqual([]);
  });
});

describe("agendadaDeConsulta", () => {
  it("es agendada la que se atiende desde una cita, con el detalle de la cita", () => {
    expect(agendadaDeConsulta({ id: "cita-1", detalle: "Clinica A" }, null)).toEqual({
      detalle: "Clinica A",
    });
  });

  it("tambien la que ya salio de una cita y se reabre desde el historial", () => {
    const reabierta = {
      ...CON_CITA,
      cita: { clinica: "Clinica A", iniciaEn: null, profesional: "Prof Demo" },
    };
    expect(agendadaDeConsulta(null, reabierta)).toEqual({ detalle: "Clinica A · Prof Demo" });
  });

  it("no lo es una consulta sin cita ni una nueva", () => {
    expect(agendadaDeConsulta(null, SIN_CITA)).toBeNull();
    expect(agendadaDeConsulta(null, null)).toBeNull();
  });
});
