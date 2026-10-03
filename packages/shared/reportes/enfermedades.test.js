// Pruebas de las transformaciones del reporte de enfermedades y de las funciones puras de su hook
// (issue #916). Conteos inventados. Desde la issue #926 toda cifra llega con su numero, tambien las
// de 1 a 4.

import { describe, expect, it } from "vitest";

import { CONTEO_DE_DIAGNOSTICOS } from "./campos.js";
import {
  diagnosticoMasFrecuente,
  etiquetaDeMes,
  filasDeRankingDeEnfermedades,
  graficaDeRankingDeEnfermedades,
  pivotearComparacionDeEnfermedades,
  serieDeEvolucionDeEnfermedad,
} from "./enfermedades.js";
import { COMUNIDAD_DE, VISTAS_DE_ENFERMEDADES } from "./enfermedades.api.js";
import { FILTROS_ENFERMEDADES_VACIOS } from "./filtros.js";
import {
  catalogosDeEnfermedades,
  parametrosDeReporteEnfermedades,
} from "./useReporteEnfermedades.js";

/** Un caso como lo entrega obtenerReporteEnfermedades(). */
function caso(parcial) {
  return {
    grupoId: "todo",
    grupo: "Todo el período",
    grupoFecha: null,
    diagnosticoId: "dx-ira",
    codigo: "J06.9",
    diagnostico: "IRA",
    orden: 1,
    casos: 10,
    hombres: 5,
    mujeres: 5,
    menores: 0,
    adultos: 10,
    adultosMayores: 0,
    ...parcial,
  };
}

describe("etiquetaDeMes", () => {
  it("abrevia el mes en espanol", () => {
    expect(etiquetaDeMes("2026-03")).toBe("mar 2026");
    expect(etiquetaDeMes("2026-12")).toBe("dic 2026");
  });

  it("deja pasar lo que no es un mes", () => {
    expect(etiquetaDeMes("otra cosa")).toBe("otra cosa");
  });
});

describe("ranking", () => {
  const casos = [
    caso({}),
    caso({
      diagnosticoId: "dx-vih",
      diagnostico: "VIH",
      codigo: null,
      orden: 2,
      casos: 3,
      hombres: 1,
      mujeres: 2,
      adultos: 3,
    }),
  ];

  it("una fila por enfermedad, con el numero real tambien en las cifras bajas", () => {
    const filas = filasDeRankingDeEnfermedades(casos);

    expect(filas[0]).toMatchObject({ id: "dx-ira", casos: 10, hombres: 5, codigo: "J06.9" });
    expect(filas[1]).toEqual({
      id: "dx-vih",
      diagnostico: "VIH",
      codigo: "",
      casos: 3,
      hombres: 1,
      mujeres: 2,
      menores: 0,
      adultos: 3,
      adultosMayores: 0,
    });
  });

  it("1, 2, 3 y 4 casos salen con su numero en la tabla y en la grafica", () => {
    const bajos = [1, 2, 3, 4].map((cifra) =>
      caso({
        diagnosticoId: `dx-${cifra}`,
        diagnostico: `Enfermedad ${cifra}`,
        orden: 5 - cifra,
        casos: cifra,
        hombres: cifra,
        mujeres: 0,
        adultos: cifra,
      }),
    );

    const filas = filasDeRankingDeEnfermedades(bajos);
    expect(filas.map((fila) => [fila.casos, fila.hombres, fila.adultos])).toEqual([
      [1, 1, 1],
      [2, 2, 2],
      [3, 3, 3],
      [4, 4, 4],
    ]);
    expect(graficaDeRankingDeEnfermedades(bajos)).toEqual({
      etiquetas: ["Enfermedad 4", "Enfermedad 3", "Enfermedad 2", "Enfermedad 1"],
      series: [{ nombre: "Casos", valores: [4, 3, 2, 1] }],
    });
  });

  it("la grafica dibuja la cifra baja como una barra mas", () => {
    expect(graficaDeRankingDeEnfermedades(casos)).toEqual({
      etiquetas: ["IRA", "VIH"],
      series: [{ nombre: "Casos", valores: [10, 3] }],
    });
  });

  it("la grafica trae como maximo las primeras enfermedades por puesto", () => {
    const muchos = Array.from({ length: 15 }, (_, indice) =>
      caso({ diagnosticoId: `dx-${indice}`, diagnostico: `E${indice}`, orden: 15 - indice }),
    );
    const { etiquetas } = graficaDeRankingDeEnfermedades(muchos, { maximo: 3 });
    expect(etiquetas).toEqual(["E14", "E13", "E12"]);
  });

  it("la enfermedad mas frecuente es la del puesto 1", () => {
    expect(diagnosticoMasFrecuente(casos)).toBe("dx-ira");
    expect(diagnosticoMasFrecuente([])).toBeNull();
  });
});

