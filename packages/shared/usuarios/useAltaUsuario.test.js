// Prueba de la parte pura del hook de alta de usuario.
//
// El hook en si no se monta: mismo motivo que useUsuariosListado.test.js, packages/shared corre
// vitest con environment "node". Lo verificable sin DOM es CAMPOS_ALTA_USUARIO, el subconjunto
// de CAMPOS_USUARIO que arma el modal, y complementoDeAlta().

import { describe, expect, it } from "vitest";

import { CAMPOS_ALTA_USUARIO, CAMPOS_USUARIO } from "./campos.js";
import { avisoDeCorreoNoEnviado, complementoDeAlta } from "./useAltaUsuario.js";

describe("avisoDeCorreoNoEnviado", () => {
  it("avisa cuando la funcion dice que el correo no salio", () => {
    const aviso = avisoDeCorreoNoEnviado({ email: "persona@example.com", correoEnviado: false });
    expect(aviso).toContain("persona@example.com");
    expect(aviso).toContain("no se pudo enviar el correo");
  });

  it("no avisa si el correo salio", () => {
    expect(
      avisoDeCorreoNoEnviado({ email: "persona@example.com", correoEnviado: true }),
    ).toBeNull();
  });

  it("no inventa un fallo si la respuesta no trae correoEnviado", () => {
    expect(avisoDeCorreoNoEnviado({ id: "1" })).toBeNull();
    expect(avisoDeCorreoNoEnviado(null)).toBeNull();
  });
});

describe("CAMPOS_ALTA_USUARIO", () => {
  // Issue #840 (B1): el alta pide lo mismo que la edicion, no cinco campos de ocho.
  it("son los mismos ocho campos que la edicion, en el mismo orden", () => {
    expect(CAMPOS_ALTA_USUARIO.map((campo) => campo.id)).toEqual([
      "nombres",
      "apellidos",
      "email",
      "telefono",
      "rol",
      "fechaIngreso",
      "direccion",
      "notas",
    ]);
  });

  it("no incluye especialidades: no hay donde guardarlas todavia (issue #405)", () => {
    expect(CAMPOS_ALTA_USUARIO.find((campo) => campo.id === "especialidades")).toBeUndefined();
  });

  it("cada campo es el mismo objeto de CAMPOS_USUARIO, no una copia con datos propios", () => {
    for (const campo of CAMPOS_ALTA_USUARIO) {
      const original = CAMPOS_USUARIO.find((c) => c.id === campo.id);
      expect(campo).toBe(original);
    }
  });
});

// Lo que la invitacion no lleva se escribe despues sobre el perfil creado (issue #840, B1).
describe("complementoDeAlta", () => {
  it("toma solo fecha de ingreso, direccion y notas, y solo si se llenaron", () => {
    expect(
      complementoDeAlta({
        nombres: "Persona",
        email: "persona@example.com",
        fechaIngreso: "2026-01-10",
        direccion: "  ",
        notas: "Turno de tarde",
      }),
    ).toEqual({ fechaIngreso: "2026-01-10", notas: "Turno de tarde" });
  });

  it("sin nada que completar devuelve un objeto vacio", () => {
    expect(complementoDeAlta({ nombres: "Persona" })).toEqual({});
    expect(complementoDeAlta(undefined)).toEqual({});
  });
});
