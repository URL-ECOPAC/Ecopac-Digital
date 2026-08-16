import { colors, spacing, moduleAccents, statusColors } from '@ecopac/ui-tokens';

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

  // Las claves de estado vienen de los enum de la base de datos y llevan espacios.
  for (const [estado, valor] of Object.entries(statusColors)) {
    elemento.style.setProperty(`--estado-${estado.replace(/ /g, '-')}`, valor);
  }
}