describe("comparacion entre jornadas", () => {
  const casos = [
    caso({ grupoId: "jor-1", grupo: "Jornada 1", casos: 8 }),
    caso({
      grupoId: "jor-1",
      grupo: "Jornada 1",
      diagnosticoId: "dx-dia",
      diagnostico: "Diarrea",
      codigo: "A09",
      orden: 2,
      casos: 2,
    }),
    caso({ grupoId: "jor-2", grupo: "Jornada 2", casos: 6 }),
  ];

  it("una columna por jornada, en el orden de la base", () => {
    const { grupos } = pivotearComparacionDeEnfermedades(casos);
    expect(grupos).toEqual([
      { clave: "grupo_1", id: "jor-1", nombre: "Jornada 1" },
      { clave: "grupo_2", id: "jor-2", nombre: "Jornada 2" },
    ]);
  });

  it("la enfermedad que no aparece en una jornada cuenta cero ahi; la cifra baja, su numero", () => {
    const { filas } = pivotearComparacionDeEnfermedades(casos);
    expect(filas).toEqual([
      { id: "dx-ira", diagnostico: "IRA", codigo: "J06.9", grupo_1: 8, grupo_2: 6 },
      { id: "dx-dia", diagnostico: "Diarrea", codigo: "A09", grupo_1: 2, grupo_2: 0 },
    ]);
  });

  it("la grafica lleva una serie por jornada", () => {
    const { grafica } = pivotearComparacionDeEnfermedades(casos);
    expect(grafica).toEqual({
      etiquetas: ["IRA", "Diarrea"],
      series: [
        { nombre: "Jornada 1", valores: [8, 2] },
        { nombre: "Jornada 2", valores: [6, 0] },
      ],
    });
  });

  it("con demasiados grupos dibuja los primeros y dice cuantos quedaron fuera", () => {
    const muchos = Array.from({ length: 8 }, (_, indice) =>
      caso({ grupoId: `jor-${indice}`, grupo: `Jornada ${indice}` }),
    );
    const resultado = pivotearComparacionDeEnfermedades(muchos, { maximoDeGrupos: 6 });
    expect(resultado.grafica.series).toHaveLength(6);
    expect(resultado.gruposFueraDeGrafica).toBe(2);
    expect(resultado.grupos).toHaveLength(8);
  });
});

describe("evolucion de una enfermedad", () => {
  const casos = [
    caso({ grupoId: "2026-01", grupo: "2026-01", grupoFecha: "2026-01-01", casos: 6 }),
    caso({
      grupoId: "2026-03",
      grupo: "2026-03",
      grupoFecha: "2026-03-01",
      casos: 4,
    }),
    caso({
      grupoId: "2026-02",
      grupo: "2026-02",
      grupoFecha: "2026-02-01",
      diagnosticoId: "dx-otra",
      diagnostico: "Otra",
    }),
  ];

  it("rellena los meses sin casos con cero y deja los bajos con su numero", () => {
    const { filas } = serieDeEvolucionDeEnfermedad(casos, "dx-ira");
    expect(filas.map((fila) => [fila.periodo, fila.casos])).toEqual([
      ["ene 2026", 6],
      ["feb 2026", 0],
      ["mar 2026", 4],
    ]);
  });

  it("usa el periodo del filtro cuando lo hay", () => {
    const { grafica } = serieDeEvolucionDeEnfermedad(casos, "dx-ira", {
      desde: "2025-12-15",
      hasta: "2026-04-30",
    });
    expect(grafica.etiquetas).toEqual(["dic 2025", "ene 2026", "feb 2026", "mar 2026", "abr 2026"]);
    expect(grafica.series[0]).toEqual({ nombre: "IRA", valores: [0, 6, 0, 4, 0] });
  });

  it("sin enfermedad elegida no hay serie", () => {
    expect(serieDeEvolucionDeEnfermedad(casos, null).filas).toEqual([]);
  });
});

