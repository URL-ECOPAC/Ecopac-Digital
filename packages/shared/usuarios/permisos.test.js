// Pruebas de los permisos del modulo de usuarios.
//
// Se importan los modulos directamente y no el barril packages/shared/index.js: el barril
// arrastra @supabase/supabase-js y el modulo de entorno, y estas pruebas tienen que correr sin
// .env y sin conexion. Mismo patron que jornadas/permisos.test.js.

import { describe, expect, it } from "vitest";

import { ROLES } from "./roles.js";
import {
  permisosDeUsuarios,
  puedeCrearUsuario,
  puedeDesactivarUsuario,
  puedeEditarOtroPerfil,
  puedeGestionarMatrizDePermisosPorRol,
  puedeGestionarPermisosFinos,
  puedeNavegarModuloDelPermiso,
  puedeReactivarUsuario,
  puedeVerListadoUsuarios,
  puedeVerPermisosEfectivosDeOtro,
} from "./permisos.js";

const NO_ADMIN = [ROLES.JUNTA_DIRECTIVA, ROLES.SOCIO_FUNDADOR, ROLES.MEDICO, ROLES.VOLUNTARIO];

describe("permisos de usuarios", () => {
  it("solo administrador crea, edita a otros, desactiva y reactiva usuarios (00038)", () => {
    expect(puedeCrearUsuario(ROLES.ADMINISTRADOR)).toBe(true);
    expect(puedeEditarOtroPerfil(ROLES.ADMINISTRADOR)).toBe(true);
    expect(puedeDesactivarUsuario(ROLES.ADMINISTRADOR)).toBe(true);
    expect(puedeReactivarUsuario(ROLES.ADMINISTRADOR)).toBe(true);

    for (const rol of NO_ADMIN) {
      expect(puedeCrearUsuario(rol)).toBe(false);
      expect(puedeEditarOtroPerfil(rol)).toBe(false);
      expect(puedeDesactivarUsuario(rol)).toBe(false);
      expect(puedeReactivarUsuario(rol)).toBe(false);
    }
  });

  it("administrador y junta directiva ven el listado; socio fundador NO (perfiles_directorio)", () => {
    expect(puedeVerListadoUsuarios(ROLES.ADMINISTRADOR)).toBe(true);
    expect(puedeVerListadoUsuarios(ROLES.JUNTA_DIRECTIVA)).toBe(true);

    expect(puedeVerListadoUsuarios(ROLES.SOCIO_FUNDADOR)).toBe(false);
    expect(puedeVerListadoUsuarios(ROLES.MEDICO)).toBe(false);
    expect(puedeVerListadoUsuarios(ROLES.VOLUNTARIO)).toBe(false);
  });

  it("solo administrador gestiona permisos finos de otra persona (usuario_permiso, 00038)", () => {
    expect(puedeGestionarPermisosFinos(ROLES.ADMINISTRADOR)).toBe(true);
    expect(puedeVerPermisosEfectivosDeOtro(ROLES.ADMINISTRADOR)).toBe(true);

    for (const rol of NO_ADMIN) {
      expect(puedeGestionarPermisosFinos(rol)).toBe(false);
      expect(puedeVerPermisosEfectivosDeOtro(rol)).toBe(false);
    }
  });

  it("solo administrador gestiona la matriz de permisos por rol (rol_permiso, issue #638)", () => {
    expect(puedeGestionarMatrizDePermisosPorRol(ROLES.ADMINISTRADOR)).toBe(true);

    for (const rol of NO_ADMIN) {
      expect(puedeGestionarMatrizDePermisosPorRol(rol)).toBe(false);
    }
  });

  it("puedeNavegarModuloDelPermiso: un rol fuera de la lista del modulo no llega a la pantalla (issue #638)", () => {
    // donaciones esta en navegacion.js con roles [administrador, junta directiva, socio
    // fundador]: medico y voluntario nunca ven ese modulo, sin importar rol_permiso.
    expect(puedeNavegarModuloDelPermiso(ROLES.ADMINISTRADOR, "donaciones")).toBe(true);
    expect(puedeNavegarModuloDelPermiso(ROLES.JUNTA_DIRECTIVA, "donaciones")).toBe(true);
    expect(puedeNavegarModuloDelPermiso(ROLES.MEDICO, "donaciones")).toBe(false);
    expect(puedeNavegarModuloDelPermiso(ROLES.VOLUNTARIO, "donaciones")).toBe(false);
  });

  it("puedeNavegarModuloDelPermiso: pacientes esta abierto a los cinco roles", () => {
    for (const rol of [ROLES.ADMINISTRADOR, ...NO_ADMIN]) {
      expect(puedeNavegarModuloDelPermiso(rol, "pacientes")).toBe(
        rol !== ROLES.JUNTA_DIRECTIVA && rol !== ROLES.SOCIO_FUNDADOR,
      );
    }
  });

  it("puedeNavegarModuloDelPermiso: un modulo sin entrada en MODULOS no advierte en falso", () => {
    // "usuarios" es el caso real: usuarios.gestionar_permisos no tiene una entrada propia en
    // MODULOS (la pantalla real vive dentro de "colaboradores"), asi que rolesDelModulo()
    // devuelve un arreglo vacio. Se asume navegable antes que advertir de mas.
    expect(puedeNavegarModuloDelPermiso(ROLES.MEDICO, "usuarios")).toBe(true);
    expect(puedeNavegarModuloDelPermiso("modulo-inventado", "usuarios")).toBe(true);
  });

  it("un rol que no existe no puede nada", () => {
    expect(permisosDeUsuarios("coordinador")).toEqual({
      puedeCrear: false,
      puedeEditarOtro: false,
      puedeDesactivar: false,
      puedeReactivar: false,
      puedeVerListado: false,
      puedeGestionarPermisosFinos: false,
      puedeVerPermisosEfectivosDeOtro: false,
    });
  });

  it("agrupa los permisos para que un hook no llame a las funciones sueltas", () => {
    expect(permisosDeUsuarios(ROLES.JUNTA_DIRECTIVA)).toEqual({
      puedeCrear: false,
      puedeEditarOtro: false,
      puedeDesactivar: false,
      puedeReactivar: false,
      puedeVerListado: true,
      puedeGestionarPermisosFinos: false,
      puedeVerPermisosEfectivosDeOtro: false,
    });

    expect(permisosDeUsuarios(ROLES.ADMINISTRADOR)).toEqual({
      puedeCrear: true,
      puedeEditarOtro: true,
      puedeDesactivar: true,
      puedeReactivar: true,
      puedeVerListado: true,
      puedeGestionarPermisosFinos: true,
      puedeVerPermisosEfectivosDeOtro: true,
    });
  });
});
