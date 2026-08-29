// Pruebas de la logica pura del view model del listado de pacientes.
//
// No se monta el hook: packages/shared corre vitest con environment "node", sin DOM. Por eso
// catalogoComunidadesDePacientes, armarFilasDePacientes y aFiltrosDeBusqueda son funciones
// exportadas, mismo criterio que esRespuestaVigente() en hooks/useBusquedaPacientes.js.
//
// El archivo nace con la issue #533. Este era el unico modulo de pacientes/ sin pruebas, y por
// eso dos fallos llegaron a develop sin que nadie los viera: la edad se entregaba como objeto a
// una columna que espera un numero, y el filtro de sexo mandaba iniciales a una columna que
// guarda la palabra completa.
//
// Ningun dato real de pacientes: los nombres y las fechas son inventados.

import { describe, expect, it } from "vitest";

import {
  OPCIONES_SEXO,
  aFiltrosDeBusqueda,
  armarFilasDePacientes,
  catalogoComunidadesDePacientes,
} from "./usePacientesListado.js";
import { COLUMNAS_PACIENTE } from "./columnas.js";
import { TIPOS_DE_PRESENTACION } from "../descriptores.js";

const PACIENTE = {
  id: "p1",
  nombres: "Ana",
  apellidos: "Lopez",
  fechaNacimiento: "1990-05-10",
  sexo: "Femenino",
  comunidadId: "c1",
  comunidad: { nombre: "Aldea Norte" },
};

describe("armarFilasDePacientes", () => {
  it("la edad es un numero, porque la columna la declara NUMERO con sufijo", () => {
    const columnaEdad = COLUMNAS_PACIENTE.find((c) => c.id === "edad");
    expect(columnaEdad.tipo).toBe(TIPOS_DE_PRESENTACION.NUMERO);

    const [fila] = armarFilasDePacientes([{ ...PACIENTE, fechaNacimiento: "1990-05-10" }]);

    expect(typeof fila.edad).toBe("number");
  });

  it("el fallo de la #533: no entrega el objeto de calcularEdad", () => {
    const [fila] = armarFilasDePacientes([PACIENTE]);

    expect(fila.edad).not.toHaveProperty("anios");
    expect(String(fila.edad)).not.toContain("[object Object]");
  });

  it("una fecha de nacimiento ausente deja la edad vacia en vez de romper la fila", () => {
    const [fila] = armarFilasDePacientes([{ ...PACIENTE, fechaNacimiento: null }]);

    expect(fila.edad).toBeNull();
    expect(fila.nombreCompleto).toBe("Ana Lopez");
  });

  it("una fecha de nacimiento futura tampoco produce una edad negativa", () => {
    const [fila] = armarFilasDePacientes([{ ...PACIENTE, fechaNacimiento: "2100-01-01" }]);

    expect(fila.edad).toBeNull();
  });

  it("junta nombres y apellidos, y aplana la comunidad a su nombre", () => {
    const [fila] = armarFilasDePacientes([PACIENTE]);

    expect(fila.nombreCompleto).toBe("Ana Lopez");
    expect(fila.comunidad).toBe("Aldea Norte");
  });

  it("un paciente sin apellidos no deja un espacio colgando", () => {
    const [fila] = armarFilasDePacientes([{ ...PACIENTE, apellidos: null }]);

    expect(fila.nombreCompleto).toBe("Ana");
  });

  it("un paciente sin comunidad deja la celda vacia, no undefined", () => {
    const [fila] = armarFilasDePacientes([{ ...PACIENTE, comunidad: null }]);

    expect(fila.comunidad).toBeNull();
  });

  it("sin argumentos devuelve una lista vacia y no revienta", () => {
    expect(armarFilasDePacientes()).toEqual([]);
  });
});

describe("OPCIONES_SEXO", () => {
  // El fallo de la #533: el valor viajaba como "F" hacia fn_buscar_pacientes, que lo compara
  // contra pacientes.sexo -- un varchar(20) que guarda "Femenino". El filtro devolvia cero filas
  // sin dar error, asi que parecia funcionar.
  it("el valor es la palabra completa, no la inicial", () => {
    expect(OPCIONES_SEXO.map((o) => o.valor)).toEqual(["Femenino", "Masculino"]);
  });

  it("ninguna opcion manda una sola letra al servidor", () => {
    for (const opcion of OPCIONES_SEXO) {
      expect(opcion.valor.length).toBeGreaterThan(1);
    }
  });
});

describe("catalogoComunidadesDePacientes", () => {
  it("saca las comunidades de los resultados, sin repetir", () => {
    const catalogo = catalogoComunidadesDePacientes([
      PACIENTE,
      { ...PACIENTE, id: "p2" },
      { ...PACIENTE, id: "p3", comunidadId: "c2", comunidad: { nombre: "Aldea Sur" } },
    ]);

    expect(catalogo).toEqual([
      { valor: "c1", etiqueta: "Aldea Norte" },
      { valor: "c2", etiqueta: "Aldea Sur" },
    ]);
  });

  it("ordena por etiqueta en espanol", () => {
    const catalogo = catalogoComunidadesDePacientes([
      { ...PACIENTE, comunidadId: "c2", comunidad: { nombre: "Zunil" } },
      { ...PACIENTE, comunidadId: "c1", comunidad: { nombre: "Almolonga" } },
    ]);

    expect(catalogo.map((c) => c.etiqueta)).toEqual(["Almolonga", "Zunil"]);
  });

  it("ignora a quien no trae comunidad", () => {
    expect(catalogoComunidadesDePacientes([{ ...PACIENTE, comunidad: null }])).toEqual([]);
  });

  it("sin argumentos devuelve una lista vacia", () => {
    expect(catalogoComunidadesDePacientes()).toEqual([]);
  });
});

describe("aFiltrosDeBusqueda", () => {
  it("pide listarTodos: es una pantalla de listado, no de busqueda", () => {
    expect(aFiltrosDeBusqueda({}).listarTodos).toBe(true);
  });

  it("parte el rango de edad en los dos numeros que espera el servidor", () => {
    const filtros = aFiltrosDeBusqueda({ rangoEdad: { min: 5, max: 12 } });

    expect(filtros.edadMin).toBe(5);
    expect(filtros.edadMax).toBe(12);
  });

  it("un rango a medias manda solo el extremo que hay", () => {
    const filtros = aFiltrosDeBusqueda({ rangoEdad: { min: 60 } });

    expect(filtros.edadMin).toBe(60);
    expect(filtros.edadMax).toBeUndefined();
  });

  it("la edad cero se manda: es un recien nacido, no un filtro vacio", () => {
    expect(aFiltrosDeBusqueda({ rangoEdad: { min: 0, max: 1 } }).edadMin).toBe(0);
  });

  it("un filtro sin valor se omite en vez de viajar como null", () => {
    const filtros = aFiltrosDeBusqueda({ sexo: "", condicionCronica: null });

    expect(filtros.sexo).toBeUndefined();
    expect(filtros.condicionCronicaId).toBeUndefined();
  });

  it("sin argumentos no revienta y sigue pidiendo el listado completo", () => {
    expect(aFiltrosDeBusqueda()).toEqual({
      listarTodos: true,
      condicionCronicaId: undefined,
      sexo: undefined,
      edadMin: undefined,
      edadMax: undefined,
    });
  });
});
