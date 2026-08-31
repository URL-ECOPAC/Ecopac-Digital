// Pruebas de los descriptores de proyectos, hitos y seguimiento (issue #287).
//
// Mismo patron que donaciones/descriptores.test.js y reportes/descriptores.test.js.

import { describe, expect, it } from "vitest";
import { labels } from "@ecopac/ui-tokens";

import { TIPOS_DE_CAMPO, TIPOS_DE_FILTRO, TIPOS_DE_PRESENTACION } from "../descriptores.js";
import {
  CAMPOS_HITO,
  CAMPOS_PROYECTO,
  CAMPOS_SEGUIMIENTO,
  OPCIONES_ESTADO_PROYECTO,
} from "./campos.js";
import {
  CAMPOS_FICHA_PROYECTO,
  COLUMNAS_HITO,
  COLUMNAS_PROYECTO,
  COLUMNAS_SEGUIMIENTO,
} from "./columnas.js";
import { FILTROS_PROYECTO, FILTROS_PROYECTO_VACIOS } from "./filtros.js";
import { TODOS_LOS_ESTADOS_PROYECTO } from "./validaciones.js";

const TODAS_LAS_LISTAS_DE_CAMPOS = { CAMPOS_PROYECTO, CAMPOS_HITO, CAMPOS_SEGUIMIENTO };

const TODAS_LAS_LISTAS_DE_COLUMNAS = {
  COLUMNAS_PROYECTO,
  CAMPOS_FICHA_PROYECTO,
  COLUMNAS_HITO,
  COLUMNAS_SEGUIMIENTO,
};

const TODAS_LAS_LISTAS_DE_FILTROS = { FILTROS_PROYECTO };

// Catalogos que un hook de pantalla (fuera de esta issue) tiene que pasar por `catalogos`.
const CATALOGOS_CONOCIDOS = new Set(["perfiles"]);

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
        expect(tieneOpciones && tieneOpcionesDesde).toBe(false);
        if (campo.opcionesDesde) expect(CATALOGOS_CONOCIDOS).toContain(campo.opcionesDesde);
      }
    }
  });

  it("CAMPOS_PROYECTO no incluye estado: lo gobiernan el trigger de transiciones y el kanban, no una edicion manual", () => {
    expect(CAMPOS_PROYECTO.some((campo) => campo.id === "estado")).toBe(false);
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

  it("las columnas de estado son CHIP, no ESTADO: el valor guardado ya es el del enum", () => {
    const estadoProyecto = COLUMNAS_PROYECTO.find((c) => c.id === "estado");
    const estadoFicha = CAMPOS_FICHA_PROYECTO.find((c) => c.id === "estado");
    for (const columna of [estadoProyecto, estadoFicha]) {
      expect(columna.tipo).toBe(TIPOS_DE_PRESENTACION.CHIP);
      expect(columna.etiquetasDesde).toBeUndefined();
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

  it("FILTROS_PROYECTO_VACIOS cubre lo mismo que FILTROS_PROYECTO salvo busqueda: listarProyectos() no acepta texto libre", () => {
    const idsConEstado = FILTROS_PROYECTO.filter((f) => f.id !== "busqueda").map((f) => f.id);
    expect(Object.keys(FILTROS_PROYECTO_VACIOS).sort()).toEqual(idsConEstado.sort());
  });
});

describe("los catalogos de estado reflejan estado_proyecto (00007)", () => {
  it("OPCIONES_ESTADO_PROYECTO tiene los cuatro valores de TODOS_LOS_ESTADOS_PROYECTO, con etiqueta de ui-tokens", () => {
    expect(OPCIONES_ESTADO_PROYECTO.map((o) => o.value).sort()).toEqual(
      [...TODOS_LOS_ESTADOS_PROYECTO].sort(),
    );

    expect(OPCIONES_ESTADO_PROYECTO.find((o) => o.value === "planificado").label).toBe(
      labels.proyectoPlanificado,
    );
    expect(OPCIONES_ESTADO_PROYECTO.find((o) => o.value === "en curso").label).toBe(
      labels.jornadaEnCurso,
    );
    expect(OPCIONES_ESTADO_PROYECTO.find((o) => o.value === "finalizado").label).toBe(
      labels.proyectoFinalizado,
    );
    expect(OPCIONES_ESTADO_PROYECTO.find((o) => o.value === "cancelado").label).toBe(
      labels.proyectoCancelado,
    );
  });
});
