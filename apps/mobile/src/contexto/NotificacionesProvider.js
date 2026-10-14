import { createContext, useContext } from "react";

// Contador de notificaciones sin leer, compartido por las cabeceras de todos los stacks y por
// Ajustes (issue #755). Lo cuenta una sola vez TabsConContador (AppNavigator.js) y lo reparte por
// aqui: si cada cabecera llamara a useContadorNotificaciones por su cuenta, cada stack montado
// consultaria la base cada minuto.
const ContadorDeNotificaciones = createContext({ cantidad: 0 });

export const ContadorDeNotificacionesProvider = ContadorDeNotificaciones.Provider;

export function useCantidadDeNotificaciones() {
  return useContext(ContadorDeNotificaciones).cantidad;
}
