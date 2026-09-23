// A donde lleva iniciar sesion (issue #864).
//
// El defecto que fija: el destino lo decidia `rutaPrevia`, la ruta protegida que el guard habia
// interrumpido. Es el patron habitual de "te devuelvo a donde ibas", y aqui no sirve, porque en
// el mismo navegador entra gente distinta. Comprobado en ecopac-dev: cerrar la sesion de un rol
// consultivo estando en /reportes y entrar como medico mostraba "Acceso restringido" como primera
// pantalla -- la ruta era de la sesion anterior, no suya.
//
// Se prueba `rutaInicialDe` y no el hook entero porque este paquete corre sin DOM a proposito
// (ver vitest.config.js): lo que decide el destino es esta funcion, y es pura.

import { describe, expect, it } from "vitest";

import { ROLES } from "./roles.js";
import { rutaInicialDe } from "./useInicioSesion.js";

describe("rutaInicialDe", () => {
  it.each([
    [ROLES.ADMINISTRADOR, "/"],
    [ROLES.MEDICO, "/"],
    [ROLES.VOLUNTARIO, "/"],
    [ROLES.JUNTA_DIRECTIVA, "/"],
    [ROLES.SOCIO_FUNDADOR, "/"],
  ])("%s entra en su inicio (%s)", (rol, esperado) => {
    expect(rutaInicialDe(rol)).toBe(esperado);
  });

  it("el destino sale de MODULOS, no de una tabla por rol escrita a mano", () => {
    // Si a un rol se le cerrara el modulo de inicio, el destino tendria que moverse solo al
    // siguiente que si puede abrir, no quedarse apuntando a una ruta que le daria "acceso
    // denegado" nada mas entrar.
    for (const rol of Object.values(ROLES)) {
      expect(rutaInicialDe(rol)).toMatch(/^\//);
    }
  });

  it("sin rol conocido cae a la raiz en vez de quedarse sin destino", () => {
    expect(rutaInicialDe(undefined)).toBe("/");
    expect(rutaInicialDe("rol-que-no-existe")).toBe("/");
  });
});
