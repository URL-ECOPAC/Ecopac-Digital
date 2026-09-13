// Hook de pantalla del alta de usuario (issue #106).
//
// El modal vive en /colaboradores (issue #105), pero el estado, la validacion y la llamada al
// servidor van aca, no en el componente: la pantalla solo dibuja lo que este hook le entrega.
//
// Alcance reducido a proposito (ver PLAN.md del issue #106): el modal del prototipo pedia
// tambien un selector de especialidades, pero perfil_especialidad no tiene ninguna politica RLS
// de escritura todavia (issue #405) y crearUsuario() ni siquiera envia ese campo al servidor
// (packages/shared/usuarios/api.js). Este hook solo maneja los cinco campos que crearUsuario()
// ya acepta: nombres, apellidos, email, telefono, rol.

import { useCallback, useState } from "react";

import { crearUsuario } from "./api.js";
import { CAMPOS_USUARIO } from "./campos.js";

/** Ids de CAMPOS_USUARIO que pide el modal de alta. En ese orden. */
const IDS_CAMPOS_ALTA = ["nombres", "apellidos", "email", "telefono", "rol"];

/**
 * Subconjunto de CAMPOS_USUARIO para el modal de alta.
 *
 * No se repiten aca ni el label ni el tipo ni las opciones: se filtra el descriptor completo,
 * asi que un cambio en CAMPOS_USUARIO (una etiqueta, una opcion de rol) llega solo hasta este
 * formulario sin tocarlo.
 */
export const CAMPOS_ALTA_USUARIO = CAMPOS_USUARIO.filter((campo) =>
  IDS_CAMPOS_ALTA.includes(campo.id),
);

/**
 * Aviso para quien invito cuando la cuenta se creo pero el correo no salio.
 *
 * invitar-usuario crea la cuenta aunque falle el envio y lo informa en `correoEnviado` (issue
 * #691). Sin este aviso el modal se cerraba como si todo hubiera ido bien y la persona invitada
 * se quedaba esperando un enlace que nunca iba a llegar. Lo mas comun es que el proyecto use el
 * correo integrado de Supabase, que solo entrega a miembros de la organizacion (ver "El correo:
 * por que hace falta SMTP propio" en docs/QUICKSTART.md).
 *
 * @param {object|null} usuario Respuesta de crearUsuario().
 * @returns {string|null} null si el correo salio o si la respuesta no dice nada al respecto.
 */
export function avisoDeCorreoNoEnviado(usuario) {
  if (usuario?.correoEnviado !== false) return null;

  const quien = usuario.email ?? "la persona invitada";
  return (
    `La cuenta de ${quien} quedo creada, pero no se pudo enviar el correo para establecer la ` +
    "contrasena. Hay que revisar el envio de correos del proyecto (SMTP de Supabase); mientras " +
    "tanto la contrasena se puede fijar desde el panel de Supabase."
  );
}

function valoresIniciales() {
  return CAMPOS_ALTA_USUARIO.reduce((valores, campo) => {
    valores[campo.id] = campo.valorPorDefecto ?? "";
    return valores;
  }, {});
}

/**
 * Estado y envio del formulario de alta de usuario.
 *
 * `enviar()` no llama al servidor si `crearUsuario()` encuentra campos invalidos: la validacion
 * corre en el cliente antes de gastar la llamada de red (criterio 1 del issue #106). Cancelar
 * sin enviar nunca toco el servidor, asi que `cancelar()` solo limpia el estado local: no hay
 * ningun registro a medias que deshacer (criterio 5).
 *
 * @returns {{
 *   valores: object,
 *   errores: Record<string, string>,
 *   error: object|null,
 *   enviando: boolean,
 *   setCampo: (id: string, valor: unknown) => void,
 *   enviar: () => Promise<{ ok: boolean, usuario?: object|null, aviso?: string|null }>,
 *   cancelar: () => void,
 * }}
 */
export function useAltaUsuario() {
  const [valores, setValores] = useState(valoresIniciales);
  const [errores, setErrores] = useState({});
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const setCampo = useCallback((id, valor) => {
    setValores((anteriores) => ({ ...anteriores, [id]: valor }));
    // Se limpia el error de ESE campo al tocarlo, no todos: si el correo estaba mal y la
    // persona corrige el telefono, el error del correo debe seguir a la vista.
    setErrores((anteriores) => {
      if (!(id in anteriores)) return anteriores;
      return Object.fromEntries(Object.entries(anteriores).filter(([clave]) => clave !== id));
    });
  }, []);

  const cancelar = useCallback(() => {
    setValores(valoresIniciales());
    setErrores({});
    setError(null);
    setEnviando(false);
  }, []);

  const enviar = useCallback(async () => {
    setEnviando(true);

    const resultado = await crearUsuario(valores);

    setEnviando(false);
    setErrores(resultado.errores ?? {});
    setError(resultado.error);

    if (resultado.error) return { ok: false };

    cancelar();
    return {
      ok: true,
      usuario: resultado.usuario,
      aviso: avisoDeCorreoNoEnviado(resultado.usuario),
    };
  }, [valores, cancelar]);

  return { valores, errores, error, enviando, setCampo, enviar, cancelar };
}
