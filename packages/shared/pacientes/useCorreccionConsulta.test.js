// Prueba de la logica pura del hook de correccion de consulta (issue #756).
//
// El hook en si no se monta: packages/shared corre vitest con environment "node", sin DOM,
// mismo motivo que useCorreccionTriaje.js. valoresDesdeConsulta() se exporta aparte para poder
// probarla sin montar nada.

import { describe, expect, it } from "vitest";

import { valoresDesdeConsulta } from "./useCorreccionConsulta.js";

describe("valoresDesdeConsulta", () => {
  it("sin consulta, los siete campos caen en cadena vacia", () => {
    expect(valoresDesdeConsulta(null)).toEqual({
      motivoConsulta: "",
      antecedentes: "",
      sintomas: "",
      exploracion: "",
      tratamiento: "",
      observaciones: "",
      planSeguimiento: "",
    });
  });

  it("con consulta, copia cada campo tal cual", () => {
    const consulta = {
      id: "con-1",
      motivoConsulta: "Dolor de cabeza",
      antecedentes: "Migrana previa",
      sintomas: "Dolor pulsatil",
      exploracion: "Sin hallazgos",
      tratamiento: "Analgesico",
      observaciones: "Control en una semana",
      planSeguimiento: "Reevaluar",
    };

    expect(valoresDesdeConsulta(consulta)).toEqual({
      motivoConsulta: "Dolor de cabeza",
      antecedentes: "Migrana previa",
      sintomas: "Dolor pulsatil",
      exploracion: "Sin hallazgos",
      tratamiento: "Analgesico",
      observaciones: "Control en una semana",
      planSeguimiento: "Reevaluar",
    });
  });

  it("un campo opcional ausente cae en cadena vacia, no en null ni undefined", () => {
    const consulta = { id: "con-1", motivoConsulta: "Dolor de cabeza" };

    const valores = valoresDesdeConsulta(consulta);
    expect(valores.antecedentes).toBe("");
    expect(valores.observaciones).toBe("");
  });

  it("no incluye diagnosticos: esa columna es de consulta_diagnostico, no de consultas", () => {
    const consulta = { id: "con-1", diagnosticos: [{ id: "dx-1" }] };

    expect(valoresDesdeConsulta(consulta)).not.toHaveProperty("diagnosticos");
  });
});
