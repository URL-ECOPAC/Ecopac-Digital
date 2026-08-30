// Lectura de las variables de entorno en la app web (Vite).
//
// NO UNIFICAR con fuente.native.js. Los dos bundlers inyectan las variables reemplazando
// texto en tiempo de compilacion, y cada uno reconoce una expresion distinta:
//
//   Vite  reemplaza el texto literal  import.meta.env.VITE_SUPABASE_URL
//   Expo  reemplaza el texto literal  process.env.EXPO_PUBLIC_SUPABASE_URL
//
// Un acceso dinamico del tipo variables[nombre] no lo reemplaza ninguno de los dos y llegaria
// vacio al navegador. Por eso cada acceso va escrito completo y el archivo esta partido por
// plataforma: Metro elige fuente.native.js y Vite elige este.

import { PLATAFORMAS } from "./reglas.js";

/**
 * Valores crudos de Supabase tal como los expone Vite.
 *
 * Los accesos se escriben completos, uno por uno y sin encadenamiento opcional, porque Vite
 * sustituye exactamente esa expresion por el valor literal al compilar. Si la variable no
 * esta definida llega como undefined y resolverEntorno la reporta por su nombre exacto.
 */
export function leerFuente() {
  return {
    plataforma: PLATAFORMAS.WEB,
    esDesarrollo: import.meta.env.DEV,
    valores: {
      url: import.meta.env.VITE_SUPABASE_URL,
      anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
  };
}
