// Segundo en la lista de setupFiles, despues de vitest.react-patch.setup.js: para cuando este
// archivo se evalua, "react" ya resuelve consistente, asi que importar testing-library aqui es
// seguro.
//
// globals: false (vitest.config.js) significa que @testing-library/react no detecta un
// afterEach global solo y no registra su limpieza automatica: sin esto, el DOM de un render()
// se queda montado para el siguiente test del mismo archivo.
import { afterEach, expect } from "vitest";
import { cleanup } from "@testing-library/react";
import * as matchersDelDom from "@testing-library/jest-dom/matchers";

expect.extend(matchersDelDom);
afterEach(cleanup);
