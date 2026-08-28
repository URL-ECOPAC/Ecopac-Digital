// Prueba de la parte pura del hook de edicion de usuario (issue #107).
//
// El hook en si no se monta: mismo motivo que useAltaUsuario.test.js, packages/shared corre
// vitest con environment "node". Lo unico verificable sin DOM es CAMPOS_EDICION_USUARIO, el
// subconjunto de CAMPOS_USUARIO que arma el modal.

import { describe, expect, it } from "vitest";

import { CAMPOS_USUARIO } from "./campos.js";
import { CAMPOS_EDICION_USUARIO } from "./useEdicionUsuario.js";

describe("CAMPOS_EDICION_USUARIO", () => {
  it("son exactamente los cuatro campos que pide el criterio 1 del issue #107", () => {
    expect(CAMPOS_EDICION_USUARIO.map((campo) => campo.id)).toEqual([
      "nombres",
      "apellidos",
      "telefono",
      "rol",
    ]);
  });

  it("no incluye especialidades: RLS es de solo lectura y no hay componente que las edite (issue #405)", () => {
    expect(CAMPOS_EDICION_USUARIO.find((campo) => campo.id === "especialidades")).toBeUndefined();
  });

  it("no incluye email: no es editable (actualizarUsuario() lo descarta)", () => {
    expect(CAMPOS_EDICION_USUARIO.find((campo) => campo.id === "email")).toBeUndefined();
  });

  it("no incluye activo: eso lo maneja la confirmacion de desactivar/reactivar, no este formulario", () => {
    expect(CAMPOS_EDICION_USUARIO.find((campo) => campo.id === "activo")).toBeUndefined();
  });

  it("cada campo es el mismo objeto de CAMPOS_USUARIO, no una copia con datos propios", () => {
    for (const campo of CAMPOS_EDICION_USUARIO) {
      const original = CAMPOS_USUARIO.find((c) => c.id === campo.id);
      expect(campo).toBe(original);
    }
  });
});
