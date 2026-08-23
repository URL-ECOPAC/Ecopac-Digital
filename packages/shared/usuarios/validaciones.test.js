// Pruebas de las validaciones de credenciales y perfil.
//
// Se importa validaciones.js directamente y no el barril packages/shared/index.js, para que
// estas pruebas no arrastren @supabase/supabase-js ni el modulo de entorno.
//
// Ningun caso usa datos reales de pacientes ni de personas del equipo: todos los correos y
// telefonos son inventados (regla de confidencialidad de AGENTS.md).

import { describe, expect, it } from "vitest";

import { ROLES } from "./roles.js";
import {
  LONGITUD_MINIMA_CONTRASENA,
  REGLAS_DE_CONTRASENA,
  validarContrasena,
  validarCorreo,
  validarCredenciales,
  validarPerfil,
  validarTelefonoGuatemala,
} from "./validaciones.js";

/** Perfil valido minimo, para que cada prueba solo altere el campo que le interesa. */
function perfilValido(cambios = {}) {
  return {
    nombres: "Ana Lucia",
    apellidos: "Perez",
    email: "ana.perez@ejemplo.org",
    telefono: "5512-3456",
    rol: ROLES.MEDICO,
    ...cambios,
  };
}

describe("validarCorreo", () => {
  it("normaliza a minusculas y recorta espacios", () => {
    // La columna email de la migracion 00002 es citext: el servidor no distingue mayusculas,
    // y normalizar aqui evita que el mismo correo aparezca escrito de dos formas.
    const { valor, errores } = validarCorreo("  ANA.Perez@Ejemplo.ORG  ");

    expect(valor).toBe("ana.perez@ejemplo.org");
    expect(errores).toEqual({});
  });

  it("pide el correo cuando viene vacio", () => {
    expect(validarCorreo("").errores).toHaveProperty("email");
    expect(validarCorreo("   ").errores).toHaveProperty("email");
  });

  it("rechaza una forma que ningun proveedor entregaria", () => {
    expect(validarCorreo("ana.perez").errores).toHaveProperty("email");
    expect(validarCorreo("ana@ejemplo").errores).toHaveProperty("email");
    expect(validarCorreo("ana ruiz@ejemplo.org").errores).toHaveProperty("email");
  });

  it("indexa el error por el id del campo, para pintarlo bajo el input", () => {
    expect(Object.keys(validarCorreo("").errores)).toEqual(["email"]);
  });
});

describe("validarContrasena", () => {
  it("acepta una contrasena que cumple las tres reglas", () => {
    expect(validarContrasena("ecopac2026")).toEqual({ errores: {}, reglasIncumplidas: [] });
  });

  it("devuelve TODAS las reglas incumplidas, no solo la primera", () => {
    // La pantalla de registro muestra la lista completa de requisitos y marca cuales faltan;
    // revelarlos de uno en uno obligaria a reintentar varias veces.
    const { errores, reglasIncumplidas } = validarContrasena("abc");

    expect(reglasIncumplidas.map((regla) => regla.id)).toEqual(["longitud", "numeros"]);
    expect(errores).toHaveProperty("contrasena");
  });

  it("con la contrasena vacia devuelve el catalogo completo de reglas", () => {
    const { errores, reglasIncumplidas } = validarContrasena("");

    expect(reglasIncumplidas).toEqual(REGLAS_DE_CONTRASENA);
    expect(errores).toHaveProperty("contrasena");
  });

  it("aplica la longitud minima que publica el modulo", () => {
    const justoDebajo = "a1".padEnd(LONGITUD_MINIMA_CONTRASENA - 1, "b");
    const justo = "a1".padEnd(LONGITUD_MINIMA_CONTRASENA, "b");

    const incumplidas = validarContrasena(justoDebajo).reglasIncumplidas;

    expect(incumplidas.map((regla) => regla.id)).toEqual(["longitud"]);
    expect(validarContrasena(justo).reglasIncumplidas).toEqual([]);
  });
});

describe("validarTelefonoGuatemala", () => {
  it("normaliza a ocho digitos sin importar como se escriba", () => {
    expect(validarTelefonoGuatemala("5512-3456").valor).toBe("55123456");
    expect(validarTelefonoGuatemala("+502 5512 3456").valor).toBe("55123456");
    expect(validarTelefonoGuatemala("(502) 5512-3456").valor).toBe("55123456");
    expect(validarTelefonoGuatemala("55123456").valor).toBe("55123456");
  });

  it("vacio no es error, porque la columna telefono admite NULL", () => {
    expect(validarTelefonoGuatemala("")).toEqual({ valor: "", errores: {} });
    expect(validarTelefonoGuatemala(null)).toEqual({ valor: "", errores: {} });
  });

  it("rechaza una cantidad de digitos que no es la de Guatemala", () => {
    expect(validarTelefonoGuatemala("1234").errores).toHaveProperty("telefono");
    expect(validarTelefonoGuatemala("551234567").errores).toHaveProperty("telefono");
    expect(validarTelefonoGuatemala("cinco cinco").errores).toHaveProperty("telefono");
  });
});

describe("validarPerfil", () => {
  it("no reporta nada cuando el perfil esta completo", () => {
    expect(validarPerfil(perfilValido())).toEqual({});
  });

  it("aplica lo que ya declaran los descriptores de CAMPOS_USUARIO", () => {
    const errores = validarPerfil(perfilValido({ nombres: "", apellidos: "" }));

    expect(errores).toHaveProperty("nombres");
    expect(errores).toHaveProperty("apellidos");
  });

  it("rechaza un rol que el enum rol_usuario no tiene", () => {
    // Si el rol no esta en el enum de la migracion 00001, la consulta falla en tiempo de
    // ejecucion y ninguna politica RLS lo reconoce.
    const errores = validarPerfil(perfilValido({ rol: "coordinador" }));

    expect(errores).toHaveProperty("rol");
  });

  it("acepta todos los roles del enum", () => {
    for (const rol of Object.values(ROLES)) {
      expect(validarPerfil(perfilValido({ rol }))).toEqual({});
    }
  });

  it("suma sus propias reglas a las de los descriptores", () => {
    const errores = validarPerfil(
      perfilValido({ email: "ana.perez", telefono: "1234", rol: "coordinador" }),
    );

    expect(Object.keys(errores).sort()).toEqual(["email", "rol", "telefono"]);
  });

  it("no valida el formato de un campo opcional que se dejo vacio", () => {
    expect(validarPerfil(perfilValido({ telefono: "" }))).toEqual({});
  });

  it("tolera que no le pasen nada", () => {
    expect(validarPerfil(undefined)).toHaveProperty("nombres");
  });
});

describe("validarCredenciales", () => {
  it("acepta una contrasena que no cumpliria las reglas de fortaleza", () => {
    // A proposito: una contrasena creada antes de la politica actual debe poder iniciar sesion.
    const { correo, errores } = validarCredenciales({
      correo: "ana.perez@ejemplo.org",
      contrasena: "abc",
    });

    expect(correo).toBe("ana.perez@ejemplo.org");
    expect(errores).toEqual({});
  });

  it("pide la contrasena cuando falta, para no gastar una llamada al servidor", () => {
    const { errores } = validarCredenciales({
      correo: "ana.perez@ejemplo.org",
      contrasena: "",
    });

    expect(Object.keys(errores)).toEqual(["contrasena"]);
  });

  it("reporta los dos campos con el formulario vacio", () => {
    expect(Object.keys(validarCredenciales().errores).sort()).toEqual(["contrasena", "email"]);
  });
});
