// Hooks reutilizables sin JSX
// - useSesion(): estado de la sesion de autenticacion
// - useExpiracionPorInactividad(): cierre de sesion por inactividad
// - useBusquedaPacientes(): busqueda con retardo y descarte de respuestas obsoletas
// - usePanelDeInicio(): accesos por rol y jornada en curso de la pantalla de inicio
// - Funcionan en React y React Native
export * from "./useSesion.js";
export * from "./useExpiracionPorInactividad.js";
export * from "./useBusquedaPacientes.js";
export * from "./usePanelDeInicio.js";
