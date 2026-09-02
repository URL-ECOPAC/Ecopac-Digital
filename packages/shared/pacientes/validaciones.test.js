// Pruebas de las reglas de validacion de pacientes.
//
// validarPaciente() (CAMPOS_PACIENTE, issue #112) y validarRegistroPaciente()
// (CAMPOS_REGISTRO_PACIENTE, issue #113) comparten las mismas reglas de negocio (fecha de
// nacimiento, formato del DPI) pero exigen un conjunto distinto de campos obligatorios: la
// segunda cubre el formulario completo de registro, incluido lo que la primera no valida
// (sexo, telefonoContacto, idioma). numeroFicha no es un campo de ningun formulario: lo
// genera el servidor (issue #114).
//
// Ningun dato real: nombres y DPI son inventados.

import { describe, expect, it } from "vitest";

import {
  normalizarDatosPaciente,
  validarPaciente,
  validarRegistroPaciente,
} from "./validaciones.js";

/** Paciente valido minimo para validarPaciente(): solo los 5 campos de CAMPOS_PACIENTE. */
function pacienteValido(cambios = {}) {
  return {
    nombres: "Maria",
    apellidos: "Xoc",
    fechaNacimiento: "1990-05-10",
    comunidad: "comunidad-1",
    ...cambios,
  };
}

/** Formulario de registro valido minimo para validarRegistroPaciente(): los 11 campos de CAMPOS_REGISTRO_PACIENTE. */
function registroValido(cambios = {}) {
  return {
    ...pacienteValido(),
    sexo: "femenino",
    telefonoContacto: "50212345678",
    idioma: "espanol",
    ...cambios,
  };
}

describe("validarPaciente", () => {
  it("no reporta errores con los 5 campos de CAMPOS_PACIENTE completos", () => {
    expect(validarPaciente(pacienteValido())).toEqual({});
  });

  it("exige nombres, apellidos y fecha de nacimiento", () => {
    const errores = validarPaciente({});

    expect(errores.nombres).toBeTruthy();
    expect(errores.apellidos).toBeTruthy();
    expect(errores.fechaNacimiento).toBeTruthy();
  });

  // La comunidad dejo de ser obligatoria en la #657: en jornada no siempre se sabe de donde viene
  // la persona, y exigirla llevaba a inventar una comunidad o a no registrarla. La columna admite
  // NULL desde la 00111 y fn_buscar_pacientes la une con LEFT JOIN para que siga apareciendo.
  it("no exige comunidad: es opcional desde la #657", () => {
    expect(validarPaciente({}).comunidad).toBeUndefined();
    expect(validarPaciente(pacienteValido({ comunidad: "" })).comunidad).toBeUndefined();
  });

  it("no exige sexo, telefonoContacto, idioma ni numeroFicha: no estan en CAMPOS_PACIENTE", () => {
    const errores = validarPaciente(pacienteValido());

    expect(errores.sexo).toBeUndefined();
    expect(errores.telefonoContacto).toBeUndefined();
    expect(errores.idioma).toBeUndefined();
    expect(errores.numeroFicha).toBeUndefined();
  });

  it("rechaza una fecha de nacimiento futura", () => {
    const manana = new Date();
    manana.setDate(manana.getDate() + 1);

    const errores = validarPaciente(
      pacienteValido({ fechaNacimiento: manana.toISOString().slice(0, 10) }),
    );

    expect(errores.fechaNacimiento).toBeTruthy();
  });

  it("rechaza una edad mayor a 120 anios", () => {
    const errores = validarPaciente(pacienteValido({ fechaNacimiento: "1800-01-01" }));

    expect(errores.fechaNacimiento).toBeTruthy();
  });

  it("el DPI es opcional", () => {
    expect(validarPaciente(pacienteValido({ dpi: undefined }))).toEqual({});
  });

  it("rechaza un DPI que no tiene exactamente 13 digitos", () => {
    const errores = validarPaciente(pacienteValido({ dpi: "123" }));

    expect(errores.dpi).toBeTruthy();
  });

  it("acepta un DPI de 13 digitos", () => {
    expect(validarPaciente(pacienteValido({ dpi: "2547891230101" }))).toEqual({});
  });
});

describe("validarRegistroPaciente", () => {
  it("no reporta errores con los 11 campos de CAMPOS_REGISTRO_PACIENTE completos", () => {
    expect(validarRegistroPaciente(registroValido())).toEqual({});
  });

  it("exige sexo, telefonoContacto e idioma ademas de lo que ya exige validarPaciente", () => {
    const errores = validarRegistroPaciente({});

    expect(errores.nombres).toBeTruthy();
    expect(errores.apellidos).toBeTruthy();
    expect(errores.fechaNacimiento).toBeTruthy();
    expect(errores.sexo).toBeTruthy();
    expect(errores.telefonoContacto).toBeTruthy();
    expect(errores.idioma).toBeTruthy();
    expect(errores.numeroFicha).toBeUndefined();
  });

  it("tampoco exige comunidad al registrar (#657)", () => {
    expect(validarRegistroPaciente({}).comunidad).toBeUndefined();
    expect(validarRegistroPaciente(registroValido({ comunidad: "" })).comunidad).toBeUndefined();
  });

  it("comparte las mismas reglas de negocio de fecha de nacimiento y DPI que validarPaciente", () => {
    const errores = validarRegistroPaciente(registroValido({ dpi: "123" }));

    expect(errores.dpi).toBe(validarPaciente(pacienteValido({ dpi: "123" })).dpi);
  });
});

describe("normalizarDatosPaciente", () => {
  it("recorta espacios y colapsa espacios internos en nombres, apellidos y comunidad", () => {
    const normalizado = normalizarDatosPaciente({
      nombres: "  Maria   Jose  ",
      apellidos: "  Xoc  ",
      comunidad: "  Comunidad   Central  ",
    });

    expect(normalizado.nombres).toBe("Maria Jose");
    expect(normalizado.apellidos).toBe("Xoc");
    expect(normalizado.comunidad).toBe("Comunidad Central");
  });

  it("convierte un DPI vacio en null", () => {
    expect(normalizarDatosPaciente({ dpi: "" }).dpi).toBeNull();
    expect(normalizarDatosPaciente({}).dpi).toBeNull();
  });
});
