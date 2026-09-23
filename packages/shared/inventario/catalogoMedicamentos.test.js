import { describe, expect, it } from "vitest";

import {
  filtrarCatalogoMedicamentos,
  hayFiltrosDeCatalogo,
  resumirLotesPorMedicamento,
} from "./catalogoMedicamentos.js";

const HOY = new Date();
const enDias = (dias) => {
  const fecha = new Date(HOY.getFullYear(), HOY.getMonth(), HOY.getDate() + dias);
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${fecha.getFullYear()}-${mes}-${dia}`;
};

const MEDICAMENTOS = [
  {
    id: "m-1",
    nombre: "Acetaminofen",
    marca: "Generico",
    concentracion: "500 mg",
    presentacion: "Tableta",
    presentacionId: "p-tableta",
    esPediatrico: false,
    activo: true,
  },
  {
    id: "m-2",
    nombre: "Amoxicilina",
    marca: "Bayer",
    concentracion: "250 mg/5 ml",
    presentacion: "Suspensión",
    presentacionId: "p-suspension",
    esPediatrico: true,
    activo: true,
  },
  {
    id: "m-3",
    nombre: "Ibuprofeno",
    marca: "Genfar",
    concentracion: "400 mg",
    presentacion: "Tableta",
    presentacionId: "p-tableta",
    esPediatrico: false,
    activo: false,
  },
];

const LOTES = [
  { medicamentoId: "m-1", numeroLote: "L-100", fechaVencimiento: enDias(40) },
  { medicamentoId: "m-1", numeroLote: "L-101", fechaVencimiento: enDias(10) },
  { medicamentoId: "m-1", numeroLote: "L-099", fechaVencimiento: enDias(-5) },
  { medicamentoId: "m-2", numeroLote: "AMX-7", fechaVencimiento: enDias(200) },
];

describe("resumirLotesPorMedicamento", () => {
  it("cuenta lotes y vencidos, y toma el vencimiento vigente mas proximo", () => {
    const resumen = resumirLotesPorMedicamento(LOTES);

    expect(resumen.get("m-1")).toMatchObject({
      lotes: 3,
      vencidos: 1,
      proximoVencimiento: enDias(10),
      diasParaProximo: 10,
    });
    expect(resumen.get("m-3")).toBeUndefined();
  });
});

describe("filtrarCatalogoMedicamentos", () => {
  it("sin filtros devuelve todo: la categoria inexistente ya no vacia la tabla", () => {
    expect(filtrarCatalogoMedicamentos(MEDICAMENTOS, {})).toHaveLength(3);
  });

  it("filtra por presentacion, uso y estado", () => {
    const ids = (filtros) => filtrarCatalogoMedicamentos(MEDICAMENTOS, filtros).map((m) => m.id);

    expect(ids({ presentacionId: "p-tableta" })).toEqual(["m-1", "m-3"]);
    expect(ids({ poblacion: "pediatrico" })).toEqual(["m-2"]);
    expect(ids({ poblacion: "general", estado: "activos" })).toEqual(["m-1"]);
    expect(ids({ estado: "inactivos" })).toEqual(["m-3"]);
  });

  it("busca por nombre sin acentos, por marca y por numero de lote", () => {
    const resumen = resumirLotesPorMedicamento(LOTES);
    const buscar = (busqueda) =>
      filtrarCatalogoMedicamentos(MEDICAMENTOS, { busqueda }, resumen).map((m) => m.id);

    expect(buscar("acetaminofén")).toEqual(["m-1"]);
    expect(buscar("bayer")).toEqual(["m-2"]);
    expect(buscar("amx-7")).toEqual(["m-2"]);
  });
});

describe("hayFiltrosDeCatalogo", () => {
  it("detecta cualquier filtro puesto, pero no una busqueda en blanco", () => {
    expect(hayFiltrosDeCatalogo({ busqueda: "   " })).toBe(false);
    expect(hayFiltrosDeCatalogo({ estado: "activos" })).toBe(true);
  });
});
