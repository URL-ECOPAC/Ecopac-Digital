// Hook de pantalla de la edicion de usuario (issue #107).
//
// El modal vive en /voluntarios (issue #105), abierto desde una fila del listado (Pregunta 1
// del plan de #107, Opcion B: no hay ficha de #184 todavia). El estado, la validacion y la
// llamada al servidor van aca, no en el componente: la pantalla solo dibuja lo que este hook
// le entrega, mismo patron que useAltaUsuario.js (#106).
//
// Alcance reducido a proposito, siguiendo el mismo precedente que useAltaUsuario.js: el
// formulario del prototipo pedia tambien un selector de especialidades, pero
// perfil_especialidad sigue sin ninguna politica RLS de escritura (issue #405) y
// actualizarUsuario() no acepta ese campo (packages/shared/usuarios/api.js). Este hook solo
// maneja los cuatro campos que pide el criterio 1 del issue y que actualizarUsuario() ya
// acepta: nombres, apellidos, telefono, rol.

import { useCallback, useState } from "react";

import { actualizarUsuario } from "./api.js";
import { CAMPOS_USUARIO } from "./campos.js";

/** Ids de CAMPOS_USUARIO que pide el formulario de edicion. En ese orden. */
const IDS_CAMPOS_EDICION = ["nombres", "apellidos", "telefono", "rol"];

/**
 * Subconjunto de CAMPOS_USUARIO para el formulario de edicion.
 *
 * No se repiten aca ni el label ni el tipo ni las opciones: se filtra el descriptor completo,
 * igual que CAMPOS_ALTA_USUARIO en useAltaUsuario.js.
 */
export const CAMPOS_EDICION_USUARIO = CAMPOS_USUARIO.filter((campo) =>
  IDS_CAMPOS_EDICION.includes(campo.id),
);

function valoresDesdePerfil(perfil) {
  return CAMPOS_EDICION_USUARIO.reduce((valores, campo) => {
    valores[campo.id] = perfil?.[campo.id] ?? campo.valorPorDefecto ?? "";
    return valores;
  }, {});
}

/**
 * Estado y envio del formulario de edicion de un perfil existente.
 *
 * A diferencia de useAltaUsuario(), no arranca vacio: precarga `valores` desde el `perfil` que
 * recibe. Quien llama tiene que montar un componente nuevo por cada perfil que se edite (por
 * ejemplo con `key={perfil.id}` en quien lo renderiza), porque los valores iniciales solo se
 * leen una vez, al crear el estado.
 *
 * `guardar()` no llama al servidor si `actualizarUsuario()` encuentra campos invalidos: la
 * validacion corre en el cliente antes de gastar la llamada de red, mismo criterio que
 * useAltaUsuario.js.
 *
 * @param {object} perfil Perfil existente (forma de listarUsuarios()/obtenerPerfil()).
 * @returns {{
 *   valores: object,
 *   errores: Record<string, string>,
 *   error: object|null,
 *   enviando: boolean,
 *   setCampo: (id: string, valor: unknown) => void,
 *   guardar: () => Promise<{ ok: boolean, perfil?: object|null }>,
 * }}
 */
export function useEdicionUsuario(perfil) {
  const [valores, setValores] = useState(() => valoresDesdePerfil(perfil));
  const [errores, setErrores] = useState({});
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const setCampo = useCallback((id, valor) => {
    setValores((anteriores) => ({ ...anteriores, [id]: valor }));
    // Se limpia el error de ESE campo al tocarlo, no todos, mismo criterio que useAltaUsuario.js.
    setErrores((anteriores) => {
      if (!(id in anteriores)) return anteriores;
      return Object.fromEntries(Object.entries(anteriores).filter(([clave]) => clave !== id));
    });
  }, []);

  const guardar = useCallback(async () => {
    if (!perfil?.id) return { ok: false };

    setEnviando(true);
    const resultado = await actualizarUsuario(perfil.id, valores);
    setEnviando(false);

    setErrores(resultado.errores ?? {});
    setError(resultado.error);

    if (resultado.error) return { ok: false };
    return { ok: true, perfil: resultado.perfil };
  }, [perfil, valores]);

  return { valores, errores, error, enviando, setCampo, guardar };
}
