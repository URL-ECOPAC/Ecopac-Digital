// Prueba de la parte pura del chequeo de cliente de desactivar/reactivar (issue #107,
// criterios 4 y 5).
//
// El hook en si no se monta: mismo motivo que useAltaUsuario.test.js, packages/shared corre
// vitest con environment "node". Por eso evaluarBloqueoSincronico() y
// requiereContarAdministradoresActivos() son funciones exportadas y no codigo suelto dentro
// del hook. Ninguna de las dos llama al servidor -esa parte (contarAdministradoresActivos())
// ya tiene su propia prueba en api.test.js-, asi que no hace falta mockear el cliente aca.

import { describe, expect, it } from "vitest";

import { ROLES } from "./roles.js";
import {
  evaluarBloqueoSincronico,
  MENSAJE_AUTODESACTIVACION,
  requiereContarAdministradoresActivos,
} from "./useDesactivacionUsuario.js";

describe("evaluarBloqueoSincronico", () => {
  it("bloquea cuando el perfil objetivo es la propia sesion", () => {
    const bloqueo = evaluarBloqueoSincronico({ id: "u1" }, "u1");
    expect(bloqueo).toBe(MENSAJE_AUTODESACTIVACION);
  });

  it("no distingue rol: bloquea a un no administrador que se apunta a si mismo", () => {
    const bloqueo = evaluarBloqueoSincronico({ id: "u1", rol: ROLES.VOLUNTARIO }, "u1");
    expect(bloqueo).toBe(MENSAJE_AUTODESACTIVACION);
  });

  it("no bloquea sobre la fila de otra persona", () => {
    const bloqueo = evaluarBloqueoSincronico({ id: "u1" }, "u2");
    expect(bloqueo).toBeNull();
  });

  it("sin perfil objetivo no hay nada que bloquear", () => {
    expect(evaluarBloqueoSincronico(null, "u1")).toBeNull();
  });
});

describe("requiereContarAdministradoresActivos", () => {
  it("hace falta contar cuando el objetivo es un administrador activo", () => {
    expect(requiereContarAdministradoresActivos({ activo: true, rol: ROLES.ADMINISTRADOR })).toBe(
      true,
    );
  });

  it("reactivar (activo: false) nunca puede dejar el sistema sin administrador", () => {
    expect(requiereContarAdministradoresActivos({ activo: false, rol: ROLES.ADMINISTRADOR })).toBe(
      false,
    );
  });

  it("desactivar a alguien que no es administrador tampoco lo pone en riesgo", () => {
    expect(requiereContarAdministradoresActivos({ activo: true, rol: ROLES.MEDICO })).toBe(false);
  });

  it("sin perfil objetivo no hace falta contar nada", () => {
    expect(requiereContarAdministradoresActivos(null)).toBe(false);
  });
});
