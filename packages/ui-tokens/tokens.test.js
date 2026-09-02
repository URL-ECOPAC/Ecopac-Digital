// Pruebas de los tokens de radio y elevacion (issue #660).
//
// No comprueban que "se vea bien" -- eso no se automatiza -- sino el contrato que las dos apps
// consumen: que existan las claves que theme.js publica como variables CSS y que las de movil
// tengan la forma que React Native entiende. Un token que cambie de forma rompe una plataforma
// en silencio, porque en la web una variable CSS indefinida simplemente no pinta nada.

import { describe, expect, it } from "vitest";

import { radii, shadows } from "./index.js";
import tokens from "./index.js";

describe("radii", () => {
  it("declara las cuatro escalas que consumen las dos apps", () => {
    expect(Object.keys(radii)).toEqual(["sm", "md", "lg", "pill"]);
  });

  it("son numeros en pixeles, porque React Native no entiende rem", () => {
    for (const valor of Object.values(radii)) {
      expect(typeof valor).toBe("number");
    }
  });

  it("la escala crece de menor a mayor", () => {
    expect(radii.sm).toBeLessThan(radii.md);
    expect(radii.md).toBeLessThan(radii.lg);
  });

  // Un 50% deforma la curva en una elipse sobre un elemento mas ancho que alto; un valor grande
  // da la capsula correcta a cualquier ancho.
  it("pill es lo bastante grande para redondear cualquier ancho", () => {
    expect(radii.pill).toBeGreaterThanOrEqual(999);
  });
});

describe("shadows", () => {
  it("cada elevacion trae su forma para las dos plataformas", () => {
    for (const [nombre, elevacion] of Object.entries(shadows)) {
      expect(typeof elevacion.web, `${nombre}.web`).toBe("string");
      expect(typeof elevacion.movil, `${nombre}.movil`).toBe("object");
    }
  });

  it("la forma de movil trae lo que necesitan iOS y Android", () => {
    for (const [nombre, elevacion] of Object.entries(shadows)) {
      // iOS pinta con shadow*; Android ignora esas y usa elevation.
      expect(elevacion.movil, nombre).toHaveProperty("shadowColor");
      expect(elevacion.movil, nombre).toHaveProperty("shadowOpacity");
      expect(elevacion.movil, nombre).toHaveProperty("shadowRadius");
      expect(elevacion.movil, nombre).toHaveProperty("elevation");
    }
  });

  // La interfaz se usa en jornada, a plena luz y en pantallas pequenas: una sombra marcada
  // ensucia mas de lo que separa.
  it("son sutiles a proposito", () => {
    for (const [nombre, elevacion] of Object.entries(shadows)) {
      expect(elevacion.movil.shadowOpacity, nombre).toBeLessThanOrEqual(0.12);
    }
  });

  it("md eleva mas que sm", () => {
    expect(shadows.md.movil.elevation).toBeGreaterThan(shadows.sm.movil.elevation);
  });
});

describe("el export por defecto", () => {
  it("incluye los tokens nuevos, no solo los nombrados", () => {
    expect(tokens.radii).toBe(radii);
    expect(tokens.shadows).toBe(shadows);
  });
});
