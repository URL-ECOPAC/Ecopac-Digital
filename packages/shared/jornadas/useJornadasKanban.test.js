// Pruebas de la logica pura del tablero de jornadas (issue #178, movimiento de tarjetas #180).
//
// No se monta el hook: packages/shared corre vitest con environment "node", sin DOM. Por eso
// catalogoComunidadesDesde(), agruparJornadasPorEstado() y
// necesitaAvisoDeAtencionesIncompletas() son funciones exportadas y no codigo suelto dentro de
// useJornadasKanban(), mismo criterio que armarFilas() en usuarios/useUsuariosListado.js y que
// valoresIniciales()/aDatosDeJornada() en useFormularioJornada.test.js. La orquestacion asincrona
// del movimiento (moverJornada, aplicarMovimiento, confirmarFinalizacion) vive dentro del hook y
// no se prueba aca, mismo criterio que enviar() en useFormularioJornada.js.
//
// Ningun dato real: las jornadas y comunidades son inventadas.

import { describe, expect, it } from "vitest";

import {
  agruparJornadasPorEstado,
  catalogoComunidadesDesde,
  necesitaAvisoDeAtencionesIncompletas,
} from "./useJornadasKanban.js";

function jornada(datos) {
  return {
    id: "j1",
    nombre: "Jornada de prueba",
    fecha: "2026-09-01",
    estado: "planificada",
    comunidadId: "c1",
    comunidad: { nombre: "San Juan" },
    responsable: { nombres: "Ana", apellidos: "Lopez" },
    ...datos,
  };
}

describe("catalogoComunidadesDesde", () => {
  it("saca los pares (id, nombre) de las jornadas ya cargadas", () => {
    const catalogo = catalogoComunidadesDesde([
      jornada({ id: "j1", comunidadId: "c1", comunidad: { nombre: "San Juan" } }),
      jornada({ id: "j2", comunidadId: "c2", comunidad: { nombre: "Antigua" } }),
    ]);

    expect(catalogo).toEqual([
      { valor: "c2", etiqueta: "Antigua" },
      { valor: "c1", etiqueta: "San Juan" },
    ]);
  });

  it("no repite una comunidad que aparece en varias jornadas", () => {
    const catalogo = catalogoComunidadesDesde([
      jornada({ id: "j1", comunidadId: "c1" }),
      jornada({ id: "j2", comunidadId: "c1" }),
    ]);

    expect(catalogo).toHaveLength(1);
  });

  it("omite una jornada cuya comunidad RLS no deja ver (embed en null)", () => {
    const catalogo = catalogoComunidadesDesde([
      jornada({ id: "j1", comunidadId: "c1", comunidad: null }),
    ]);

    expect(catalogo).toEqual([]);
  });

  it("una lista vacia da un catalogo vacio", () => {
    expect(catalogoComunidadesDesde([])).toEqual([]);
    expect(catalogoComunidadesDesde()).toEqual([]);
  });
});

describe("agruparJornadasPorEstado", () => {
  it("una columna por cada valor de OPCIONES_ESTADO_JORNADA, incluso sin tarjetas", () => {
    const columnas = agruparJornadasPorEstado([]);

    expect(columnas.map((columna) => columna.id)).toEqual([
      "planificada",
      "en curso",
      "finalizada",
      "cancelada",
    ]);
    expect(columnas.every((columna) => columna.tarjetas.length === 0)).toBe(true);
  });

  it("pone cada jornada en la columna de su propio estado", () => {
    const columnas = agruparJornadasPorEstado([
      jornada({ id: "j1", estado: "planificada" }),
      jornada({ id: "j2", estado: "en curso" }),
    ]);

    const planificada = columnas.find((columna) => columna.id === "planificada");
    const enCurso = columnas.find((columna) => columna.id === "en curso");

    expect(planificada.tarjetas.map((tarjeta) => tarjeta.id)).toEqual(["j1"]);
    expect(enCurso.tarjetas.map((tarjeta) => tarjeta.id)).toEqual(["j2"]);
  });

  it("la tarjeta trae exactamente los seis datos del criterio 1", () => {
    const [columna] = agruparJornadasPorEstado(
      [jornada({ id: "j1" })],
      { j1: 12 },
    );

    expect(columna.tarjetas[0]).toEqual({
      id: "j1",
      nombre: "Jornada de prueba",
      fecha: "2026-09-01",
      comunidad: "San Juan",
      responsable: "Ana Lopez",
      estado: "planificada",
      pacientesAtendidos: 12,
    });
  });

  it("sin fila en pacientesPorJornada la tarjeta no trae la clave (guion en pantalla, nunca 0)", () => {
    const [columna] = agruparJornadasPorEstado([jornada({ id: "j1" })], {});

    expect(columna.tarjetas[0]).not.toHaveProperty("pacientesAtendidos");
  });

  it("una fila en cero SI se pinta: 0 es un dato real, no ausencia de permiso", () => {
    const [columna] = agruparJornadasPorEstado([jornada({ id: "j1" })], { j1: 0 });

    expect(columna.tarjetas[0].pacientesAtendidos).toBe(0);
  });

  it("comunidad y responsable ausentes (RLS) quedan en texto vacio, no revientan", () => {
    const [columna] = agruparJornadasPorEstado([
      jornada({ id: "j1", comunidad: null, responsable: null }),
    ]);

    expect(columna.tarjetas[0].comunidad).toBe("");
    expect(columna.tarjetas[0].responsable).toBe("");
  });
});

describe("necesitaAvisoDeAtencionesIncompletas", () => {
  it("en curso -> finalizada si necesita el aviso (issue #171, criterio 4)", () => {
    expect(necesitaAvisoDeAtencionesIncompletas("en curso", "finalizada")).toBe(true);
  });

  it("planificada -> en curso no necesita el aviso", () => {
    expect(necesitaAvisoDeAtencionesIncompletas("planificada", "en curso")).toBe(false);
  });

  it("finalizada -> en curso (reapertura) no necesita el aviso", () => {
    expect(necesitaAvisoDeAtencionesIncompletas("finalizada", "en curso")).toBe(false);
  });

  it("un destino distinto de finalizada nunca lo necesita, sin importar el origen", () => {
    expect(necesitaAvisoDeAtencionesIncompletas("en curso", "cancelada")).toBe(false);
  });
});
