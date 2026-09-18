// El corte del bundle por ruta no se deshace sin que nadie se entere (issue #708).
//
// POR QUE ES UNA PRUEBA DE TEXTO. Lo que se protege aqui no es un comportamiento que se pueda
// montar: es la FORMA del import. Una pagina nueva anadida con `import X from "./pages/X"` vuelve a
// meter esa pantalla -y todo lo que arrastre- en el trozo inicial, y no rompe nada visible: las
// pruebas siguen verdes, el build sigue pasando (el aviso de Vite no lo hace fallar) y lo unico que
// cambia es que la web pesa mas. Es el mismo patron por el que la guarda de rol movil se quedo a
// medias durante dos issues: lo que no se comprueba, se deshace.
//
// El mismo criterio que packages/shared/enums.test.js, que tampoco ejecuta nada: lee el arbol.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

const rutaDe = (relativa) => fileURLToPath(new URL(relativa, import.meta.url));

const APP = readFileSync(rutaDe("./App.jsx"), "utf8");
const MAIN_LAYOUT = readFileSync(rutaDe("./components/MainLayout.jsx"), "utf8");

// LoginPage entra estatica a proposito: es la primera pantalla de quien llega sin sesion, y
// descargarla aparte anade un viaje de red justo ahi.
const PAGINAS_ESTATICAS_PERMITIDAS = ["LoginPage"];

function importsEstaticosDePaginas(fuente) {
  return [...fuente.matchAll(/^import\s+(\w+)\s+from\s+"\.\/pages\/[^"]+";$/gm)].map((m) => m[1]);
}

function paginasDiferidas(fuente) {
  return [
    ...fuente.matchAll(/^const\s+(\w+)\s*=\s*lazy\(\(\) => import\("\.\/pages\/[^"]+"\)\);$/gm),
  ].map((m) => m[1]);
}

describe("el bundle sigue cortado por ruta (issue #708)", () => {
  it("ninguna pagina entra por import estatico, salvo la de login", () => {
    const estaticas = importsEstaticosDePaginas(APP);

    expect(estaticas).toEqual(PAGINAS_ESTATICAS_PERMITIDAS);
  });

  it("el resto de las paginas se descargan con lazy()", () => {
    const diferidas = paginasDiferidas(APP);

    // El numero exacto no se fija -una pantalla nueva no tiene por que romper esto-, pero si que
    // sigan siendo la gran mayoria: si alguien convierte una a import estatico, la prueba de arriba
    // lo dice, y si las convierte todas, esta.
    expect(diferidas.length).toBeGreaterThanOrEqual(20);
  });

  it("cada pagina diferida se usa en alguna ruta, y ninguna ruta usa una que no existe", () => {
    const declaradas = new Set([...paginasDiferidas(APP), ...importsEstaticosDePaginas(APP)]);
    const usadas = new Set([...APP.matchAll(/<(\w+Page|ReporteJornada)\b/g)].map((m) => m[1]));

    for (const usada of usadas) {
      expect(declaradas.has(usada), `${usada} se usa sin declararse`).toBe(true);
    }
  });

  it("hay un <Suspense> alrededor del contenido del layout, no solo en las rutas publicas", () => {
    // El sitio importa: alrededor del <Outlet /> del layout, el sidebar y la cabecera no se
    // desmontan al cambiar de modulo. Subirlo a App.jsx haria parpadear la pantalla entera.
    expect(MAIN_LAYOUT).toMatch(/<Suspense[\s\S]{0,200}<Outlet \/>/);
    expect(APP).toMatch(/<Suspense/);
  });
});
