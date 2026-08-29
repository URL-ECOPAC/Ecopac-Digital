// Pruebas de la logica pura del hook de busqueda.
//
// No se monta el hook: packages/shared corre vitest con environment "node", sin DOM. Por eso
// esRespuestaVigente, combinarResultados y hayMasResultados son funciones exportadas, mismo
// criterio que haVencidoPorInactividad() en useExpiracionPorInactividad.js.
//
// Ningun dato real de pacientes: los nombres son inventados.

import { describe, expect, it } from "vitest";

import {
  RETARDO_DE_BUSQUEDA_MS,
  combinarResultados,
  debeDescartarseLaRespuesta,
  esRespuestaVigente,
  hayMasResultados,
} from "./useBusquedaPacientes.js";

const PAGINA_1 = [
  { id: "p1", nombres: "Ana" },
  { id: "p2", nombres: "Luis" },
];
const PAGINA_2 = [
  { id: "p3", nombres: "Rosa" },
  { id: "p4", nombres: "Mario" },
];

describe("RETARDO_DE_BUSQUEDA_MS", () => {
  it("cumple el minimo de 300 ms que pide la issue", () => {
    expect(RETARDO_DE_BUSQUEDA_MS).toBeGreaterThanOrEqual(300);
  });
});

describe("esRespuestaVigente", () => {
  it("la respuesta de la ultima peticion si se pinta", () => {
    expect(esRespuestaVigente(5, 5)).toBe(true);
  });

  it("una respuesta lenta de una peticion vieja se descarta", () => {
    // La peticion 3 vuelve cuando ya se disparo la 7: llego tarde.
    expect(esRespuestaVigente(3, 7)).toBe(false);
  });

  it("el caso que motiva la issue: la lenta no pisa a la rapida", () => {
    // El usuario escribe "ana" (peticion 1) y luego "anab" (peticion 2). Vuelve primero la 2 y
    // despues la 1: solo la 2 debe pintarse.
    const vigente = 2;

    expect(esRespuestaVigente(2, vigente)).toBe(true);
    expect(esRespuestaVigente(1, vigente)).toBe(false);
  });
});

describe("combinarResultados", () => {
  it("la primera pagina reemplaza lo que hubiera", () => {
    expect(combinarResultados(PAGINA_2, PAGINA_1, 1)).toEqual(PAGINA_1);
  });

  it("las siguientes paginas se agregan al final", () => {
    const combinados = combinarResultados(PAGINA_1, PAGINA_2, 2);

    expect(combinados.map((p) => p.id)).toEqual(["p1", "p2", "p3", "p4"]);
  });

  it("no repite a alguien que ya estaba en pantalla", () => {
    // Si se registra un paciente mientras se pagina, las filas se recorren y uno de la pagina 1
    // puede reaparecer en la 2.
    const combinados = combinarResultados(PAGINA_1, [{ id: "p2", nombres: "Luis" }, ...PAGINA_2], 2);

    expect(combinados.map((p) => p.id)).toEqual(["p1", "p2", "p3", "p4"]);
  });

  it("una pagina vacia no borra lo que ya estaba", () => {
    expect(combinarResultados(PAGINA_1, [], 2)).toEqual(PAGINA_1);
  });

  it("sin argumentos devuelve una lista vacia y no revienta", () => {
    expect(combinarResultados()).toEqual([]);
  });

  it("la pagina 0 o negativa se trata como la primera", () => {
    expect(combinarResultados(PAGINA_1, PAGINA_2, 0)).toEqual(PAGINA_2);
  });
});

describe("hayMasResultados", () => {
  it.each([
    ["faltan por traer", 20, 45, true],
    ["ya estan todos", 45, 45, false],
    ["no hay ninguno", 0, 0, false],
    ["hay menos de una pagina", 3, 3, false],
  ])("%s: %i de %i -> %s", (_caso, cargados, total, esperado) => {
    expect(hayMasResultados(cargados, total)).toBe(esperado);
  });

  it("valores ausentes no rompen la comprobacion", () => {
    expect(hayMasResultados(undefined, undefined)).toBe(false);
    expect(hayMasResultados(0, undefined)).toBe(false);
  });
});

// Cancelacion de peticiones en vuelo (issue #520).
//
// El hook aborta la peticion anterior antes de disparar la siguiente. Lo que se comprueba aqui
// es la decision que toma al volver una respuesta: cual se pinta y cual se tira. Es la misma
// razon por la que esRespuestaVigente esta exportada -- sin DOM no se puede montar el hook, asi
// que la logica que importa vive en una funcion pura.
describe("debeDescartarseLaRespuesta", () => {
  it("una respuesta abortada no toca el estado, aunque sea la peticion vigente", () => {
    expect(debeDescartarseLaRespuesta({ cancelada: true }, 3, 3)).toBe(true);
  });

  it("el caso del desmontaje: se aborta y no sale ninguna peticion despues", () => {
    expect(debeDescartarseLaRespuesta({ cancelada: true, error: null }, 1, 1)).toBe(true);
  });

  it("la respuesta vigente y no abortada si se pinta", () => {
    expect(debeDescartarseLaRespuesta({ cancelada: false, pacientes: [] }, 4, 4)).toBe(false);
  });

  it("una respuesta vieja se sigue descartando aunque no venga marcada como cancelada", () => {
    expect(debeDescartarseLaRespuesta({ cancelada: false }, 2, 5)).toBe(true);
  });

  it("un error de verdad no se descarta: la pantalla tiene que poder mostrarlo", () => {
    expect(debeDescartarseLaRespuesta({ cancelada: false, error: { codigo: "x" } }, 7, 7)).toBe(
      false,
    );
  });

  it("una respuesta ausente se trata por su vigencia y no revienta", () => {
    expect(debeDescartarseLaRespuesta(undefined, 1, 1)).toBe(false);
    expect(debeDescartarseLaRespuesta(undefined, 1, 2)).toBe(true);
  });
});
