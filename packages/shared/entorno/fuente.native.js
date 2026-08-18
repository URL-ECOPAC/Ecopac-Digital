// Lectura de las variables de entorno en la app movil (Expo / Metro).
//
// NO UNIFICAR con fuente.js. Ver la explicacion completa en ese archivo: cada bundler
// reemplaza una expresion distinta en tiempo de compilacion, y Metro solo reconoce
// process.env.EXPO_PUBLIC_* escrito completo.
//
// El sufijo .native.js es lo que hace que Metro elija este archivo y Vite el otro, sin que
// ninguno de los dos tenga que configurar nada. Documentacion de Expo v57 sobre variables
// de entorno: https://docs.expo.dev/versions/v57.0.0/

import { PLATAFORMAS } from "./reglas.js";

/**
 * Valores crudos de Supabase tal como los expone Expo.
 *
 * Expo incrusta las EXPO_PUBLIC_* al empaquetar, no las lee en tiempo de ejecucion: cambiar
 * el .env obliga a reiniciar Metro con la cache limpia para que el valor nuevo entre.
 */
export function leerFuente() {
  return {
    plataforma: PLATAFORMAS.MOVIL,
    valores: {
      url: process.env.EXPO_PUBLIC_SUPABASE_URL,
      anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    },
  };
}
