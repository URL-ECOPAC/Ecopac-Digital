// Prueba de la parte pura del hook de edicion de usuario (issue #107).
//
// El hook en si no se monta: mismo motivo que useAltaUsuario.test.js, packages/shared corre
// vitest con environment "node". Lo unico verificable sin DOM es CAMPOS_EDICION_USUARIO, el
// subconjunto de CAMPOS_USUARIO que arma el modal.

import { describe, expect, it } from "vitest";

import { CAMPOS_ALTA_USUARIO, CAMPOS_EDICION_USUARIO, CAMPOS_USUARIO } from "./campos.js";
import { debeRefrescarSesion } from "./useEdicionUsuario.js";

// Issue #840: editarse a uno mismo desde Colaboradores no llegaba a la sesion.
describe("debeRefrescarSesion", () => {
  it("solo cuando el perfil editado es el de la sesion", () => {
    expect(debeRefrescarSesion("u1", "u1")).toBe(true);
    expect(debeRefrescarSesion("u1", "u2")).toBe(false);
  });

  it("sin ids no refresca: dos undefined no son la misma persona", () => {
    expect(debeRefrescarSesion(undefined, undefined)).toBe(false);
  });
});

describe("CAMPOS_EDICION_USUARIO", () => {
  // Issue #840 (B1): el mismo juego de campos que el alta.
  it("son los mismos campos que el alta, en el mismo orden", () => {
    expect(CAMPOS_EDICION_USUARIO.map((campo) => campo.id)).toEqual(
      CAMPOS_ALTA_USUARIO.map((campo) => campo.id),
    );
  });

  it("no incluye especialidades: RLS es de solo lectura y no hay componente que las edite (issue #405)", () => {
    expect(CAMPOS_EDICION_USUARIO.find((campo) => campo.id === "especialidades")).toBeUndefined();
  });

  it("el correo se ve pero es de solo lectura: actualizarUsuario() lo descarta", () => {
    const email = CAMPOS_EDICION_USUARIO.find((campo) => campo.id === "email");
    expect(email.soloLectura).toBe(true);
    expect(
      CAMPOS_EDICION_USUARIO.filter((campo) => campo.soloLectura).map((campo) => campo.id),
    ).toEqual(["email"]);
  });

  it("no incluye activo: eso lo maneja la confirmacion de desactivar/reactivar, no este formulario", () => {
    expect(CAMPOS_EDICION_USUARIO.find((campo) => campo.id === "activo")).toBeUndefined();
  });

  it("cada campo editable es el mismo objeto de CAMPOS_USUARIO, no una copia con datos propios", () => {
    for (const campo of CAMPOS_EDICION_USUARIO.filter((c) => !c.soloLectura)) {
      const original = CAMPOS_USUARIO.find((c) => c.id === campo.id);
      expect(campo).toBe(original);
    }
  });
});
