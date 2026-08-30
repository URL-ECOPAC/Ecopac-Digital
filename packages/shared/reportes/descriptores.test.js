// Pruebas de los descriptores de reportes (issue #289).
//
// Mismo patron que presupuestos/presupuestos.test.js, el unico precedente real de este tipo de
// prueba en el repo: verificar que los descriptores usen el vocabulario de descriptores.js y
// no tipos ni claves inventadas. reportes no tiene una sola tabla contra la cual validar ids
// (son cuatro reportes distintos, cada uno con su propia forma), asi que aqui no se repite la
// prueba de "todo id existe en la tabla X" -- eso se verifico a mano releyendo las cuatro
// funciones de reportes/*.api.js al escribir columnas.js.

import { describe, expect, it } from "vitest";

import { TIPOS_DE_CAMPO, TIPOS_DE_FILTRO, TIPOS_DE_PRESENTACION } from "../descriptores.js";
import {
  CAMPOS_ANALISIS_IMPACTO,
  CAMPOS_REPORTE_VENCIMIENTO,
  ESTADOS_DE_VENCIMIENTO_REPORTE,
  ESTADOS_JORNADA_REPORTE,
  OPCIONES_AGRUPACION_IMPACTO,
  OPCIONES_METRICA_IMPACTO,
} from "./campos.js";
import {
  CAMPOS_FICHA_LOTE_INVENTARIO,
  CAMPOS_FICHA_RESULTADOS_JORNADA,
  CAMPOS_TOTALES_INVENTARIO_REPORTE,
  COLUMNAS_DIAGNOSTICOS_MAS_FRECUENTES,
  COLUMNAS_INDICADORES_IMPACTO,
  COLUMNAS_INVENTARIO_REPORTE,
  COLUMNAS_MEDICAMENTOS_MAS_ENTREGADOS,
  COLUMNAS_PACIENTES_ATENDIDOS,
  COLUMNAS_PERSONAL_PARTICIPANTE,
} from "./columnas.js";
import {
  FILTROS_INVENTARIO_REPORTE,
  FILTROS_INVENTARIO_REPORTE_VACIOS,
  FILTROS_REPORTES,
  FILTROS_REPORTES_VACIOS,
} from "./filtros.js";
import { AGRUPACIONES_DE_IMPACTO } from "./api.js";
import { ESTADOS_DE_VENCIMIENTO } from "./inventario.api.js";

const TODAS_LAS_LISTAS_DE_CAMPOS = {
  CAMPOS_ANALISIS_IMPACTO,
  CAMPOS_REPORTE_VENCIMIENTO,
};

const TODAS_LAS_LISTAS_DE_COLUMNAS = {
  CAMPOS_FICHA_LOTE_INVENTARIO,
  CAMPOS_FICHA_RESULTADOS_JORNADA,
  CAMPOS_TOTALES_INVENTARIO_REPORTE,
  COLUMNAS_DIAGNOSTICOS_MAS_FRECUENTES,
  COLUMNAS_INDICADORES_IMPACTO,
  COLUMNAS_INVENTARIO_REPORTE,
  COLUMNAS_MEDICAMENTOS_MAS_ENTREGADOS,
  COLUMNAS_PACIENTES_ATENDIDOS,
  COLUMNAS_PERSONAL_PARTICIPANTE,
};

const TODAS_LAS_LISTAS_DE_FILTROS = { FILTROS_REPORTES, FILTROS_INVENTARIO_REPORTE };

// Catalogos que un hook de pantalla (fuera de esta issue) tiene que pasar por `catalogos`.
const CATALOGOS_CONOCIDOS = new Set([
  "comunidades",
  "jornadas",
  "proyectos",
  "bodegas",
  "estadosDeVencimientoReporte",
  "estadosJornadaReporte",
]);

describe("campos.js solo usa el vocabulario de TIPOS_DE_CAMPO", () => {
  const tiposValidos = Object.values(TIPOS_DE_CAMPO);

  for (const [nombre, lista] of Object.entries(TODAS_LAS_LISTAS_DE_CAMPOS)) {
    it(`${nombre}: cada campo declara id, label y un tipo valido`, () => {
      expect(Array.isArray(lista)).toBe(true);
      expect(lista.length).toBeGreaterThan(0);

      for (const campo of lista) {
        expect(campo.id).toBeTruthy();
        expect(campo.label).toBeTruthy();
        expect(tiposValidos).toContain(campo.tipo);
      }
    });
  }

  it("los campos SELECT declaran opciones u opcionesDesde, nunca los dos ni ninguno", () => {
    for (const lista of Object.values(TODAS_LAS_LISTAS_DE_CAMPOS)) {
      for (const campo of lista) {
        if (campo.tipo !== TIPOS_DE_CAMPO.SELECT) continue;
        const tieneOpciones = Boolean(campo.opciones);
        const tieneOpcionesDesde = Boolean(campo.opcionesDesde);
        expect(tieneOpciones || tieneOpcionesDesde).toBe(true);
      }
    }
  });
});

