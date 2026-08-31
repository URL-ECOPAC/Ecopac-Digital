import { describe, expect, it } from "vitest";

import { FILTROS_REPORTES_VACIOS } from "./filtros.js";
import {
  aParametrosDeIndicadoresImpacto,
  aParametrosDeReportePacientes,
  mapearCatalogoAOpciones,
  PRESETS_DE_RANGO,
  resolverFiltrosReportesDesdeParametros,
  resolverRangoDePreset,
  serializarFiltrosReportes,
} from "./useFiltrosReportes.js";

// Solo se prueban las funciones puras: packages/shared/vitest.config.js corre en
// environment "node", sin DOM, asi que el hook (useState/useEffect) no se monta aca, igual que
// useBusquedaPacientes.js no prueba su propio useEffect de retardo, solo sus guardas.

describe("resolverRangoDePreset", () => {
  const hoy = new Date(2026, 7, 29); // 29 de agosto de 2026

  it("este mes: del primer dia del mes a hoy", () => {
    expect(resolverRangoDePreset(PRESETS_DE_RANGO.ESTE_MES, hoy)).toEqual({
      min: "2026-08-01",
      max: "2026-08-29",
    });
  });

  it("ultimo trimestre: tres meses calendario atras, mismo dia, a hoy", () => {
    expect(resolverRangoDePreset(PRESETS_DE_RANGO.ULTIMO_TRIMESTRE, hoy)).toEqual({
      min: "2026-05-29",
      max: "2026-08-29",
    });
  });

  it("ultimo trimestre cruza el fin de anio", () => {
    const hoyDeMarzo = new Date(2026, 2, 15); // 15 de marzo de 2026
    expect(resolverRangoDePreset(PRESETS_DE_RANGO.ULTIMO_TRIMESTRE, hoyDeMarzo)).toEqual({
      min: "2025-12-15",
      max: "2026-03-15",
    });
  });

  it("este anio: del 1 de enero a hoy", () => {
    expect(resolverRangoDePreset(PRESETS_DE_RANGO.ESTE_ANIO, hoy)).toEqual({
      min: "2026-01-01",
      max: "2026-08-29",
    });
  });

  it("personalizado no calcula nada: el rango lo pone la persona", () => {
    expect(resolverRangoDePreset(PRESETS_DE_RANGO.PERSONALIZADO, hoy)).toEqual({
      min: null,
      max: null,
    });
  });

  it("un preset desconocido se trata como personalizado", () => {
    expect(resolverRangoDePreset("no-existe", hoy)).toEqual({ min: null, max: null });
  });
});

describe("serializarFiltrosReportes / resolverFiltrosReportesDesdeParametros", () => {
  it("hace ida y vuelta completa sin perder datos", () => {
    const valores = {
      periodo: { min: "2026-01-01", max: "2026-03-31" },
      comunidad: "com-1",
      jornada: "jor-1",
      proyecto: "proy-1",
    };

    const parametros = serializarFiltrosReportes(valores, PRESETS_DE_RANGO.PERSONALIZADO);
    expect(parametros).toEqual({
      preset: PRESETS_DE_RANGO.PERSONALIZADO,
      fechaInicio: "2026-01-01",
      fechaFin: "2026-03-31",
      comunidad: "com-1",
      jornada: "jor-1",
      proyecto: "proy-1",
    });

    expect(resolverFiltrosReportesDesdeParametros(parametros)).toEqual({
      valores,
      presetActivo: PRESETS_DE_RANGO.PERSONALIZADO,
    });
  });

  it("serializar omite las claves nulas o vacias, para que el link quede corto", () => {
    expect(serializarFiltrosReportes(FILTROS_REPORTES_VACIOS)).toEqual({});
  });

  it("resolver cae a vacio ante parametros ausentes", () => {
    expect(resolverFiltrosReportesDesdeParametros()).toEqual({
      valores: FILTROS_REPORTES_VACIOS,
      presetActivo: null,
    });
  });

  it("resolver descarta un preset que no existe en el enum", () => {
    const { presetActivo } = resolverFiltrosReportesDesdeParametros({ preset: "inventado" });
    expect(presetActivo).toBeNull();
  });

  it("resolver trata cadenas vacias igual que ausentes", () => {
    expect(
      resolverFiltrosReportesDesdeParametros({
        fechaInicio: "",
        comunidad: "",
        jornada: "",
        proyecto: "",
      }),
    ).toEqual({ valores: FILTROS_REPORTES_VACIOS, presetActivo: null });
  });
});

describe("mapearCatalogoAOpciones", () => {
  it("traduce id/nombre a label/value", () => {
    const filas = [
      { id: "c1", nombre: "San Marcos" },
      { id: "c2", nombre: "Solola" },
    ];

    expect(mapearCatalogoAOpciones(filas)).toEqual([
      { value: "c1", label: "San Marcos" },
      { value: "c2", label: "Solola" },
    ]);
  });

  it("admite una lista vacia o null sin reventar", () => {
    expect(mapearCatalogoAOpciones([])).toEqual([]);
    expect(mapearCatalogoAOpciones(null)).toEqual([]);
  });
});

describe("aParametrosDeIndicadoresImpacto", () => {
  it("anida el rango bajo periodo con fechaInicio/fechaFin", () => {
    const filtrosAplicados = {
      periodo: { min: "2026-01-01", max: "2026-03-31" },
      comunidad: "com-1",
      jornada: "jor-1",
      proyecto: "proy-1",
    };

    expect(aParametrosDeIndicadoresImpacto(filtrosAplicados)).toEqual({
      periodo: { fechaInicio: "2026-01-01", fechaFin: "2026-03-31" },
      comunidad: "com-1",
      jornada: "jor-1",
      proyecto: "proy-1",
    });
  });

  it("sin filtros aplicados, entrega un periodo de nulos", () => {
    expect(aParametrosDeIndicadoresImpacto(FILTROS_REPORTES_VACIOS)).toEqual({
      periodo: { fechaInicio: null, fechaFin: null },
      comunidad: undefined,
      jornada: undefined,
      proyecto: undefined,
    });
  });
});

describe("aParametrosDeReportePacientes", () => {
  it("aplana el rango a desde/hasta y descarta proyecto: esa API no lo admite", () => {
    const filtrosAplicados = {
      periodo: { min: "2026-01-01", max: "2026-03-31" },
      comunidad: "com-1",
      jornada: "jor-1",
      proyecto: "proy-1",
    };

    const parametros = aParametrosDeReportePacientes(filtrosAplicados);
    expect(parametros).toEqual({
      desde: "2026-01-01",
      hasta: "2026-03-31",
      comunidad: "com-1",
      jornada: "jor-1",
    });
    expect(parametros).not.toHaveProperty("proyecto");
  });
});
