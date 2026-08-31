// Prueba de consistencia del ejemplar de referencia (issue #398).
//
// pacientes/ es el modulo que docs/ARQUITECTURA-FRONTEND.md senala como patron a copiar, y era
// el unico donde columnas.js y filtros.js nombraban o etiquetaban un dato distinto de como lo
// hace campos.js: el id del numero de ficha (numeroFicha vs codigoFicha) y el del telefono
// (telefonoContacto vs telefono) habian divergido en silencio, y "sexo" tenia dos etiquetas
// ("Sexo" en campos.js, "Genero" en columnas.js y filtros.js) para el mismo dato.
//
// No se exige que TODA etiqueta compartida sea identica letra por letra: una ficha compacta o
// un filtro pueden abreviar razonablemente ("Responsable" en la tarjeta contra "Nombre del
// responsable" en el formulario, o "Lugar" como etiqueta del filtro de comunidad) sin que eso
// sea el bug que describe la issue. Lo que no puede pasar es que un id cambie de nombre entre
// archivos, o que el mismo dato tenga dos etiquetas para la MISMA idea sin ningun motivo de
// contexto -- que es exactamente lo que paso con "sexo"/"genero".

import { describe, expect, it } from "vitest";

import { CAMPOS_REGISTRO_PACIENTE } from "./campos.js";
import { CAMPOS_FICHA_PACIENTE, COLUMNAS_PACIENTE } from "./columnas.js";
import { FILTROS_PACIENTE } from "./filtros.js";

// avatar/nombreCompleto/edad/condiciones son presentacion derivada (nombreCompleto de
// nombres+apellidos, edad de fechaNacimiento, condiciones de la relacion con
// padecimientos_cronicos). busqueda es un filtro de texto libre sobre varios campos a la vez, y
// rangoEdad filtra sobre la edad derivada. numeroFicha lo genera el servidor (issue #114,
// fn_registrar_paciente): quien registra no lo escribe, asi que no tiene contraparte de
// formulario. ultimaAtencion sale de jornadas.fecha a traves de atenciones, y condicionCronica
// filtra la misma relacion con padecimientos_cronicos que ya cubre la columna condiciones; los
// dos entraron con la #124. Ninguno de los nueve tiene ni deberia tener contraparte en
// CAMPOS_REGISTRO_PACIENTE.
const IDS_DERIVADOS = new Set([
  "avatar",
  "nombreCompleto",
  "edad",
  "condiciones",
  "busqueda",
  "rangoEdad",
  "numeroFicha",
  "ultimaAtencion",
  "condicionCronica",
]);

const IDS_DE_CAMPOS_REGISTRO = new Set(CAMPOS_REGISTRO_PACIENTE.map((campo) => campo.id));

function verificarQueElIdExiste(entradas, nombreDelArreglo) {
  for (const entrada of entradas) {
    if (IDS_DERIVADOS.has(entrada.id)) continue;

    it(`${nombreDelArreglo}: "${entrada.id}" existe en CAMPOS_REGISTRO_PACIENTE`, () => {
      expect(
        IDS_DE_CAMPOS_REGISTRO.has(entrada.id),
        `"${entrada.id}" no esta declarado en CAMPOS_REGISTRO_PACIENTE: ` +
          `¿se renombro en un archivo y no en el otro?`,
      ).toBe(true);
    });
  }
}

describe("los ids de COLUMNAS_PACIENTE existen en CAMPOS_REGISTRO_PACIENTE", () => {
  verificarQueElIdExiste(COLUMNAS_PACIENTE, "COLUMNAS_PACIENTE");
});

describe("los ids de CAMPOS_FICHA_PACIENTE existen en CAMPOS_REGISTRO_PACIENTE", () => {
  verificarQueElIdExiste(CAMPOS_FICHA_PACIENTE, "CAMPOS_FICHA_PACIENTE");
});

describe("los ids de FILTROS_PACIENTE existen en CAMPOS_REGISTRO_PACIENTE", () => {
  verificarQueElIdExiste(FILTROS_PACIENTE, "FILTROS_PACIENTE");
});

describe("el campo sexo usa la misma etiqueta en todos lados (issue #398, punto 3)", () => {
  it("dice 'Sexo', nunca 'Genero', en campos.js, columnas.js y filtros.js", () => {
    expect(CAMPOS_REGISTRO_PACIENTE.find((c) => c.id === "sexo").label).toBe("Sexo");
    expect(COLUMNAS_PACIENTE.find((c) => c.id === "sexo").label).toBe("Sexo");
    expect(CAMPOS_FICHA_PACIENTE.find((c) => c.id === "sexo").label).toBe("Sexo");
    expect(FILTROS_PACIENTE.find((f) => f.id === "sexo").label).toBe("Sexo");
  });
});

describe("la columna comunidad no se confunde con municipio (issue #398, punto 4)", () => {
  it("dice 'Comunidad' en las tres listas de datos del paciente", () => {
    expect(CAMPOS_REGISTRO_PACIENTE.find((c) => c.id === "comunidad").label).toBe("Comunidad");
    expect(COLUMNAS_PACIENTE.find((c) => c.id === "comunidad").label).toBe("Comunidad");
    expect(CAMPOS_FICHA_PACIENTE.find((c) => c.id === "comunidad").label).toBe("Comunidad");
  });
});
