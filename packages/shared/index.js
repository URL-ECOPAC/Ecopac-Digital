// Punto de entrada unico de la logica compartida entre las apps web y movil.
//
// Regla de la frontera (ver docs/ARQUITECTURA-FRONTEND.md): aqui vive todo lo que no es
// JSX ni estilos — llamadas a Supabase, validaciones, permisos, formateo, descriptores de
// formulario, columnas y filtros, y los hooks de pantalla. Este paquete no puede importar
// react-dom, react-native, react-bootstrap, ni usar document, window o localStorage.

export * from "./navegacion.js";
export * from "./usuarios/index.js";

// Configuracion de entorno: la URL y la llave anonima de Supabase, validadas al arrancar.
export * from "./entorno/index.js";

// Modulos de dominio
export * from "./pacientes/index.js";
export * from "./api/index.js";
export * from "./hooks/index.js";
export * from "./types/index.js";
export * from "./validations/index.js";
