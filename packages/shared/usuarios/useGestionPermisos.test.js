// Pruebas de la parte pura de useGestionPermisos (issue #108).
//
// El hook en si no se monta: mismo motivo que useDesactivacionUsuario.test.js, packages/shared
// corre vitest con environment "node". buscarPermiso, accionesDisponibles y huboCambioEnPermiso
// son funciones exportadas y no codigo suelto dentro del hook por eso.

import { describe, expect, it } from "vitest";

import { ORIGEN_PERMISO } from "./permisos.api.js";
import { accionesDisponibles, buscarPermiso, huboCambioEnPermiso } from "./useGestionPermisos.js";

const MODULOS = [
  {
    modulo: "jornadas",
    permisos: [{ clave: "jornadas.gestionar", concedido: true, origen: ORIGEN_PERMISO.ROL }],
  },
  {
    modulo: "usuarios",
    permisos: [
      { clave: "usuarios.gestionar_permisos", concedido: false, origen: ORIGEN_PERMISO.INDIVIDUAL },
    ],
  },
];

describe("buscarPermiso", () => {
  it("encuentra un permiso por clave en cualquier modulo", () => {
    expect(buscarPermiso(MODULOS, "usuarios.gestionar_permisos")).toMatchObject({
      concedido: false,
      origen: ORIGEN_PERMISO.INDIVIDUAL,
    });
  });

  it("devuelve null si la clave no esta en ningun modulo", () => {
    expect(buscarPermiso(MODULOS, "modulo.inexistente")).toBeNull();
  });

  it("sin modulos no revienta", () => {
    expect(buscarPermiso(undefined, "jornadas.gestionar")).toBeNull();
  });
});

describe("accionesDisponibles", () => {
  it("heredado del rol y concedido: solo ofrece revocar", () => {
    expect(accionesDisponibles({ concedido: true, origen: ORIGEN_PERMISO.ROL })).toEqual({
      mostrarConceder: false,
      mostrarRevocar: true,
      mostrarRestablecer: false,
    });
  });

  it("heredado del rol y no concedido: solo ofrece conceder", () => {
    expect(accionesDisponibles({ concedido: false, origen: ORIGEN_PERMISO.ROL })).toEqual({
      mostrarConceder: true,
      mostrarRevocar: false,
      mostrarRestablecer: false,
    });
  });

  it("excepcion individual concedida: ofrece revocar y restablecer", () => {
    expect(accionesDisponibles({ concedido: true, origen: ORIGEN_PERMISO.INDIVIDUAL })).toEqual({
      mostrarConceder: false,
      mostrarRevocar: true,
      mostrarRestablecer: true,
    });
  });

  it("excepcion individual revocada: ofrece conceder y restablecer", () => {
    expect(accionesDisponibles({ concedido: false, origen: ORIGEN_PERMISO.INDIVIDUAL })).toEqual({
      mostrarConceder: true,
      mostrarRevocar: false,
      mostrarRestablecer: true,
    });
  });
});

describe("huboCambioEnPermiso", () => {
  const permiso = { concedido: true, origen: ORIGEN_PERMISO.ROL };

  it("sin cambio de concedido ni origen: no hubo cambio", () => {
    expect(huboCambioEnPermiso(permiso, { ...permiso })).toBe(false);
  });

  it("cambio de concedido: si hubo cambio", () => {
    expect(huboCambioEnPermiso(permiso, { ...permiso, concedido: false })).toBe(true);
  });

  it("cambio de origen aunque concedido sea igual: si hubo cambio", () => {
    expect(huboCambioEnPermiso(permiso, { ...permiso, origen: ORIGEN_PERMISO.INDIVIDUAL })).toBe(
      true,
    );
  });

  it("si no se pudo leer un lado, se asume que si hubo cambio (no avisar en falso)", () => {
    expect(huboCambioEnPermiso(null, permiso)).toBe(true);
    expect(huboCambioEnPermiso(permiso, null)).toBe(true);
  });
});
