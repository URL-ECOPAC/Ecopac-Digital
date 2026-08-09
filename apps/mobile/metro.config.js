// Metro (el bundler de Expo/React Native) no resuelve workspaces de npm por defecto,
// a diferencia de Vite. Este archivo le dice explícitamente dónde buscar los paquetes
// compartidos del monorepo (packages/shared y packages/ui-tokens).
//

const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

// Raíz del monorepo (dos niveles arriba de apps/mobile).
const monorepoRoot = path.resolve(__dirname, "../..");
const projectRoot = __dirname;

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
