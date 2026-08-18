// Metro (el bundler de Expo/React Native) no resuelve workspaces de npm por defecto,
// a diferencia de Vite. Este archivo le dice explícitamente dónde buscar los paquetes
// compartidos del monorepo (packages/shared y packages/ui-tokens).
//

const { getDefaultConfig } = require("expo/metro-config");
const fs = require("fs");
const path = require("path");

// Raíz del monorepo (dos niveles arriba de apps/mobile).
const monorepoRoot = path.resolve(__dirname, "../..");
const projectRoot = __dirname;

// Expo busca los .env en apps/mobile, pero el del monorepo esta en la raiz: es el que
// docs/QUICKSTART.md manda crear. Sin esto, EXPO_PUBLIC_SUPABASE_URL llega vacia al bundle
// y la app arranca sin poder hablar con Supabase.
//
// Se lee aqui porque metro.config.js se carga antes de empaquetar, que es cuando el preset
// de Babel de Expo incrusta las EXPO_PUBLIC_* en el codigo. Lo que ya venga del entorno
// manda: asi el CI y los scripts pueden sobrescribir sin pelear con el archivo.
function cargarEnvDeLaRaiz() {
  const modo = process.env.NODE_ENV === "production" ? "production" : "development";

  for (const archivo of [`.env.${modo}`, ".env"]) {
    const ruta = path.resolve(monorepoRoot, archivo);
    if (!fs.existsSync(ruta)) continue;

    for (const linea of fs.readFileSync(ruta, "utf8").split(/\r?\n/)) {
      const limpia = linea.trim();
      if (limpia === "" || limpia.startsWith("#")) continue;

      const separador = limpia.indexOf("=");
      if (separador === -1) continue;

      const clave = limpia.slice(0, separador).trim();
      // Solo las EXPO_PUBLIC_: son las unicas que la app movil puede usar, y asi no se
      // arrastran al bundle variables pensadas para la web o para el servidor.
      if (!clave.startsWith("EXPO_PUBLIC_") || process.env[clave]) continue;

      const valor = limpia.slice(separador + 1).trim();
      process.env[clave] = valor.replace(/^["']|["']$/g, "");
    }
  }
}

cargarEnvDeLaRaiz();

const config = getDefaultConfig(projectRoot);

// 1. Vigila cambios en todo el monorepo, no solo en apps/mobile.
//    Sin esto, editar un archivo en packages/shared no dispara el hot reload.
config.watchFolders = [monorepoRoot];

// 2. Busca node_modules tanto en apps/mobile como en la raíz del monorepo
//    (los workspaces de npm hoistean dependencias compartidas a la raíz).
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// 3. Evita que Metro resuelva dos copias distintas de React/React Native si
//    quedaron instaladas tanto en la raíz como dentro de apps/mobile.
config.resolver.disableHierarchicalLookup = false;

module.exports = config;
