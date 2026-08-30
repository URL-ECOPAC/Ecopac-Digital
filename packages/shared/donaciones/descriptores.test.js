// Pruebas de los descriptores de donantes y donaciones (issue #287).
//
// Mismo patron que reportes/descriptores.test.js: verificar que campos.js/columnas.js/filtros.js
// usen el vocabulario de descriptores.js y no tipos ni claves inventadas.

import { describe, expect, it } from "vitest";
import { labels } from "@ecopac/ui-tokens";

import { TIPOS_DE_CAMPO, TIPOS_DE_FILTRO, TIPOS_DE_PRESENTACION } from "../descriptores.js";
import {
  CAMPOS_ANULACION_DONACION,
  CAMPOS_DONACION,
  CAMPOS_DONANTE,
  ESTADOS_DE_DONACION,
  ESTADOS_DONANTE,
  OPCIONES_ESTADO_DONACION,
  OPCIONES_TIPO_DONACION,
  OPCIONES_TIPO_DONANTE,
  TIPOS_DE_DONACION,
  TIPOS_DE_DONANTE,
} from "./campos.js";
import {
  CAMPOS_FICHA_DONACION,
  CAMPOS_FICHA_DONANTE,
  COLUMNAS_DONACION,
  COLUMNAS_DONANTE,
} from "./columnas.js";
import {
  FILTROS_DONACION,
  FILTROS_DONACION_VACIOS,
  FILTROS_DONANTE,
  FILTROS_DONANTE_VACIOS,
} from "./filtros.js";

const TODAS_LAS_LISTAS_DE_CAMPOS = { CAMPOS_DONANTE, CAMPOS_DONACION, CAMPOS_ANULACION_DONACION };

const TODAS_LAS_LISTAS_DE_COLUMNAS = {
  COLUMNAS_DONANTE,
  CAMPOS_FICHA_DONANTE,
  COLUMNAS_DONACION,
  CAMPOS_FICHA_DONACION,
};

const TODAS_LAS_LISTAS_DE_FILTROS = { FILTROS_DONANTE, FILTROS_DONACION };

// Catalogos que un hook de pantalla (fuera de esta issue) tiene que pasar por `catalogos`.
const CATALOGOS_CONOCIDOS = new Set(["donantes", "estadoDonante", "tiposDeDonante", "tiposDeDonacion"]);

/** Aplana un campo LISTA_REPETIBLE en sus campos anidados, para revisarlos con las mismas reglas. */
function conCamposAnidados(lista) {
  return lista.flatMap((campo) => (Array.isArray(campo.campos) ? [campo, ...campo.campos] : [campo]));
}

describe("campos.js solo usa el vocabulario de TIPOS_DE_CAMPO", () => {
  const tiposValidos = Object.values(TIPOS_DE_CAMPO);

  for (const [nombre, lista] of Object.entries(TODAS_LAS_LISTAS_DE_CAMPOS)) {
    it(`${nombre}: cada campo (incluidos los de una lista repetible) declara id, label y un tipo valido`, () => {
      expect(Array.isArray(lista)).toBe(true);
      expect(lista.length).toBeGreaterThan(0);

      for (const campo of conCamposAnidados(lista)) {
        expect(campo.id).toBeTruthy();
        expect(campo.label).toBeTruthy();
        expect(tiposValidos).toContain(campo.tipo);
      }
    });
  }

  it("los campos SELECT declaran opciones u opcionesDesde, nunca los dos ni ninguno", () => {
    for (const lista of Object.values(TODAS_LAS_LISTAS_DE_CAMPOS)) {
      for (const campo of conCamposAnidados(lista)) {
        if (campo.tipo !== TIPOS_DE_CAMPO.SELECT) continue;
        const tieneOpciones = Boolean(campo.opciones);
        const tieneOpcionesDesde = Boolean(campo.opcionesDesde);
        expect(tieneOpciones || tieneOpcionesDesde).toBe(true);
        expect(tieneOpciones && tieneOpcionesDesde).toBe(false);
        if (campo.opcionesDesde) expect(CATALOGOS_CONOCIDOS).toContain(campo.opcionesDesde);
      }
    }
  });
});

