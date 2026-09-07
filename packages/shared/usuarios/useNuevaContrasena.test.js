// Pruebas de las funciones puras de useNuevaContrasena.js.
//
// El hook en si no se prueba con renderHook: vitest.config.js de packages/shared corre en
// entorno "node", sin DOM, mismo motivo por el que useRegistroDonacion.test.js solo prueba sus
// funciones puras. La decision no trivial de este archivo -si una sesion de recuperacion valida
// debe dejar fijar la contrasena o bloquearse por cuenta desactivada (issue #644)- vive en una
// funcion exportada aparte justamente para poder probarla asi.

import { describe, expect, it } from "vitest";

import { debeBloquearPorInactivo } from "./useNuevaContrasena.js";

describe("debeBloquearPorInactivo (issue #644)", () => {
  it("bloquea cuando el perfil esta desactivado", () => {
    expect(debeBloquearPorInactivo({ activo: false })).toBe(true);
  });

  it("no bloquea cuando el perfil esta activo", () => {
    expect(debeBloquearPorInactivo({ activo: true })).toBe(false);
  });

  it("no bloquea si no se pudo leer el perfil (null o undefined)", () => {
    // Ante la duda no se inventa un bloqueo: el error real (enlace caducado, etc.) lo reporta
    // igual el updateUser() que sigue despues.
    expect(debeBloquearPorInactivo(null)).toBe(false);
    expect(debeBloquearPorInactivo(undefined)).toBe(false);
  });
});
