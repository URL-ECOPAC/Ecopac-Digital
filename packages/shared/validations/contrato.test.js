// La forma del resultado de un validador, comprobada sobre todos a la vez (issue #840).
//
// POR QUE EXISTE ESTA PRUEBA
//
// useProyectosSociales.js leia el resultado de validarProyecto() como `{ esValido, errores }`,
// una forma que ninguna funcion de este monorepo devuelve. Las dos lecturas daban `undefined`,
// asi que la validacion fallaba siempre y "+ Nuevo proyecto" no creaba nada ni decia por que.
// Lint, build y las pruebas del modulo estaban en verde: leer una propiedad que no existe no
// lanza, devuelve undefined.
//
// Es la misma familia que las issues #818 y #821, y lo que AGENTS.md pide evitar: "un import
// que falta o un contrato que cambia tiene que reventar, no degradar a vacio". Aqui se fija el
// otro lado de esa regla -- que todos los validadores devuelvan de verdad la misma forma -- para
// que quien lea `.esValido` de uno de ellos tenga al menos una prueba que lo contradiga.
//
// El contrato esta escrito en la cabecera de validations/index.js: un objeto plano
// { campo: mensaje }, vacio cuando todo esta bien. Nunca un booleano, nunca un sobre.

import { describe, expect, it } from "vitest";

import {
  validarDonacion,
  validarDonante,
  validarAnulacionDeDonacion,
} from "../donaciones/validaciones.js";
import {
  validarAsignacionPersonal,
  validarEdicionTurno,
  validarJornada,
} from "../jornadas/validaciones.js";
import {
  validarCambioDeCondicion,
  validarCondicionCatalogo,
  validarCondicionCronica,
} from "../pacientes/condiciones.validaciones.js";
import { validarCambioDeTriaje, validarTriaje } from "../pacientes/triaje.validaciones.js";
import { validarPaciente, validarRegistroPaciente } from "../pacientes/validaciones.js";
import { validarGasto } from "../presupuestos/validaciones.js";
import { validarProyecto } from "../proyectos/validaciones.js";
import { validarComunidad } from "../territorio/comunidades.validaciones.js";
import {
  validarCambioContrasena,
  validarCredenciales,
  validarPerfil,
} from "../usuarios/validaciones.js";

/**
 * Los validadores que reciben un objeto de valores y nada mas. Se los llama con `{}` -- el peor
 * caso, un formulario vacio -- porque es el que mas errores produce y por tanto el que mejor
 * muestra la forma del resultado.
 *
 * Quedan fuera los que no encajan en esa firma (validarAsignaciones recibe una lista,
 * validarCambioDeEstadoJornada/Proyecto reciben dos escalares) y los ayudantes de un solo campo
 * de usuarios/validaciones.js, que devuelven un mensaje o null a proposito.
 */
const VALIDADORES = [
  ["validarDonante", validarDonante],
  ["validarDonacion", validarDonacion],
  ["validarAnulacionDeDonacion", validarAnulacionDeDonacion],
  ["validarJornada", validarJornada],
  ["validarAsignacionPersonal", validarAsignacionPersonal],
  ["validarEdicionTurno", validarEdicionTurno],
  ["validarCondicionCronica", validarCondicionCronica],
  ["validarCambioDeCondicion", validarCambioDeCondicion],
  ["validarCondicionCatalogo", validarCondicionCatalogo],
  ["validarTriaje", validarTriaje],
  ["validarCambioDeTriaje", validarCambioDeTriaje],
  ["validarPaciente", validarPaciente],
  ["validarRegistroPaciente", validarRegistroPaciente],
  ["validarProyecto", validarProyecto],
  ["validarComunidad", validarComunidad],
  ["validarPerfil", validarPerfil],
  ["validarCambioContrasena", validarCambioContrasena],
];

describe("contrato de los validadores", () => {
  it.each(VALIDADORES)("%s devuelve un objeto plano de errores", (_nombre, validar) => {
    const resultado = validar({});

    expect(resultado).toBeTypeOf("object");
    expect(resultado).not.toBeNull();
    expect(Array.isArray(resultado)).toBe(false);
  });

  // Las dos claves con las que se confundio useProyectosSociales.js. Si alguna funcion empieza
  // a devolver un sobre, esta prueba lo dice antes de que otra pantalla lo lea al reves.
  it.each(VALIDADORES)("%s no envuelve el resultado en esValido/errores", (_nombre, validar) => {
    const resultado = validar({});

    expect(resultado).not.toHaveProperty("esValido");
    expect(resultado).not.toHaveProperty("errores");
  });

  it.each(VALIDADORES)("%s indexa mensajes de texto por campo", (_nombre, validar) => {
    const resultado = validar({});

    for (const [campo, mensaje] of Object.entries(resultado)) {
      expect(typeof mensaje, `${campo} deberia traer un mensaje de texto`).toBe("string");
      expect(mensaje.length).toBeGreaterThan(0);
    }
  });
});

// LAS DOS EXCEPCIONES, ESCRITAS APARTE EN VEZ DE OMITIDAS
//
// validarGasto() y validarCredenciales() NO devuelven el objeto plano. No es un descuido: cada
// una tiene que devolver algo mas que los errores, y las dos estan leidas correctamente por su
// unico consumidor (useFormularioGasto.js y api/sesion.js). Dejarlas fuera de la lista de arriba
// sin decir por que seria esconder justamente lo que esta prueba existe para vigilar, asi que su
// forma se fija aqui: si cambian, tambien se rompe algo.
describe("los validadores que devuelven algo mas que errores", () => {
  // Acumula mensajes en una LISTA, no por campo: un gasto se valida contra el presupuesto de su
  // jornada y varios de sus mensajes no cuelgan de un campo del formulario. Ademas informa del
  // excedente, que no es un error -- se puede guardar igual, con aviso.
  it("validarGasto devuelve valido, la lista de errores y el excedente", () => {
    const resultado = validarGasto({});

    expect(resultado.valido).toBe(false);
    expect(Array.isArray(resultado.errores)).toBe(true);
    expect(resultado.errores.length).toBeGreaterThan(0);
    expect(resultado).toHaveProperty("esExcedente");
    expect(resultado).toHaveProperty("mensajeExcedente");
  });

  // Devuelve ademas el correo normalizado porque quien inicia sesion necesita el valor recortado
  // y en minusculas, no el que se tecleo. Reconstruirlo en la pantalla seria tener dos reglas de
  // normalizacion que se pueden separar.
  it("validarCredenciales devuelve el correo normalizado junto a los errores", () => {
    const resultado = validarCredenciales({ correo: "  ALGUIEN@ejemplo.gt ", contrasena: "" });

    expect(resultado.correo).toBe("alguien@ejemplo.gt");
    expect(resultado.errores.contrasena).toBeTypeOf("string");
  });
});
