// Punto de entrada unico de la logica compartida entre las apps web y movil.
//
// Regla de la frontera (ver docs/ARQUITECTURA-FRONTEND.md): aqui vive todo lo que no es
// JSX ni estilos — llamadas a Supabase, validaciones, permisos, formateo, descriptores de
// formulario, columnas y filtros, y los hooks de pantalla. Este paquete no puede importar
// react-dom, react-native, react-bootstrap, ni usar document, window o localStorage.

// Vocabulario de los descriptores. Se exporta desde aqui y no desde cada modulo: un
// nombre que el barril reciba por varias estrellas queda ambiguo y ESM lo excluye
// del namespace, que es lo que rompio la issue #365.
export * from "./descriptores.js";

export * from "./navegacion.js";
export * from "./usuarios/index.js";

// Configuracion de entorno: la URL y la llave anonima de Supabase, validadas al arrancar.
export * from "./entorno/index.js";

// Formateo compartido: fechas y presentacion de datos.
export * from "./formato/index.js";

// Modulos de dominio
export * from "./pacientes/index.js";
export * from "./inventario/index.js";
export * from "./jornadas/index.js";
export * from "./atenciones/index.js";
export * from "./donaciones/index.js";
export * from "./presupuestos/index.js";
export * from "./reportes/index.js";
export * from "./api/index.js";
export * from "./hooks/index.js";
// Sin extension: el archivo es types/index.ts desde el PR #377. Vite resuelve el cambio de
// .js a .ts por su cuenta, pero Metro no, y el barril dejaba de resolver en el movil.
export * from "./types";
export * from "./validations/index.js";

export * from './utils/permisos';
export * from './hooks/usePermisos';

// Desempate explicito de iniciarSesion y cerrarSesion. Los dos nombres nacen en dos archivos
// -api/sesion.js y usuarios/api.js-, asi que el barril los recibe por dos estrellas y ESM los
// excluye del namespace por ambiguos (issue #365). Se resuelven a la version de api/sesion.js,
// que es la que valida las credenciales, normaliza el error, resuelve el perfil y cierra la
// sesion si la cuenta esta desactivada. Unificar las dos implementaciones es trabajo aparte.
export { iniciarSesion, cerrarSesion } from './api/sesion.js';
export { obtenerPerfil } from './usuarios/api.js';

export * from "./inventario/index.js";
export * from "./donaciones/index.js";