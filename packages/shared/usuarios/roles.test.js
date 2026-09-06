// Pruebas de roles.js y guarda contra literales de rol mal escritos en apps/ (issue #689).
//
// LA HISTORIA. La issue #598 encontro cuatro hooks de donaciones comparando contra
// `["Administrador", "Junta Directiva", "Socio Fundador"]`, con mayuscula inicial. El enum
// rol_usuario (00001) y este archivo los declaran en minuscula, asi que esas comparaciones
// nunca coincidian: la administradora real quedaba tratada como sin acceso. La #689 encontro el
// mismo defecto otra vez, en direccion contraria -InventarioPage.jsx fijaba
// `rol: "Administrador"` como usuario de prueba, asi que la comparacion tampoco coincidia nunca
// y NADIE podia aprobar ni rechazar un movimiento- mas una tercera instancia en
// inventario/useGestionLotes.js. Dos veces el mismo error de escritura basta para que sea un
// patron, no un accidente aislado: de ahi esta prueba.
//
// QUE HACE. Recorre apps/web/src y apps/mobile/src (no packages/shared: ese arbol ya lo revisa
// enums.test.js con el mismo criterio para el resto de los enums) buscando, linea por linea, un
// literal entre comillas que se parezca a un rol pero este mal escrito, cerca de la palabra
// "rol". La cercania a "rol" es lo que separa una comparacion real (`rol === "Administrador"`)
// de una etiqueta de interfaz que solo comparte la palabra (`etiqueta="Medico"` en un
// comprobante impreso, `"Usuario"` como nombre de persona por defecto): ninguna de esas dos
// tiene "rol" en la misma linea.

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { esAdministrador, esConsultivo, ROLES, TODOS_LOS_ROLES } from "./roles.js";

describe("ROLES / TODOS_LOS_ROLES", () => {
  it("son los cinco valores del enum rol_usuario, en minuscula", () => {
    expect(TODOS_LOS_ROLES).toEqual([
      "administrador",
      "junta directiva",
      "socio fundador",
      "medico",
      "voluntario general",
    ]);
  });

  it("se congela, para que nadie lo mute en caliente", () => {
    expect(Object.isFrozen(ROLES)).toBe(true);
  });
});

describe("esAdministrador", () => {
  it("solo es cierto para el rol administrador exacto", () => {
    expect(esAdministrador(ROLES.ADMINISTRADOR)).toBe(true);
    expect(esAdministrador(ROLES.MEDICO)).toBe(false);
    expect(esAdministrador(ROLES.JUNTA_DIRECTIVA)).toBe(false);
  });

  it("una variante con mayuscula (el defecto de la #598/#689) no cuenta como administrador", () => {
    expect(esAdministrador("Administrador")).toBe(false);
  });

  it("sin rol (undefined/null) no es administrador", () => {
    expect(esAdministrador(undefined)).toBe(false);
    expect(esAdministrador(null)).toBe(false);
  });
});

describe("esConsultivo", () => {
  it("junta directiva y socio fundador, nadie mas", () => {
    expect(esConsultivo(ROLES.JUNTA_DIRECTIVA)).toBe(true);
    expect(esConsultivo(ROLES.SOCIO_FUNDADOR)).toBe(true);
    expect(esConsultivo(ROLES.ADMINISTRADOR)).toBe(false);
  });
});

// --- Auditoria de literales de rol en apps/ ------------------------------------------------

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ_DEL_REPO = join(AQUI, "..", "..", "..");
const CARPETAS_A_REVISAR = ["apps/web/src", "apps/mobile/src"];

/** Variantes con mayuscula que #598 y #689 encontraron escritas a mano en vez del enum real. */
const LITERALES_SOSPECHOSOS = [
  "Administrador",
  "Administradora",
  "Junta Directiva",
  "Socio Fundador",
  "Medico",
  "Médico",
  "Voluntario General",
  "Voluntario",
  "Usuario",
];

const PATRON_LITERAL = new RegExp(`["'](${LITERALES_SOSPECHOSOS.join("|")})["']`);

/** Archivos .js/.jsx bajo `directorio`, sin pruebas ni node_modules. */
function archivosFuente(directorio, encontrados = []) {
  for (const entrada of readdirSync(directorio, { withFileTypes: true })) {
    const ruta = join(directorio, entrada.name);
    if (entrada.isDirectory()) {
      if (entrada.name !== "node_modules") archivosFuente(ruta, encontrados);
    } else if (/\.jsx?$/.test(entrada.name) && !entrada.name.endsWith(".test.js")) {
      encontrados.push(ruta);
    }
  }
  return encontrados;
}

describe("ningun literal de rol en apps/ esta fuera de TODOS_LOS_ROLES", () => {
  it("no hay comparaciones de rol contra un literal mal escrito (issues #598, #689)", () => {
    const archivos = CARPETAS_A_REVISAR.flatMap((carpeta) =>
      archivosFuente(join(RAIZ_DEL_REPO, carpeta)),
    );

    const hallazgos = archivos.flatMap((ruta) => {
      const contenido = readFileSync(ruta, "utf8");
      return (
        contenido
          .split("\n")
          .map((linea, indice) => ({
            archivo: relative(RAIZ_DEL_REPO, ruta),
            numero: indice + 1,
            linea: linea.trim(),
          }))
          // Un comentario puede necesitar citar el literal incorrecto para documentar por que se
          // corrigio (aqui mismo, y en donaciones/permisos.js sobre la #598): eso no es el codigo
          // que compara, asi que no cuenta como hallazgo.
          .filter(({ linea }) => !linea.startsWith("//") && !linea.startsWith("*"))
          .filter(({ linea }) => /rol/i.test(linea) && PATRON_LITERAL.test(linea))
      );
    });

    const detalle = hallazgos.map((h) => `${h.archivo}:${h.numero}: ${h.linea}`).join("\n");
    expect(hallazgos, `\n${detalle}`).toEqual([]);
  });
});
