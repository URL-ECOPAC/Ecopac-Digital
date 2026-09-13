// Hook de pantalla de la correccion de una consulta ya registrada (issue #756, auditoria
// campo-a-vista).
//
// actualizarConsulta() y puedeCorregirConsulta() (consultas.api.js/permisos.js) ya existian,
// probados, desde antes de esta issue -- lo unico que faltaba era una pantalla que los llamara.
// Mismo patron que useCorreccionTriaje.js: precarga `valores` desde la consulta que recibe, un
// componente nuevo por cada una (key={consulta.id} en quien lo renderiza).
//
// El hook en si no se prueba montado (packages/shared corre vitest con environment "node", sin
// DOM): valoresDesdeConsulta() se exporta aparte para poder probarla sin montar nada.

import { useCallback, useState } from "react";

import { CAMPOS_CORRECCION_CONSULTA } from "./campos.js";
import { actualizarConsulta } from "./consultas.api.js";

/**
 * Valores del formulario a partir de una consulta existente. `''` para un texto ausente: los
 * siete campos son TEXTO_LARGO, y ese es el vacio que espera TextField (a diferencia de
 * useCorreccionTriaje.js, que usa `null` porque sus campos son numericos).
 *
 * @param {object|null} [consulta] Con los ids de CAMPOS_CORRECCION_CONSULTA (forma de un evento
 *   de tipo consulta en useHistorialPaciente.js).
 * @returns {object}
 */
export function valoresDesdeConsulta(consulta) {
  return CAMPOS_CORRECCION_CONSULTA.reduce((valores, campo) => {
    valores[campo.id] = consulta?.[campo.id] ?? "";
    return valores;
  }, {});
}

/**
 * A diferencia de useCorreccionTriaje.js (que envuelve actualizarTriaje(), con validacion por
 * campo), actualizarConsulta() no devuelve errores por campo -- solo `motivo_consulta` vacio se
 * rechaza, como un `error` general, igual que cualquier otro fallo del servidor. Por eso este
 * hook no expone `errores`, para no prometer una validacion campo a campo que la API no hace.
 *
 * @param {object|null} [consulta] Consulta a corregir, con `id`.
 * @returns {{
 *   valores: object,
 *   error: object|null,
 *   enviando: boolean,
 *   setCampo: (id: string, valor: unknown) => void,
 *   guardar: () => Promise<{ ok: boolean, consulta?: object|null }>,
 * }}
 */
export function useCorreccionConsulta(consulta) {
  const [valores, setValores] = useState(() => valoresDesdeConsulta(consulta));
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const setCampo = useCallback((id, valor) => {
    setValores((anteriores) => ({ ...anteriores, [id]: valor }));
  }, []);

  const guardar = useCallback(async () => {
    if (!consulta?.id) return { ok: false };

    setEnviando(true);
    setError(null);
    const resultado = await actualizarConsulta(consulta.id, valores);
    setEnviando(false);

    if (resultado.error) {
      setError(resultado.error);
      return { ok: false };
    }

    return { ok: true, consulta: resultado.consulta };
  }, [consulta, valores]);

  return { valores, error, enviando, setCampo, guardar };
}
