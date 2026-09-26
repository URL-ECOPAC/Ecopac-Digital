// Pruebas del acceso de la sesion (migracion 00148). Ningun dato real.

import { afterEach, describe, expect, it } from "vitest";

import {
  accedeAModuloPorMatriz,
  fijarAccesoDeSesion,
  limpiarAccesoDeSesion,
  modulosPorPermisoFino,
  tienePermisoFino,
} from "./acceso.js";
import { ROLES } from "./roles.js";

afterEach(() => {
  limpiarAccesoDeSesion();
});

describe("tienePermisoFino", () => {
  it("la administradora tiene todos, con o sin sesion cargada", () => {
    expect(tienePermisoFino(ROLES.ADMINISTRADOR, "donaciones.registrar")).toBe(true);
  });

  it("sin sesion cargada responde el valor por defecto del rol (rol_permiso)", () => {
    expect(tienePermisoFino(ROLES.VOLUNTARIO, "pacientes.editar")).toBe(true);
    expect(tienePermisoFino(ROLES.MEDICO, "inventario.aprobar")).toBe(false);
    expect(tienePermisoFino(ROLES.JUNTA_DIRECTIVA, "reportes.exportar")).toBe(true);
  });

  it("con sesion cargada responde sus permisos efectivos: una delegacion se ve", () => {
    fijarAccesoDeSesion({
      rol: ROLES.MEDICO,
      permisos: ["pacientes.editar", "inventario.aprobar"],
    });
    expect(tienePermisoFino(ROLES.MEDICO, "inventario.aprobar")).toBe(true);
  });

  it("y una revocacion puntual tambien: el medico sin pacientes.editar ya no lo tiene", () => {
    fijarAccesoDeSesion({ rol: ROLES.MEDICO, permisos: [] });
    expect(tienePermisoFino(ROLES.MEDICO, "pacientes.editar")).toBe(false);
  });

  it("lo de la persona conectada no se le atribuye a otro rol", () => {
    fijarAccesoDeSesion({ rol: ROLES.MEDICO, permisos: ["donaciones.registrar"] });
    expect(tienePermisoFino(ROLES.VOLUNTARIO, "donaciones.registrar")).toBe(false);
  });
});

describe("accedeAModuloPorMatriz", () => {
  it("solo para el rol de la sesion, y solo lo que la matriz abrio", () => {
    fijarAccesoDeSesion({ rol: ROLES.JUNTA_DIRECTIVA, modulos: ["pacientes"] });
    expect(accedeAModuloPorMatriz(ROLES.JUNTA_DIRECTIVA, "pacientes")).toBe(true);
    expect(accedeAModuloPorMatriz(ROLES.JUNTA_DIRECTIVA, "donaciones")).toBe(false);
    expect(accedeAModuloPorMatriz(ROLES.SOCIO_FUNDADOR, "pacientes")).toBe(false);
  });

  it("al cerrar sesion no queda nada abierto", () => {
    fijarAccesoDeSesion({ rol: ROLES.JUNTA_DIRECTIVA, modulos: ["pacientes"] });
    limpiarAccesoDeSesion();
    expect(accedeAModuloPorMatriz(ROLES.JUNTA_DIRECTIVA, "pacientes")).toBe(false);
  });
});

describe("modulosPorPermisoFino", () => {
  it("cada permiso delegado lleva a su modulo; gestionar permisos lleva a Colaboradores", () => {
    fijarAccesoDeSesion({
      rol: ROLES.VOLUNTARIO,
      permisos: ["donaciones.registrar", "usuarios.gestionar_permisos"],
    });
    expect([...modulosPorPermisoFino(ROLES.VOLUNTARIO)].sort()).toEqual([
      "colaboradores",
      "donaciones",
    ]);
  });
});
