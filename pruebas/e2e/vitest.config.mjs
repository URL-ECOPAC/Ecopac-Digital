// Configuracion de las pruebas de flujos criticos (issue #222).
//
// Estas NO corren con `npm test`. `npm test` recorre los workspaces y esta carpeta no es uno a
// proposito: las pruebas de packages/shared se ejecutan contra un doble de Supabase y no
// necesitan nada instalado, mientras que estas exigen el stack local levantado. Mezclarlas
// dejaria `npm test` en rojo en cualquier maquina sin Docker. Se corren con `npm run test:e2e`.
//
// POR QUE EN SERIE
//
// packages/shared mantiene UNA sola instancia del cliente de Supabase (api/cliente.js), asi que
// la sesion es un recurso global del proceso: dos archivos en paralelo se robarian el usuario
// conectado a media prueba. fileParallelism en false es lo que lo impide, y no es una limitacion
// del arnes sino de lo que se esta probando -- la aplicacion real tampoco tiene dos sesiones.
//
// El tiempo de espera sube porque cada paso es un viaje de red real contra PostgREST y GoTrue,
// no una llamada a un doble en memoria.

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["**/*.e2e.test.js"],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
