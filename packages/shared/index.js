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

// Los enums del dominio, por el mismo motivo y con la misma regla (issue #397): cada valor de
// enum nace aqui una sola vez, y no en el modulo que lo consume.
export * from "./enums.js";

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
export * from "./proyectos/index.js";
export * from "./presupuestos/index.js";
export * from "./reportes/index.js";
export * from "./territorio/index.js";
export * from "./api/index.js";
export * from "./hooks/index.js";
// Sin extension: el archivo es types/index.ts desde el PR #377. Vite resuelve el cambio de
// .js a .ts por su cuenta, pero Metro no, y el barril dejaba de resolver en el movil.
export * from "./types";
export * from "./validations/index.js";

// Aqui habia un desempate explicito de iniciarSesion y cerrarSesion: los dos nombres nacian en
// api/sesion.js y en usuarios/api.js, el barril los recibia por dos estrellas y ESM los excluia
// del namespace por ambiguos (bug #365). La issue #512 borro la copia de usuarios/api.js, asi
// que ya no hay ambiguedad que resolver: los dos llegan por ./api/index.js, que es donde estan
// declarados como puntos de entrada publicos. obtenerPerfil se reexportaba junto a ellos y
// tampoco hace falta: solo se define una vez y llega por ./usuarios/index.js.

export * from "./inventario/index.js";
export * from "./donaciones/index.js";
