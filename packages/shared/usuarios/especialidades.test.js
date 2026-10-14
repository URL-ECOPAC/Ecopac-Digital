// Pruebas de la escritura de especialidades (perfil_especialidad, 00002 / 00085).
//
// Solo las funciones puras: normalizar la lista y validarla. sincronizarEspecialidadesDePerfil()
// habla con Supabase y se prueba a traves de api.test.js, que ya tiene el andamiaje de mocks del
// cliente; aqui interesa la regla de dominio, que es donde estaba el riesgo real.

import { describe, expect, it } from "vitest";

import { normalizarEspecialidades, validarEspecialidades } from "./api.js";
import { puedeGestionarEspecialidades } from "./permisos.js";
import { ROLES } from "./roles.js";

describe("normalizarEspecialidades", () => {
  it("recorta espacios y descarta lo que quede vacio", () => {
    expect(normalizarEspecialidades(["  Pediatria ", "", "   ", "Cardiologia"])).toEqual([
      "Pediatria",
      "Cardiologia",
    ]);
  });

  it("quita duplicados sin distinguir mayusculas, y conserva la forma que se escribio", () => {
    // La PK de perfil_especialidad es (perfil_id, nombre_especialidad) y SI distingue
    // mayusculas: sin esto, el mismo medico podria acabar con "Pediatria" y "PEDIATRIA" como
    // dos especialidades distintas.
    expect(normalizarEspecialidades(["Pediatria", "PEDIATRIA", "pediatria"])).toEqual([
      "Pediatria",
    ]);
  });

  it("aguanta una lista vacia o sin definir", () => {
    expect(normalizarEspecialidades()).toEqual([]);
    expect(normalizarEspecialidades([])).toEqual([]);
    expect(normalizarEspecialidades([null, undefined])).toEqual([]);
  });
});

describe("validarEspecialidades", () => {
  it("acepta lo que cabe en la columna", () => {
    expect(validarEspecialidades(["Pediatria", "a".repeat(100)])).toEqual({});
  });

  it("rechaza lo que pasa de VARCHAR(100), antes de gastar la llamada de red", () => {
    const errores = validarEspecialidades(["a".repeat(101)]);
    expect(errores.especialidades).toContain("100 caracteres");
  });
});

describe("puedeGestionarEspecialidades", () => {
  it("la administradora gestiona las de cualquiera", () => {
    expect(puedeGestionarEspecialidades(ROLES.ADMINISTRADOR)).toBe(true);
    expect(puedeGestionarEspecialidades(ROLES.ADMINISTRADOR, { esPropioPerfil: false })).toBe(true);
  });

  it("cualquier rol gestiona las suyas", () => {
    for (const rol of [ROLES.MEDICO, ROLES.VOLUNTARIO, ROLES.JUNTA_DIRECTIVA]) {
      expect(puedeGestionarEspecialidades(rol, { esPropioPerfil: true })).toBe(true);
    }
  });

  it("nadie mas toca las de otro: espejo de las politicas de la 00085", () => {
    for (const rol of [
      ROLES.MEDICO,
      ROLES.VOLUNTARIO,
      ROLES.JUNTA_DIRECTIVA,
      ROLES.SOCIO_FUNDADOR,
    ]) {
      expect(puedeGestionarEspecialidades(rol, { esPropioPerfil: false })).toBe(false);
    }
  });

  it("los roles consultivos LEEN pero no escriben, aunque la 00085 les amplio el SELECT", () => {
    expect(puedeGestionarEspecialidades(ROLES.SOCIO_FUNDADOR)).toBe(false);
    expect(puedeGestionarEspecialidades(ROLES.JUNTA_DIRECTIVA)).toBe(false);
  });
});
