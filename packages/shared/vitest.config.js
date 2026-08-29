// Configuracion de pruebas de packages/shared.
//
// environment "node" y no jsdom a proposito: este paquete no puede tocar document, window,
// localStorage ni AsyncStorage (regla de la frontera en docs/ARQUITECTURA-FRONTEND.md). Si
// una prueba de aqui necesitara un DOM, lo que esta mal es el codigo bajo prueba, no el
// entorno de la prueba.
//
// Sin globals: cada archivo importa describe, it y expect desde "vitest". Con globals el
// linter marcaria describe e it como no definidos y habria que inventar excepciones en
// eslint.config.mjs para algo que un import de una linea ya resuelve.

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["**/*.test.js"],
    exclude: ["**/node_modules/**"],

    // Guarda de cobertura de las validaciones (issue #219).
    //
    // POR QUE SOLO LAS VALIDACIONES
    //
    // Las validaciones son las reglas de negocio del sistema -vencimiento de medicamentos,
    // disponibilidad de stock, jornada activa, rangos de signos vitales, datos de paciente-, y
    // son lo unico de shared que se puede probar entero sin base de datos ni dobles. Las capas
    // de API se prueban contra un doble escrito a mano y su cobertura mide otra cosa; incluirlas
    // aqui pondria el CI en rojo por codigo que la issue #219 no reclama.
    //
    // POR QUE ESTOS NUMEROS
    //
    // Son el suelo medido el 29 de agosto de 2026, redondeado hacia abajo, no una aspiracion.
    // Una guarda es un trinquete: existe para que no se baje de donde ya se esta. Poner un
    // numero por encima de lo real solo deja el CI en rojo el primer dia.
    //
    // **El umbral solo sube.** Quien mejore la cobertura sube el suelo en el mismo PR; quien la
    // baje tiene que explicar por que en la descripcion, no bajar el numero en silencio.
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["**/validaciones.js", "**/*.validaciones.js", "validations/index.js"],
      thresholds: {
        statements: 97,
        branches: 94,
        functions: 100,
        lines: 98,
      },
    },
  },
});
