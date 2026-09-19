// Hook de pantalla de la edicion de usuario (issue #107).
//
// El modal vive en /colaboradores (issue #105), abierto desde una fila del listado (Pregunta 1
// del plan de #107, Opcion B: no hay ficha de #184 todavia). El estado, la validacion y la
// llamada al servidor van aca, no en el componente: la pantalla solo dibuja lo que este hook
// le entrega, mismo patron que useAltaUsuario.js (#106).
//
// Alcance reducido a proposito, siguiendo el mismo precedente que useAltaUsuario.js: el
// formulario del prototipo pedia tambien un selector de especialidades, pero
// perfil_especialidad sigue sin ninguna politica RLS de escritura (issue #405) y
// actualizarUsuario() no acepta ese campo (packages/shared/usuarios/api.js). Los campos son los
// del alta (CAMPOS_EDICION_USUARIO, campos.js, issue #840): el correo se ve pero es de solo
// lectura, porque es la cuenta de Supabase Auth y no una columna que actualizarUsuario() cambie.
//
// fechaIngreso/direccion/notas se agregan en la issue #756 (auditoria campo-a-vista):
// actualizarUsuario() ya las aceptaba (CAMPOS_EDITABLES en api.js incluia fechaIngreso desde
// antes; direccion/notas se agregan en el mismo cambio), pero ningun formulario las pedia. Las
// dos ultimas quedaron deliberadamente sin formulario en la migracion 00108 ("por ahora no hay
// formulario que las escriba... hasta que exista ese formulario"): este es ese formulario.

import { useCallback, useState } from "react";

import { actualizarUsuario } from "./api.js";
import { CAMPOS_EDICION_USUARIO } from "./campos.js";

/**
 * Si guardar este perfil tiene que refrescar el de la sesion. Pura y exportada para probarla sin
 * montar el hook.
 *
 * @param {string|undefined} perfilId
 * @param {string|undefined} idSesionActual
 * @returns {boolean}
 */
export function debeRefrescarSesion(perfilId, idSesionActual) {
  return Boolean(perfilId) && perfilId === idSesionActual;
}

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
 * Si el perfil que se edita es el de la sesion, al guardar se llama a `refrescarPerfilPropio()`
 * (el refrescarPerfil de useSesion). Sin eso, quien se editaba a si mismo desde Colaboradores
 * seguia viendo sus datos viejos en la cabecera y en Mi perfil, que leen el perfil de la sesion,
 * hasta recargar la pagina (issue #840). Es lo mismo que ya hacia usePerfilPropio en el otro
 * sentido: las dos pantallas escriben la misma fila de `perfiles`.
 *
 * @param {object} perfil Perfil existente (forma de listarUsuarios()/obtenerPerfil()).
 * @param {{ idSesionActual?: string, refrescarPerfilPropio?: () => Promise<void> }} [sesion]
 * @returns {{
 *   valores: object,
 *   errores: Record<string, string>,
 *   error: object|null,
 *   enviando: boolean,
 *   setCampo: (id: string, valor: unknown) => void,
 *   guardar: () => Promise<{ ok: boolean, perfil?: object|null }>,
 * }}
 */
export function useEdicionUsuario(perfil, { idSesionActual, refrescarPerfilPropio } = {}) {
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
    if (debeRefrescarSesion(perfil.id, idSesionActual)) await refrescarPerfilPropio?.();
    return { ok: true, perfil: resultado.perfil };
  }, [perfil, valores, idSesionActual, refrescarPerfilPropio]);

  return { valores, errores, error, enviando, setCampo, guardar };
}
