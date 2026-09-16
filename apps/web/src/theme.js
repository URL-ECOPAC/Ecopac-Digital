import {
  colors,
  spacing,
  moduleAccents,
  radii,
  shadows,
  statusColors,
  typography,
} from "@ecopac/ui-tokens";

// Publica los tokens de diseno como custom properties de CSS.
//
// Antes los valores estaban escritos a mano en index.css, asi que cambiar la paleta obligaba
// a tocar dos archivos y los dos quedaron desincronizados. Ahora index.css solo consume
// var(--color-*) y el unico lugar donde vive un color es packages/ui-tokens.

const kebab = (nombre) => nombre.replace(/[A-Z]/g, (letra) => `-${letra.toLowerCase()}`);

export function aplicarTokens(elemento = document.documentElement) {
  for (const [nombre, valor] of Object.entries(colors)) {
    elemento.style.setProperty(`--color-${kebab(nombre)}`, valor);
  }

  for (const [nombre, valor] of Object.entries(spacing)) {
    elemento.style.setProperty(`--spacing-${nombre}`, `${valor}px`);
  }

  for (const [modulo, valor] of Object.entries(moduleAccents)) {
    elemento.style.setProperty(`--accent-${modulo}`, valor);
  }

  for (const [nombre, valor] of Object.entries(radii)) {
    elemento.style.setProperty(`--radio-${nombre}`, `${valor}px`);
  }

  // De cada elevacion solo viaja su forma web: la de movil son propiedades de React Native.
  for (const [nombre, valor] of Object.entries(shadows)) {
    elemento.style.setProperty(`--sombra-${nombre}`, valor.web);
  }

  // Una sola familia para toda la web. index.css la cuelga de las variables de Bootstrap, asi que
  // ninguna pantalla necesita declarar font-family.
  elemento.style.setProperty("--fuente-base", typography.fontFamilyWeb);
  elemento.style.setProperty("--fuente-mono", typography.fontFamilyMonoWeb);

  // Tamanos y pesos, que hasta ahora no viajaban. Sin ellos una pantalla que necesitaba un
  // rotulo pequeno no tenia mas remedio que escribir "11px" a mano, y eso es exactamente lo que
  // hicieron InventarioPage (11px/28px en linea), reportes.css (0.875rem/1.75rem) y
  // pacientes.css (0.6875rem): tres escalas tipograficas distintas para el mismo rol de texto.
  //
  // En rem y no en px: el tamano base del navegador es una preferencia de accesibilidad, y una
  // interfaz que se lee en exteriores es justo donde alguien la sube. El token sigue siendo un
  // numero de pixeles -React Native no entiende rem- y la conversion ocurre aqui, que es la
  // frontera de la web.
  for (const [nombre, valor] of Object.entries(typography.sizes)) {
    elemento.style.setProperty(`--texto-${nombre}`, `${valor / 16}rem`);
  }

  for (const [nombre, valor] of Object.entries(typography.weights)) {
    elemento.style.setProperty(`--peso-${nombre}`, valor);
  }

  // Las claves de estado vienen de los enum de la base de datos y llevan espacios.
  for (const [estado, valor] of Object.entries(statusColors)) {
    elemento.style.setProperty(`--estado-${estado.replace(/ /g, "-")}`, valor);
  }
}
