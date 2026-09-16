// Hook de pantalla de la correccion de un triaje ya registrado (issue #756, auditoria
// campo-a-vista).
//
// actualizarTriaje() y puedeCorregirTriaje() (triaje.api.js/permisos.js) ya existian, probados,
// desde antes de esta issue -- lo unico que faltaba era una pantalla que los llamara. Mismo
// patron que useEdicionTurno.js: precarga `valores` desde el triaje que recibe, un componente
// nuevo por cada uno (key={triaje.id} en quien lo renderiza).
//
// El hook en si no se prueba montado (packages/shared corre vitest con environment "node", sin
// DOM): valoresDesdeTriaje() se exporta aparte para poder probarla sin montar nada.

import { useCallback, useState } from "react";

import { CAMPOS_TRIAJE } from "./campos.js";
import { actualizarTriaje } from "./triaje.api.js";

/**
 * Valores del formulario a partir de un triaje existente. `null` para un signo que el triaje no
 * tiene (los seis opcionales de CAMPOS_TRIAJE), no `''`: NumberField ya trabaja con numero o
 * null, igual que useFormularioJornada.js con cupoEstimado.
 *
 * @param {object|null} [triaje] Con los ids de CAMPOS_TRIAJE (forma de un evento de tipo triaje
 *   en useHistorialPaciente.js: `{ id, ...signos }`).
 * @returns {object}
 */
export function valoresDesdeTriaje(triaje) {
  return CAMPOS_TRIAJE.reduce((valores, campo) => {
    valores[campo.id] = triaje?.[campo.id] ?? null;
    return valores;
  }, {});
}

/**
 * @param {object|null} [triaje] Triaje a corregir, con `id`.
 * @returns {{
 *   valores: object,
 *   errores: Record<string, string>,
 *   error: object|null,
 *   enviando: boolean,
 *   setCampo: (id: string, valor: unknown) => void,
 *   guardar: () => Promise<{ ok: boolean, triaje?: object|null }>,
 * }}
 */
export function useCorreccionTriaje(triaje) {
  const [valores, setValores] = useState(() => valoresDesdeTriaje(triaje));
  const [errores, setErrores] = useState({});
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const setCampo = useCallback((id, valor) => {
    setValores((anteriores) => ({ ...anteriores, [id]: valor }));
    // Se limpia el error de ESE campo al tocarlo, no todos, mismo criterio que useEdicionTurno.js.
    setErrores((anteriores) => {
      if (!(id in anteriores)) return anteriores;
      return Object.fromEntries(Object.entries(anteriores).filter(([clave]) => clave !== id));
    });
  }, []);

  const guardar = useCallback(async () => {
    if (!triaje?.id) return { ok: false };

    setEnviando(true);
    setError(null);
    const resultado = await actualizarTriaje(triaje.id, valores);
    setEnviando(false);

    setErrores(resultado.errores ?? {});
    setError(resultado.error);

    if (resultado.error || !resultado.triaje) return { ok: false };
    return { ok: true, triaje: resultado.triaje };
  }, [triaje, valores]);

  return { valores, errores, error, enviando, setCampo, guardar };
}