describe("columnas.js solo usa el vocabulario de TIPOS_DE_PRESENTACION", () => {
  const tiposValidos = Object.values(TIPOS_DE_PRESENTACION);

  for (const [nombre, lista] of Object.entries(TODAS_LAS_LISTAS_DE_COLUMNAS)) {
    it(`${nombre}: cada columna declara id, label (salvo el avatar, que es solo icono) y un tipo valido`, () => {
      expect(Array.isArray(lista)).toBe(true);
      expect(lista.length).toBeGreaterThan(0);

      for (const columna of lista) {
        expect(columna.id).toBeTruthy();
        if (columna.id !== "avatar") expect(columna.label).toBeTruthy();
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

  it("las columnas CHIP no declaran etiquetasDesde: el valor guardado ya es el del enum", () => {
    for (const lista of Object.values(TODAS_LAS_LISTAS_DE_COLUMNAS)) {
      for (const columna of lista) {
        if (columna.tipo !== TIPOS_DE_PRESENTACION.CHIP) continue;
        expect(columna.etiquetasDesde).toBeUndefined();
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

  it("el filtro de fecha de donaciones es un solo RANGO con desde/hasta", () => {
    const rango = FILTROS_DONACION.find((f) => f.id === "rangoFecha");
    expect(rango.tipo).toBe(TIPOS_DE_FILTRO.RANGO);
    expect(rango.desde).toBe("fechaInicio");
    expect(rango.hasta).toBe("fechaFin");
  });

  it("los *_VACIOS tienen exactamente las mismas claves que su lista de filtros", () => {
    expect(Object.keys(FILTROS_DONANTE_VACIOS).sort()).toEqual(FILTROS_DONANTE.map((f) => f.id).sort());
    expect(Object.keys(FILTROS_DONACION_VACIOS).sort()).toEqual(FILTROS_DONACION.map((f) => f.id).sort());
  });
});

describe("los catalogos de estado reflejan los enum reales", () => {
  it("OPCIONES_ESTADO_DONACION cubre exactamente registrada/anulada, con etiqueta de ui-tokens", () => {
    const valores = OPCIONES_ESTADO_DONACION.map((e) => e.value);
    expect(valores.sort()).toEqual(Object.values(ESTADOS_DE_DONACION).sort());
    expect(OPCIONES_ESTADO_DONACION.find((e) => e.value === ESTADOS_DE_DONACION.REGISTRADA).label).toBe(
      labels.donacionRegistrada,
    );
    expect(OPCIONES_ESTADO_DONACION.find((e) => e.value === ESTADOS_DE_DONACION.ANULADA).label).toBe(
      labels.donacionAnulada,
    );
  });

  it("ESTADOS_DONANTE cubre el booleano activo/inactivo, con etiqueta de ui-tokens", () => {
    expect(ESTADOS_DONANTE.map((e) => e.value)).toEqual([true, false]);
    expect(ESTADOS_DONANTE.find((e) => e.value === true).label).toBe(labels.activo);
    expect(ESTADOS_DONANTE.find((e) => e.value === false).label).toBe(labels.inactivo);
  });

  it("OPCIONES_TIPO_DONANTE y OPCIONES_TIPO_DONACION cubren exactamente su enum, sin inventar valores", () => {
    expect(OPCIONES_TIPO_DONANTE.map((o) => o.value).sort()).toEqual(Object.values(TIPOS_DE_DONANTE).sort());
    expect(OPCIONES_TIPO_DONACION.map((o) => o.value).sort()).toEqual(Object.values(TIPOS_DE_DONACION).sort());
  });
});
