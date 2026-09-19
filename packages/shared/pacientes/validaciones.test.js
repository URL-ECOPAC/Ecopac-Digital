// Pruebas de las reglas de validacion de pacientes.
//
// Hasta la #699 habia dos validadores para la misma entidad: validarPaciente() (CAMPOS_PACIENTE,
// cinco campos, issue #112) y validarRegistroPaciente() (CAMPOS_REGISTRO_PACIENTE, los once, issue
// #113). El primero ya no lo llamaba ninguna pantalla -- el registro, la edicion y
// actualizarPaciente() usan el segundo -- y se borro; sus casos de reglas de negocio se conservan
// aqui, ejecutados contra el que si se usa.
//
// numeroFicha no es un campo de ningun formulario: lo genera el servidor (issue #114).
//
// Ningun dato real: nombres y DPI son inventados.

import { describe, expect, it } from "vitest";

import { SEXOS } from "../enums.js";
import { aCadenaFechaLocal } from "../formato/fechas.js";
import { normalizarDatosPaciente, validarRegistroPaciente } from "./validaciones.js";

/** Los campos que no dependen del formulario: los mismos que validaba validarPaciente(). */
function pacienteValido(cambios = {}) {
  return {
    nombres: "Maria",
    apellidos: "Xoc",
    fechaNacimiento: "1990-05-10",
    comunidad: "comunidad-1",
    ...cambios,
  };
}

/** Formulario valido minimo: los campos obligatorios de CAMPOS_REGISTRO_PACIENTE. */
function registroValido(cambios = {}) {
  return {
    ...pacienteValido(),
    sexo: SEXOS.FEMENINO,
    telefonoContacto: "50212345678",
    idioma: "espanol",
    ...cambios,
  };
}

describe("reglas de negocio comunes a cualquier formulario de paciente", () => {
  it("no reporta errores con el formulario completo", () => {
    expect(validarRegistroPaciente(registroValido())).toEqual({});
  });

  it("exige nombres, apellidos y fecha de nacimiento", () => {
    const errores = validarRegistroPaciente({});

    expect(errores.nombres).toBeTruthy();
    expect(errores.apellidos).toBeTruthy();
    expect(errores.fechaNacimiento).toBeTruthy();
  });

  // La comunidad dejo de ser obligatoria en la #657: en jornada no siempre se sabe de donde viene
  // la persona, y exigirla llevaba a inventar una comunidad o a no registrarla. La columna admite
  // NULL desde la 00111 y fn_buscar_pacientes la une con LEFT JOIN para que siga apareciendo.
  it("no exige comunidad: es opcional desde la #657", () => {
    expect(validarRegistroPaciente({}).comunidad).toBeUndefined();
    expect(validarRegistroPaciente(registroValido({ comunidad: "" })).comunidad).toBeUndefined();
  });

  it("no inventa un error sobre numeroFicha, que no es un campo del formulario", () => {
    expect(validarRegistroPaciente(registroValido()).numeroFicha).toBeUndefined();
  });

  // Issue #699: hasta la 00132 la columna era un VARCHAR sin CHECK y cualquier cadena se guardaba.
  // Ahora es el enum sexo_paciente, y esto es su espejo en el cliente: lo dice antes de que la base
  // conteste 22P02, que no nombra el campo.
  it("rechaza un sexo que no esta en el enum", () => {
    const errores = validarRegistroPaciente(registroValido({ sexo: "femenino" }));

    expect(errores.sexo).toMatch(/Femenino/);
  });

  it("acepta los dos valores del enum, y solo esos", () => {
    for (const valor of Object.values(SEXOS)) {
      expect(validarRegistroPaciente(registroValido({ sexo: valor })).sexo).toBeUndefined();
    }
    expect(validarRegistroPaciente(registroValido({ sexo: "F" })).sexo).toBeTruthy();
  });

  it("rechaza una fecha de nacimiento futura", () => {
    const manana = new Date();
    manana.setDate(manana.getDate() + 1);

    const errores = validarRegistroPaciente(
      registroValido({ fechaNacimiento: aCadenaFechaLocal(manana) }),
    );

    expect(errores.fechaNacimiento).toBeTruthy();
  });

  // issue #694: usaba new Date(fechaNacimiento), que interpreta "AAAA-MM-DD" como medianoche
  // UTC. En una zona horaria con offset negativo (Guatemala, UTC-6) la fecha parseada cae en la
  // tarde del dia anterior; aFechaLocal() la lee como dia de calendario sin ese desplazamiento.
  it("acepta una fecha de nacimiento de hoy mismo, sin importar la zona horaria", () => {
    const ahora = new Date();
    const hoyComoTexto = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}-${String(ahora.getDate()).padStart(2, "0")}`;

    const errores = validarRegistroPaciente(registroValido({ fechaNacimiento: hoyComoTexto }));

    expect(errores.fechaNacimiento).toBeUndefined();
  });

  it("rechaza una edad mayor a 120 anios", () => {
    const errores = validarRegistroPaciente(registroValido({ fechaNacimiento: "1800-01-01" }));

    expect(errores.fechaNacimiento).toBeTruthy();
  });

  it("el DPI es opcional", () => {
    expect(validarRegistroPaciente(registroValido({ dpi: undefined }))).toEqual({});
  });

  it("rechaza un DPI que no tiene exactamente 13 digitos", () => {
    const errores = validarRegistroPaciente(registroValido({ dpi: "123" }));

    expect(errores.dpi).toBeTruthy();
  });

  it("acepta un DPI de 13 digitos", () => {
    expect(validarRegistroPaciente(registroValido({ dpi: "2547891230101" }))).toEqual({});
  });
});

describe("validarRegistroPaciente", () => {
  it("no reporta errores con los 11 campos de CAMPOS_REGISTRO_PACIENTE completos", () => {
    expect(validarRegistroPaciente(registroValido())).toEqual({});
  });

  it("exige sexo e idioma, que la tabla declara NOT NULL", () => {
    const errores = validarRegistroPaciente({});

    expect(errores.nombres).toBeTruthy();
    expect(errores.apellidos).toBeTruthy();
    expect(errores.fechaNacimiento).toBeTruthy();
    expect(errores.sexo).toBeTruthy();
    expect(errores.idioma).toBeTruthy();
    expect(errores.numeroFicha).toBeUndefined();
  });

  it("tampoco exige comunidad al registrar (#657)", () => {
    expect(validarRegistroPaciente({}).comunidad).toBeUndefined();
    expect(validarRegistroPaciente(registroValido({ comunidad: "" })).comunidad).toBeUndefined();
  });

  // Issue #838: en muchas comunidades no hay ningun numero al que llamar, y exigirlo llevaba a
  // inventar uno. La columna admite NULL desde la 00130.
  it("tampoco exige telefono de contacto", () => {
    expect(validarRegistroPaciente({}).telefonoContacto).toBeUndefined();
    expect(
      validarRegistroPaciente(registroValido({ telefonoContacto: "" })).telefonoContacto,
    ).toBeUndefined();
  });

  it("el DPI se valida con la misma regla que exige la base (chk_pacientes_dpi_13_digitos)", () => {
    expect(validarRegistroPaciente(registroValido({ dpi: "123" })).dpi).toBeTruthy();
    expect(validarRegistroPaciente(registroValido({ dpi: "12345678901234" })).dpi).toBeTruthy();
    expect(validarRegistroPaciente(registroValido({ dpi: "2547891230101" })).dpi).toBeUndefined();
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
