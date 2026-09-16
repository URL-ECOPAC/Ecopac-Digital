// Pruebas de los tokens de radio y elevacion (issue #660).
//
// No comprueban que "se vea bien" -- eso no se automatiza -- sino el contrato que las dos apps
// consumen: que existan las claves que theme.js publica como variables CSS y que las de movil
// tengan la forma que React Native entiende. Un token que cambie de forma rompe una plataforma
// en silencio, porque en la web una variable CSS indefinida simplemente no pinta nada.

import { describe, expect, it } from "vitest";

import { colors, radii, shadows, statusColors, typography } from "./index.js";

describe("typography", () => {
  it("movil sigue usando el nombre que entiende React Native", () => {
    expect(typography.fontFamilyBase).toBe("System");
  });

  it("la web usa la letra del sistema, sin fuentes descargadas", () => {
    expect(typography.fontFamilyWeb.startsWith("system-ui")).toBe(true);
    expect(typography.fontFamilyWeb.endsWith("sans-serif")).toBe(true);
  });

  it("la monoespaciada termina en la generica, por si no hay ninguna de la lista", () => {
    expect(typography.fontFamilyMonoWeb.endsWith("monospace")).toBe(true);
  });
});
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

// Contrato de la paleta (issue #700).
//
// POR QUE VALOR POR VALOR, Y NO "que existan las claves"
//
// La migracion de los colores escritos a mano toca 31 archivos de las dos apps, y las apps no
// tienen ninguna prueba que detecte una regresion visual: un token mal escrito cambia el color de
// una pantalla entera y nada lo dice. Esta prueba es el ancla de la red: fija el valor exacto de
// cada token, de modo que el dia que alguien lo toque -por descuido o a proposito- la prueba
// nombre el que se movio. No afirma que el color sea "bonito" ni que coincida con el prototipo:
// afirma que no cambio sin que nadie lo decidiera.
//
// Si el cambio es deliberado -corregir un token contra el prototipo de Figma, que es quien manda
// para color segun docs/DISENO.md- se actualiza aqui en el mismo PR, y el diff de esta prueba es
// la lista de lo que cambio de aspecto.
describe("contrato de la paleta", () => {
  it("cada color de marca conserva su valor", () => {
    expect(colors).toMatchObject({
      primary: "#3DB648",
      primaryDark: "#1E7A28",
      primaryLight: "#2D9E3A",
      secondary: "#4D4D4D",
      danger: "#E91E8C",
      warning: "#F7941D",
      success: "#3DB648",
      info: "#29ABE2",
      background: "#F7F8FA",
      surface: "#FFFFFF",
      border: "#E2E4E9",
      text: "#2D2D2D",
      textMuted: "#7A7A8A",
    });
  });

  it("ningun color queda fuera del contrato", () => {
    // Si se agrega un token nuevo, esta prueba obliga a declararlo arriba con su valor.
    expect(Object.keys(colors).sort()).toEqual([
      "background",
      "border",
      "danger",
      "info",
      "primary",
      "primaryDark",
      "primaryLight",
      "secondary",
      "success",
      "surface",
      "text",
      "textMuted",
      "warning",
    ]);
  });

  it("el color de cada estado sale de la paleta, no de un valor suelto", () => {
    const deLaPaleta = new Set(Object.values(colors));
    const fuera = Object.entries(statusColors).filter(([, v]) => !deLaPaleta.has(v));

    expect(fuera).toEqual([]);
  });
});
