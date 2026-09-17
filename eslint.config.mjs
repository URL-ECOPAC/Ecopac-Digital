import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

/**
 * Las dos formas que convierten un contrato roto en una pantalla que miente (issue #821).
 *
 * La ficha del paciente en movil estuvo rota de punta a punta con el CI entero en verde, y lo que
 * lo hizo posible fue esto (issue #818):
 *
 *   const lista = Array.isArray(respuesta) ? respuesta : respuesta?.datos || [];
 *
 * `obtenerTriajes()` devuelve `{ triajes, error }`. Con el ternario, `lista` era `[]` siempre, sin
 * excepcion y sin log. Y esta otra sustituia un hook que no existia por uno falso:
 *
 *   const useCondiciones = typeof useCondicionesCronicas === "function"
 *     ? useCondicionesCronicas
 *     : () => ({ condiciones: [] });
 *
 * Los dos selectores estan acotados a esa forma y no al idioma legitimo que se le parece.
 * `Array.isArray(value) ? value : []` -poner un arreglo por defecto a una prop- es correcto y hay
 * trece en apps/: lo que se prohibe es que la rama alternativa vuelva a hurgar en el mismo valor,
 * porque eso ya es adivinar la forma en vez de conocerla. Igual con `typeof x === "function"`: la
 * pregunta esta bien para una callback opcional, y mal cuando la alternativa es fabricar una
 * implementacion de mentira.
 */
const REGLAS_CONTRA_CONTRATOS_ADIVINADOS = {
  "no-restricted-syntax": [
    "error",
    {
      selector:
        "ConditionalExpression[test.callee.object.name='Array'][test.callee.property.name='isArray'][alternate.type=/^(MemberExpression|ChainExpression|LogicalExpression)$/]",
      message:
        "Esto no pone un valor por defecto: adivina la forma de la respuesta. Si no sabes si viene un arreglo o un sobre, leelo en el api.js del modulo y usa la clave que devuelve. Un contrato que cambia tiene que reventar, no degradar a vacio (issue #821).",
    },
    {
      selector:
        "ConditionalExpression[test.left.operator='typeof'][test.right.value='function'][alternate.type=/^(ArrowFunctionExpression|FunctionExpression)$/]",
      message:
        "Sustituir por una implementacion de mentira lo que quiza no existe deja la pantalla vacia para siempre y el CI en verde. Importa lo que existe; si falta, que el import reviente (issue #821).",
    },
  ],
};

