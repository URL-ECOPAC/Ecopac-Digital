// Hooks reutilizables sin JSX
// - useSesion(): estado de la sesion de autenticacion
// - useExpiracionPorInactividad(): cierre de sesion por inactividad
// - useBusquedaPacientes(): busqueda con retardo y descarte de respuestas obsoletas
// - Funcionan en React y React Native
export * from "./useSesion.js";
export * from "./useExpiracionPorInactividad.js";
export * from "./useBusquedaPacientes.js";
