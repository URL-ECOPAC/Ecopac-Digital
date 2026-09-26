// Pruebas de los permisos del modulo de usuarios.
//
// Se importan los modulos directamente y no el barril packages/shared/index.js: el barril
// arrastra @supabase/supabase-js y el modulo de entorno, y estas pruebas tienen que correr sin
// .env y sin conexion. Mismo patron que jornadas/permisos.test.js.

import { afterEach, describe, expect, it } from "vitest";

import { fijarAccesoDeSesion, limpiarAccesoDeSesion } from "./acceso.js";
import { ROLES } from "./roles.js";
import {
  etiquetaDeModuloDePermiso,
  permisosDeUsuarios,
  puedeCrearUsuario,
  puedeDesactivarUsuario,
  puedeEditarOtroPerfil,
  puedeGestionarMatrizDePermisosPorRol,
  puedeGestionarPermisosFinos,
  puedeReactivarUsuario,
  puedeVerListadoUsuarios,
  puedeVerPermisosEfectivosDeOtro,
} from "./permisos.js";

const NO_ADMIN = [ROLES.JUNTA_DIRECTIVA, ROLES.SOCIO_FUNDADOR, ROLES.MEDICO, ROLES.VOLUNTARIO];

afterEach(() => {
  limpiarAccesoDeSesion();
});

describe("etiquetaDeModuloDePermiso", () => {
  it("usa el nombre del modulo de MODULOS", () => {
    expect(etiquetaDeModuloDePermiso("donaciones")).toBe("Donaciones");
  });

  it("usuarios, sin entrada en MODULOS, sale con mayuscula inicial y no crudo", () => {
    expect(etiquetaDeModuloDePermiso("usuarios")).toBe("Usuarios");
  });

  it("un modulo desconocido sale con mayuscula inicial y sin guiones bajos", () => {
    expect(etiquetaDeModuloDePermiso("modulo_nuevo")).toBe("Modulo nuevo");
  });
});

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

  // ISSUE #864: junta directiva leia el listado por la vista perfiles_directorio (00038), y la
  // #756 le habia abierto la ruta para que esa vista tuviera por donde llegarse. Ahora su unica
  // pantalla es Reportes, y la 00141 reescribe la vista para que diga lo mismo que esto.
  it("solo administrador ve el listado de personal (issues #756 y #864)", () => {
    expect(puedeVerListadoUsuarios(ROLES.ADMINISTRADOR)).toBe(true);

    for (const rol of NO_ADMIN) {
      expect(puedeVerListadoUsuarios(rol)).toBe(false);
    }
  });

  it("solo administrador gestiona permisos finos de otra persona (usuario_permiso, 00038)", () => {
    expect(puedeGestionarPermisosFinos(ROLES.ADMINISTRADOR)).toBe(true);
    expect(puedeVerPermisosEfectivosDeOtro(ROLES.ADMINISTRADOR)).toBe(true);

    for (const rol of NO_ADMIN) {
      expect(puedeGestionarPermisosFinos(rol)).toBe(false);
      expect(puedeVerPermisosEfectivosDeOtro(rol)).toBe(false);
    }
  });

  it("solo administrador gestiona la matriz de acceso por rol (rol_modulo, 00148)", () => {
    expect(puedeGestionarMatrizDePermisosPorRol(ROLES.ADMINISTRADOR)).toBe(true);

    for (const rol of NO_ADMIN) {
      expect(puedeGestionarMatrizDePermisosPorRol(rol)).toBe(false);
    }
  });

  // 00148: gestionar permisos se delega por persona, y quien lo tiene llega al listado.
  it("con usuarios.gestionar_permisos delegado, gestiona permisos y ve el listado", () => {
    fijarAccesoDeSesion({ rol: ROLES.MEDICO, permisos: ["usuarios.gestionar_permisos"] });

    expect(puedeGestionarPermisosFinos(ROLES.MEDICO)).toBe(true);
    expect(puedeVerPermisosEfectivosDeOtro(ROLES.MEDICO)).toBe(true);
    expect(puedeVerListadoUsuarios(ROLES.MEDICO)).toBe(true);
    // Lo demas de Colaboradores sigue siendo de la administradora.
    expect(puedeEditarOtroPerfil(ROLES.MEDICO)).toBe(false);
    expect(puedeCrearUsuario(ROLES.MEDICO)).toBe(false);
  });

  it("con Colaboradores abierto por la matriz, ve el listado y nada mas", () => {
    fijarAccesoDeSesion({ rol: ROLES.JUNTA_DIRECTIVA, modulos: ["colaboradores"] });

    expect(puedeVerListadoUsuarios(ROLES.JUNTA_DIRECTIVA)).toBe(true);
    expect(puedeGestionarPermisosFinos(ROLES.JUNTA_DIRECTIVA)).toBe(false);
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
    // ISSUE #864: junta directiva tenia `puedeVerListado: true` por perfiles_directorio. Ya no
    // ve ningun modulo de usuarios: ninguno de los cuatro roles no administradores puede nada.
    for (const rol of NO_ADMIN) {
      expect(permisosDeUsuarios(rol)).toEqual({
        puedeCrear: false,
        puedeEditarOtro: false,
        puedeDesactivar: false,
        puedeReactivar: false,
        puedeVerListado: false,
        puedeGestionarPermisosFinos: false,
        puedeVerPermisosEfectivosDeOtro: false,
      });
    }

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