describe("parametrosDeReporteEnfermedades", () => {
  const filtros = {
    ...FILTROS_ENFERMEDADES_VACIOS,
    periodo: { min: "2026-01-01", max: null },
    jornada: "jor-filtro",
    comunidad: "com-filtro",
  };

  it("en el ranking usa la jornada y la comunidad del filtro", () => {
    const parametros = parametrosDeReporteEnfermedades({
      vista: VISTAS_DE_ENFERMEDADES.RANKING,
      filtros,
      comunidadDe: COMUNIDAD_DE.PACIENTE,
      conteo: CONTEO_DE_DIAGNOSTICOS.TODOS,
      jornadasAComparar: ["jor-a", "jor-b"],
    });

    expect(parametros).toMatchObject({
      desde: "2026-01-01",
      hasta: undefined,
      jornadas: ["jor-filtro"],
      comunidades: ["com-filtro"],
      soloPrincipales: false,
      comunidadDe: "paciente",
    });
  });

  it("al comparar jornadas manda lo elegido para comparar", () => {
    const parametros = parametrosDeReporteEnfermedades({
      vista: VISTAS_DE_ENFERMEDADES.JORNADAS,
      filtros,
      comunidadDe: COMUNIDAD_DE.JORNADA,
      conteo: CONTEO_DE_DIAGNOSTICOS.PRINCIPALES,
      jornadasAComparar: ["jor-a", "jor-b"],
    });

    expect(parametros.jornadas).toEqual(["jor-a", "jor-b"]);
    expect(parametros.soloPrincipales).toBe(true);
  });

  it("al comparar comunidades sin elegir ninguna, se queda con el filtro", () => {
    const parametros = parametrosDeReporteEnfermedades({
      vista: VISTAS_DE_ENFERMEDADES.COMUNIDADES,
      filtros: FILTROS_ENFERMEDADES_VACIOS,
      comunidadDe: COMUNIDAD_DE.JORNADA,
      conteo: CONTEO_DE_DIAGNOSTICOS.PRINCIPALES,
    });

    expect(parametros.comunidades).toEqual([]);
  });
});

describe("catalogosDeEnfermedades", () => {
  const fuentes = {
    departamentos: [
      { id: 1, nombre: "Guatemala" },
      { id: 2, nombre: "Quiché" },
    ],
    municipios: [
      { id: 101, nombre: "Guatemala", departamentoId: 1 },
      { id: 201, nombre: "Chichicastenango", departamentoId: 2 },
    ],
    comunidades: [
      { id: "c-1", nombre: "Zona 1", municipioId: 101 },
      { id: "c-2", nombre: "Chupol", municipioId: 201 },
    ],
    jornadas: [{ id: "jor-1", nombre: "Jornada 1", fecha: "2026-03-07" }],
    proyectos: [{ id: "pro-1", nombre: "Proyecto 1" }],
    diagnosticos: [
      { id: "dx-1", codigo: "J06.9", nombre: "IRA" },
      { id: "dx-2", codigo: null, nombre: "Otra" },
    ],
  };

  it("sin territorio elegido ofrece todo", () => {
    const catalogos = catalogosDeEnfermedades(fuentes, {});
    expect(catalogos.municipios).toHaveLength(2);
    expect(catalogos.comunidades).toHaveLength(2);
  });

  it("el departamento recorta municipios y comunidades", () => {
    const catalogos = catalogosDeEnfermedades(fuentes, { departamento: "2" });
    expect(catalogos.municipios).toEqual([{ value: "201", label: "Chichicastenango" }]);
    expect(catalogos.comunidades).toEqual([{ value: "c-2", label: "Chupol" }]);
  });

  it("el municipio recorta las comunidades", () => {
    const catalogos = catalogosDeEnfermedades(fuentes, { municipio: "101" });
    expect(catalogos.comunidades).toEqual([{ value: "c-1", label: "Zona 1" }]);
  });

  it("la jornada lleva su fecha y el diagnostico su codigo cuando lo tiene", () => {
    const catalogos = catalogosDeEnfermedades(fuentes, {});
    expect(catalogos.jornadas[0].label).toBe("Jornada 1 (07/03/2026)");
    expect(catalogos.diagnosticos.map((opcion) => opcion.label)).toEqual(["IRA (J06.9)", "Otra"]);
  });
});