describe("columnas.js solo usa el vocabulario de TIPOS_DE_PRESENTACION", () => {
  const tiposValidos = Object.values(TIPOS_DE_PRESENTACION);

  for (const [nombre, lista] of Object.entries(TODAS_LAS_LISTAS_DE_COLUMNAS)) {
    it(`${nombre}: cada columna declara id, label y un tipo valido`, () => {
      expect(Array.isArray(lista)).toBe(true);
      expect(lista.length).toBeGreaterThan(0);

      for (const columna of lista) {
        expect(columna.id).toBeTruthy();
        expect(columna.label).toBeTruthy();
        expect(tiposValidos).toContain(columna.tipo);
      }
    });
  }

  it("las columnas ESTADO declaran etiquetasDesde apuntando a un catalogo conocido", () => {
    for (const lista of Object.values(TODAS_LAS_LISTAS_DE_COLUMNAS)) {
      for (const columna of lista) {
        if (columna.tipo !== TIPOS_DE_PRESENTACION.ESTADO) continue;
        expect(columna.etiquetasDesde).toBeTruthy();
        expect(CATALOGOS_CONOCIDOS).toContain(columna.etiquetasDesde);
      }
    }
  });

  it("ninguna columna usa un `desde` con ruta anidada (DataList solo lee una clave plana)", () => {
    for (const lista of Object.values(TODAS_LAS_LISTAS_DE_COLUMNAS)) {
      for (const columna of lista) {
        if (columna.desde) expect(columna.desde).not.toContain(".");
      }
    }
  });
});

describe("filtros.js solo usa el vocabulario de TIPOS_DE_FILTRO", () => {
  const tiposValidos = Object.values(TIPOS_DE_FILTRO);

  for (const [nombre, lista] of Object.entries(TODAS_LAS_LISTAS_DE_FILTROS)) {
    it(`${nombre}: cada filtro declara id y un tipo valido`, () => {
      expect(Array.isArray(lista)).toBe(true);
      expect(lista.length).toBeGreaterThan(0);

      for (const filtro of lista) {
        expect(filtro.id).toBeTruthy();
        expect(tiposValidos).toContain(filtro.tipo);
      }
    });
  }

  it("los filtros SELECT resuelven sus opciones por opciones u opcionesDesde", () => {
    for (const lista of Object.values(TODAS_LAS_LISTAS_DE_FILTROS)) {
      for (const filtro of lista) {
        if (filtro.tipo !== TIPOS_DE_FILTRO.SELECT) continue;
        expect(Boolean(filtro.opciones || filtro.opcionesDesde)).toBe(true);
        if (filtro.opcionesDesde) expect(CATALOGOS_CONOCIDOS).toContain(filtro.opcionesDesde);
      }
    }
  });

  it("el filtro de periodo es un solo RANGO con desde/hasta, no dos filtros de fecha sueltos", () => {
    const periodo = FILTROS_REPORTES.find((f) => f.id === "periodo");
    expect(periodo.tipo).toBe(TIPOS_DE_FILTRO.RANGO);
    expect(periodo.desde).toBe("fechaInicio");
    expect(periodo.hasta).toBe("fechaFin");
  });

  it("los *_VACIOS tienen exactamente las mismas claves que su lista de filtros", () => {
    expect(Object.keys(FILTROS_REPORTES_VACIOS).sort()).toEqual(
      FILTROS_REPORTES.map((f) => f.id).sort(),
    );
    expect(Object.keys(FILTROS_INVENTARIO_REPORTE_VACIOS).sort()).toEqual(
      FILTROS_INVENTARIO_REPORTE.map((f) => f.id).sort(),
    );
  });
});

describe("los catalogos de estado reflejan los enum reales", () => {
  it("ESTADOS_DE_VENCIMIENTO_REPORTE cubre vigentes y vencidos, nunca 'todos'", () => {
    const valores = ESTADOS_DE_VENCIMIENTO_REPORTE.map((e) => e.value);
    expect(valores).toEqual([ESTADOS_DE_VENCIMIENTO.VIGENTES, ESTADOS_DE_VENCIMIENTO.VENCIDOS]);
    expect(valores).not.toContain(ESTADOS_DE_VENCIMIENTO.TODOS);
    for (const estado of ESTADOS_DE_VENCIMIENTO_REPORTE) {
      expect(estado.label).toBeTruthy();
    }
  });

  it("ESTADOS_JORNADA_REPORTE tiene los cuatro valores de estado_jornada, con etiqueta", () => {
    const valores = ESTADOS_JORNADA_REPORTE.map((e) => e.value);
    expect(valores).toEqual(["planificada", "en curso", "finalizada", "cancelada"]);
    for (const estado of ESTADOS_JORNADA_REPORTE) {
      expect(estado.label).toBeTruthy();
    }
  });

  it("OPCIONES_AGRUPACION_IMPACTO deriva de AGRUPACIONES_DE_IMPACTO, no lo duplica a mano", () => {
    expect(OPCIONES_AGRUPACION_IMPACTO.map((o) => o.value).sort()).toEqual(
      Object.values(AGRUPACIONES_DE_IMPACTO).sort(),
    );
  });

  it("OPCIONES_METRICA_IMPACTO tiene las cuatro metricas del reporte de impacto", () => {
    expect(OPCIONES_METRICA_IMPACTO.map((o) => o.value).sort()).toEqual(
      [
        "pacientes_atendidos",
        "tratamientos_entregados",
        "medicamentos_utilizados",
        "comunidades_beneficiadas",
      ].sort(),
    );
  });
});
