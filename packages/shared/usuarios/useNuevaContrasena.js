import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase/client';

export function useNuevaContrasena() {
  const navigate = useNavigate();
  const [contrasena, setContrasena] = useState('');
  const [confirmarContrasena, setConfirmarContrasena] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [errorGlobal, setErrorGlobal] = useState('');
  const [erroresDeCampo, setErroresDeCampo] = useState({});

  const validarFormulario = () => {
    const errores = {};
    // Mismas reglas de validación que el registro de usuario
    if (!contrasena) {
      errores.contrasena = 'La contraseña es requerida.';
    } else if (contrasena.length < 8) {
      errores.contrasena = 'La contraseña debe tener al menos 8 caracteres.';
    }

    if (contrasena !== confirmarContrasena) {
      errores.confirmarContrasena = 'Las contraseñas no coinciden.';
    }

    setErroresDeCampo(errores);
    return Object.keys(errores).length === 0;
  };

  const actualizarContrasena = async (e) => {
    e?.preventDefault();
    if (!validarFormulario()) return;

    setEnviando(true);
    setErrorGlobal('');

    try {
      // Actualiza la contraseña en Supabase Auth (e invalida sesiones anteriores)
      const { error } = await supabase.auth.updateUser({ password: contrasena });

      if (error) throw error;

      // Cerrar sesión tras restablecer para obligar al nuevo ingreso seguro
      await supabase.auth.signOut();
      navigate('/login', { state: { mensaje: 'Contraseña actualizada exitosamente. Inicia sesión.' } });
    } catch (err) {
      setErrorGlobal(err.message || 'El enlace ha caducado o es inválido.');
    } finally {
      setEnviando(false);
    }
  };

  return {
    contrasena,
    setContrasena,
    confirmarContrasena,
    setConfirmarContrasena,
    enviando,
    errorGlobal,
    erroresDeCampo,
    actualizarContrasena,
  };
}