import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { iniciarSesion } from './api'; // Exportado desde el API de auth (#97)
import { ROLES } from './roles';

export function useInicioSesion() {
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [mostrarContrasena, setMostrarContrasena] = useState(false);
  const [errores, setErrores] = useState({});
  const [cargando, setCargando] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState('');

  const navigate = useNavigate();
  const location = useLocation();

  const validar = () => {
    const nuevosErrores = {};
    if (!correo.trim()) nuevosErrores.correo = 'El correo electrónico es obligatorio';
    if (!contrasena) nuevosErrores.contrasena = 'La contraseña es obligatoria';
    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorGeneral('');
    if (!validar()) return;

    setCargando(true);
    try {
      const { usuario, perfil } = await iniciarSesion({ correo, contrasena });

      // Redirección previa si existía intento de abrir una ruta protegida
      const rutaOrigen = location.state?.from?.pathname;
      if (rutaOrigen) {
        navigate(rutaOrigen, { replace: true });
        return;
      }

      // Redirección por rol según aclaración de LisAY22
      const rol = perfil?.rol;
      if (
        rol === ROLES.ADMINISTRADOR ||
        rol === ROLES.JUNTA_DIRECTIVA ||
        rol === ROLES.SOCIO_FUNDADOR
      ) {
        navigate('/dashboard', { replace: true });
      } else if (
        rol === ROLES.MEDICO ||
        rol === ROLES.VOLUNTARIO_GENERAL
      ) {
        navigate('/jornadas-activas', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch (err) {
      // Mensaje genérico para no revelar existencia del correo (Criterio de Aceptación)
      setErrorGeneral('Credenciales inválidas. Verifica tu correo y contraseña.');
    } finally {
      setCargando(false);
    }
  };

  return {
    correo,
    setCorreo,
    contrasena,
    setContrasena,
    mostrarContrasena,
    setMostrarContrasena: () => setMostrarContrasena(!mostrarContrasena),
    errores,
    errorGeneral,
    cargando,
    handleSubmit,
  };
}