// Hook del formulario de alta/edicion del catalogo de diagnosticos (issue #639).
//
// Un solo hook para las dos acciones, a diferencia de useAltaUsuario.js (que solo cubre alta):
// CAMPOS_DIAGNOSTICO es identico en los dos modos y crearDiagnostico()/actualizarDiagnostico()
// (consultas.api.js) ya devuelven la misma forma de error, asi que separarlo en dos hooks solo
// hubiera duplicado el manejo de valores/envio. El modo lo decide `diagnostico`: sin id es alta,
// con id es edicion.

import { useCallback, useEffect, useState } from "react";

import { CAMPOS_DIAGNOSTICO } from "./catalogoDiagnosticos.campos.js";
import { actualizarDiagnostico, crearDiagnostico } from "./consultas.api.js";

function valoresDe(diagnostico) {
  return {
    codigo: diagnostico?.codigo ?? "",
    nombre: diagnostico?.nombre ?? "",
    descripcion: diagnostico?.descripcion ?? "",
  };
}

/**
 * @param {object|null} [diagnostico] El diagnostico a corregir, o null/undefined para dar de alta.
 * @returns {{
 *   campos: object[],
 *   valores: object,
 *   error: object|null,
 *   enviando: boolean,
 *   editando: boolean,
 *   setCampo: (id: string, valor: unknown) => void,
 *   enviar: () => Promise<{ ok: boolean, diagnostico?: object|null }>,
 * }}
 */
export function useFormularioDiagnostico(diagnostico) {
  const [valores, setValores] = useState(() => valoresDe(diagnostico));
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const editando = Boolean(diagnostico?.id);

  // Si se abre el mismo modal para otro diagnostico (o se cierra y se vuelve a abrir para uno
  // nuevo), el formulario arranca con los valores de ese diagnostico, no con los del anterior.
  useEffect(() => {
    setValores(valoresDe(diagnostico));
    setError(null);
  }, [diagnostico]);

  const setCampo = useCallback((id, valor) => {
    setValores((anteriores) => ({ ...anteriores, [id]: valor }));
  }, []);

  const enviar = useCallback(async () => {
    setEnviando(true);
    setError(null);

    const resultado = editando
      ? await actualizarDiagnostico(diagnostico.id, valores)
      : await crearDiagnostico(valores);

    setEnviando(false);
    setError(resultado.error);

    if (resultado.error) return { ok: false };
    return { ok: true, diagnostico: resultado.diagnostico };
  }, [editando, diagnostico, valores]);

  return { campos: CAMPOS_DIAGNOSTICO, valores, error, enviando, editando, setCampo, enviar };
}