export default [
  js.configs.recommended,
  {
    ignores: [
      "**/dist/**",
      "**/build/**",
      "**/.expo/**",
      "**/node_modules/**",
      "**/coverage/**",
      "scripts/**",
    ],
  },
  {
    files: ["**/*.{js,jsx}"],
    plugins: {
      react,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        console: "readonly",
        process: "readonly",
        __dirname: "readonly",
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react/jsx-uses-vars": "error",
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  {
    // vitest.setup.js/vitest.react-patch.setup.js/vitest.react-loader.mjs (apps/web) no son
    // "*.config.*", pero corren en el mismo contexto de Node que un archivo de config: los
    // globals de browser no les sirven y si les faltaran los de Node.
    files: [
      "**/*.config.js",
      "**/*.config.mjs",
      "eslint.config.mjs",
      "eslint.config.js",
      "**/vitest.setup.js",
      "**/vitest.react-patch.setup.js",
      "**/vitest.react-loader.mjs",
    ],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    // Las pruebas de apps/mobile corren con jest-expo y no con vitest (issue #702, la decision
    // esta razonada en apps/mobile/jest.config.js y en docs/CI-CD.md). vitest inyecta sus globals
    // solo donde se importan; Jest los pone en el ambiente, asi que hay que declararlos aqui o
    // `describe`, `it`, `expect` y `jest` salen como no-undef.
    files: ["apps/mobile/**/*.test.{js,jsx}"],
    languageOptions: {
      globals: { ...globals.jest, ...globals.node },
    },
  },
  // ================================================================================
  // Guardas de la frontera de la arquitectura (issue #282)
  // ================================================================================
  // La regla completa esta en docs/ARQUITECTURA-FRONTEND.md. Hasta ahora dependia de que ocho
  // personas la recordaran; esto la hace fallar en el lint.
  //
  // Cada mensaje dice DONDE va el codigo en su lugar, no solo que esta prohibido: quien se topa
  // con la regla suele estar resolviendo un problema real y necesita la alternativa, no un no.
  //
  // Los patrones de `files` se resuelven contra el directorio de ESTE archivo, no contra el
  // directorio desde donde se invoca eslint. Importa, porque `npm run lint` corre `eslint .`
  // dentro de cada workspace: sin eso, estas reglas no se aplicarian al correr el lint de verdad.
  {
    // {js,jsx} cubre el paquete entero porque en packages/shared no hay TypeScript: es la
    // decision A de la issue #493. No se agrega .ts al glob a proposito -el parser por defecto no
    // entiende esa sintaxis y fallaria con errores que no tienen que ver con la frontera-, asi
    // que un .ts aqui volveria a quedar fuera de estas reglas, entrando sin que nadie lo diga.
    // Lo que impide que eso pase es la prueba packages/shared/typescript.test.js.
    files: ["packages/shared/**/*.{js,jsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "react-dom",
              message:
                "packages/shared no puede depender del DOM. Lo que necesita react-dom va en apps/web.",
            },
            {
              name: "react-native",
              message:
                "packages/shared no puede depender de React Native. Lo que necesita react-native va en apps/mobile.",
            },
            {
              name: "react-bootstrap",
              message:
                "packages/shared no dibuja: no devuelve JSX ni usa librerias de componentes. Los componentes de react-bootstrap van en apps/web.",
            },
            {
              name: "react-router-dom",
              message:
                "react-router-dom es solo de web, y el movil navega con react-navigation. Un hook compartido devuelve A DONDE hay que ir; quien navega es la pantalla de cada app.",
            },
          ],
          patterns: [
            {
              group: [
                "react-native/*",
                "react-native-*",
                "@react-native-async-storage/*",
                "react-dom/*",
                "react-router-dom/*",
                "react-router",
              ],
              message:
                "packages/shared no puede depender de una plataforma concreta. Si hace falta algo del dispositivo, entra por parametro desde la app (ver el adaptador de almacenamiento de sesion, api/almacenamiento.js).",
            },
          ],
        },
      ],
      // El almacenamiento de sesion ya tiene su adaptador por plataforma (api/almacenamiento.js):
      // leer localStorage o AsyncStorage desde aqui rompe la app que no lo tiene.
      "no-restricted-globals": [
        "error",
        {
          name: "window",
          message:
            "packages/shared corre tambien en React Native, donde no hay window. Lo que dependa del navegador entra por parametro desde apps/web.",
        },
        {
          name: "document",
          message:
            "packages/shared no toca el DOM. Lo que necesite document va en un componente de apps/web.",
        },
        {
          name: "localStorage",
          message:
            "Usa el adaptador de almacenamiento de packages/shared/api/almacenamiento.js, que resuelve localStorage o AsyncStorage segun la plataforma.",
        },
        {
          name: "sessionStorage",
          message:
            "Usa el adaptador de almacenamiento de packages/shared/api/almacenamiento.js: sessionStorage no existe en React Native.",
        },
        {
          name: "AsyncStorage",
          message:
            "Usa el adaptador de almacenamiento de packages/shared/api/almacenamiento.js en vez de AsyncStorage directo.",
        },
        {
          name: "navigator",
          message:
            "navigator no significa lo mismo en web y en React Native. Lo que dependa del dispositivo entra por parametro desde la app.",
        },
      ],
    },
  },
  {
    // __DEV__ es un global que inyecta React Native/Metro en tiempo de ejecucion, no un import:
    // la restriccion de plataforma de mas arriba no lo alcanza. Solo lo necesitan los archivos
    // .native.js, que ya son el punto de entrada deliberado de lo especifico de movil dentro de
    // packages/shared (ver packages/shared/entorno/fuente.native.js).
    files: ["**/*.native.js"],
    languageOptions: {
      globals: {
        __DEV__: "readonly",
      },
    },
  },
  // Un solo `no-restricted-imports` por app, y no dos bloques separados: ESLint NO fusiona las
  // opciones de una misma regla entre bloques de configuracion -- gana el ultimo que la declare.
  // Con la prohibicion de Supabase en un bloque y la de imports cruzados en otro, la segunda
  // borraba a la primera y el PR habria entrado con esa guarda muerta.
  {
    files: ["apps/web/**/*.{js,jsx}"],
    rules: {
      ...REGLAS_CONTRA_CONTRATOS_ADIVINADOS,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@supabase/supabase-js",
              message:
                "Las apps no hablan con Supabase directamente. El cliente vive en packages/shared/api/cliente.js y las consultas en el api.js de cada modulo de shared.",
            },
          ],
          patterns: [
            {
              group: ["@supabase/supabase-js/*"],
              message:
                "Las apps no hablan con Supabase directamente: usa packages/shared/api/cliente.js.",
            },
            {
              group: ["**/apps/mobile/**", "**/mobile/src/**"],
              message:
                "apps/web no importa de apps/mobile. Las dos implementan el mismo catalogo de componentes con las mismas props; lo que sea comun va en packages/shared o en packages/ui-tokens.",
            },
            {
              group: ["**/packages/shared/**", "**/packages/ui-tokens/**"],
              message:
                "Importa por @ecopac/shared y @ecopac/ui-tokens, no por ruta relativa (issue #700). Una ruta relativa se salta el barril, y lo que ningun barril reexporta vite build no lo compila: un error ahi no aparece hasta que alguien conecta la pantalla. Si lo que necesitas no sale del barril, agregalo al index.js de su modulo.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["apps/mobile/**/*.{js,jsx}"],
    rules: {
      ...REGLAS_CONTRA_CONTRATOS_ADIVINADOS,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@supabase/supabase-js",
              message:
                "Las apps no hablan con Supabase directamente. El cliente vive en packages/shared/api/cliente.js y las consultas en el api.js de cada modulo de shared.",
            },
          ],
          patterns: [
            {
              group: ["@supabase/supabase-js/*"],
              message:
                "Las apps no hablan con Supabase directamente: usa packages/shared/api/cliente.js.",
            },
            {
              group: ["**/apps/web/**", "**/web/src/**"],
              message:
                "apps/mobile no importa de apps/web. Las dos implementan el mismo catalogo de componentes con las mismas props; lo que sea comun va en packages/shared o en packages/ui-tokens.",
            },
            {
              group: ["**/packages/shared/**", "**/packages/ui-tokens/**"],
              message:
                "Importa por @ecopac/shared y @ecopac/ui-tokens, no por ruta relativa (issue #700). Una ruta relativa se salta el barril, y lo que ningun barril reexporta vite build no lo compila: un error ahi no aparece hasta que alguien conecta la pantalla. Si lo que necesitas no sale del barril, agregalo al index.js de su modulo.",
            },
          ],
        },
      ],
    },
  },
];
