// Lectura de las variables de entorno en la app MOVIL abierta en el navegador (Expo web / Metro).
//
// POR QUE EXISTE. El import de la fuente va sin extension (entorno/index.js) y cada bundler elige
// el archivo por plataforma. Metro en Android e iOS toma fuente.native.js, pero al abrir la app
// movil en el navegador -`npm run dev:mobile` y la tecla "w", o http://localhost:8081- Metro
// empaqueta para la plataforma "web", que no reconoce `.native.js`: caia en fuente.js, el de Vite,
// y ahi `import.meta.env` no existe en Metro. La app arrancaba con
//
//   Supabase no se inicializo: ... Cannot read properties of undefined (reading 'DEV')
//
// y sin datos. Metro web prefiere `.web.js` sobre `.js`, asi que este archivo gana ahi. Vite no lo
// ve: no incluye `.web.js` en sus extensiones, y la web sigue usando fuente.js.
//
// Es la app movil, aunque corra en un navegador: lee las EXPO_PUBLIC_* (las incrusta el preset de
// Babel de Expo tambien en web) y se declara plataforma movil, con las mismas reglas que en el
// telefono. NO UNIFICAR con fuente.js ni con fuente.native.js: ver la explicacion en fuente.js.

import { PLATAFORMAS } from "./reglas.js";

export function leerFuente() {
  return {
    plataforma: PLATAFORMAS.MOVIL,
    // __DEV__ tambien lo define Metro al empaquetar para web.
    esDesarrollo: typeof __DEV__ !== "undefined" && __DEV__,
    valores: {
      url: process.env.EXPO_PUBLIC_SUPABASE_URL,
      anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    },
  };
}
