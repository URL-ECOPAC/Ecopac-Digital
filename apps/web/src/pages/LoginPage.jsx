import React, { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ESTADOS_DE_RESTAURACION, useInicioSesion } from '@ecopac/shared';
import { useSesionCompartida } from '../contexto/SesionProvider';
import {
  Card,
  ErrorState,
  LoadingState,
  PrimaryButton,
  ScreenContainer,
  TextField,
} from '../components';

export default function LoginPage() {
  const location = useLocation();
  const { estadoRestauracion, haySesion } = useSesionCompartida();

  const rutaPrevia = location.state?.from?.pathname;

  const {
    correo,
    setCorreo,
    contrasena,
    setContrasena,
    erroresDeCampo: erroresDelHook,
    error: errorDelHook,
    enviando,
    handleSubmit: ejecutarLogin,
    destinoPorDefecto,
  } = useInicioSesion({ rutaPrevia });

  // Estado local independiente para alternar la visibilidad de la contraseña
  const [verPassword, setVerPassword] = useState(false);
  const [erroresLocales, setErroresLocales] = useState({});

  if (estadoRestauracion === ESTADOS_DE_RESTAURACION.CARGANDO) {
    return <LoadingState message="Comprobando tu sesión..." />;
  }

  if (haySesion) {
    return <Navigate to={destinoPorDefecto || '/'} replace />;
  }

  const errores = { ...erroresDelHook, ...erroresLocales };

  const ManejarEnvioFormulario = (e) => {
    e.preventDefault();

    const nuevosErrores = {};
    if (!correo?.trim()) {
      nuevosErrores.correo = 'El correo electrónico es requerido.';
    }
    if (!contrasena) {
      nuevosErrores.contrasena = 'La contraseña es requerida.';
    }

    if (Object.keys(nuevosErrores).length > 0) {
      setErroresLocales(nuevosErrores);
      return;
    }

    setErroresLocales({});
    ejecutarLogin(e);
  };

  return (
    <ScreenContainer>
      <Card title="Iniciar sesión">
        {errorDelHook && <ErrorState message={errorDelHook.mensaje || errorDelHook} />}

        <form onSubmit={ManejarEnvioFormulario} noValidate>
          <TextField
            label="Correo electrónico"
            type="email"
            autoComplete="username"
            value={correo}
            onChange={(e) => {
              setCorreo(e.target.value);
              if (erroresLocales.correo) {
                setErroresLocales((prev) => ({ ...prev, correo: null }));
              }
            }}
            error={errores?.correo || errores?.email}
            disabled={enviando}
          />

          <div className="position-relative mb-3">
            <TextField
              label="Contraseña"
              type={verPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={contrasena}
              onChange={(e) => {
                setContrasena(e.target.value);
                if (erroresLocales.contrasena) {
                  setErroresLocales((prev) => ({ ...prev, contrasena: null }));
                }
              }}
              error={errores?.contrasena}
              disabled={enviando}
            />
            <button
              type="button"
              className="btn btn-link btn-sm position-absolute text-decoration-none text-muted"
              style={{
                right: '12px',
                top: errores?.contrasena ? '32px' : '38px',
                zIndex: 5,
                fontSize: '0.85rem',
              }}
              onClick={() => setVerPassword(!verPassword)}
              tabIndex={-1}
            >
              {verPassword ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>

          <div className="mt-4">
            <PrimaryButton
              title={enviando ? 'Entrando...' : 'Entrar'}
              type="submit"
              disabled={enviando}
            />
          </div>
        </form>
      </Card>
    </ScreenContainer>
  );
}