import { useState } from 'react';
import { supabase } from '../supabase/client';

export function useRestablecerContrasena() {
  const [correo, setCorreo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [mensajeExito, setMensajeExito] = useState(false);
  const [errorCampo, setErrorCampo] = useState('');

  const solicitarRestablecimiento = async (e) => {
    e?.preventDefault();
    if (!correo?.trim()) {
      setErrorCampo('El correo electrónico es requerido.');
      return;
    }

    setEnviando(true);
    setErrorCampo('');

    try {
      // Supabase Auth envía el correo si la cuenta existe
      await supabase.auth.resetPasswordForEmail(correo, {
        redirectTo: `${window.location.origin}/nueva-contrasena`,
      });
    } catch (err) {
      // Se ignora el error explícito de backend para evitar enumeración de usuarios (OWASP A07)
      console.error('Error al solicitar restablecimiento:', err);
    } finally {
      setEnviando(false);
      // Mensaje genérico unificado exista o no la cuenta
      setMensajeExito(true);
    }
  };

  return {
    correo,
    setCorreo,
    enviando,
    mensajeExito,
    errorCampo,
    solicitarRestablecimiento,
  };
}