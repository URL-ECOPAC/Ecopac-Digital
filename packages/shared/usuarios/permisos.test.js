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
  puedeGestionarPermisosFinos,
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
