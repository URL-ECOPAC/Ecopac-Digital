import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ESTADOS_DE_RESTAURACION, iniciarSesion } from '@ecopac/shared';
import { useSesionCompartida } from '../contexto/SesionProvider';
import {
  Card,
  ErrorState,
  LoadingState,
  PrimaryButton,
  ScreenContainer,
  TextField,
} from '../components';

/**
 * FORMULARIO PROVISIONAL. La pantalla de inicio de sesion es la issue #100 y va con el diseno
 * del prototipo, recuperacion de contrasena y todo lo demas.
 *
 * Este formulario existe solo porque #52 conecto el guard de rutas: sin una forma de entrar, la
 * web quedaria inaccesible en local hasta que #100 se mergee. Quien tome #100 debe REEMPLAZARLO
 * entero, no partir de aqui.
 *
 * Ruta publica: queda fuera del layout autenticado, asi que trae su propio contenedor.
 */
export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { estadoRestauracion, haySesion } = useSesionCompartida();

  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [erroresDeCampo, setErroresDeCampo] = useState({});
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  // A donde queria ir antes de que el guard lo mandara aqui. Es lo que cierra el criterio de
  // "conservando el destino original": entrar devuelve a esa ruta y no siempre al inicio.
  const destino = location.state?.from?.pathname ?? '/';

  if (estadoRestauracion === ESTADOS_DE_RESTAURACION.CARGANDO) {
    return <LoadingState message="Comprobando tu sesion..." />;
  }

  // Ya hay sesion: no tiene sentido volver al formulario estando dentro.
  if (haySesion) {
    return <Navigate to={destino} replace />;
  }

  const enviar = async (evento) => {
    evento.preventDefault();
    setEnviando(true);
    setError(null);
    setErroresDeCampo({});

    const resultado = await iniciarSesion(correo, contrasena);

    setEnviando(false);
    setErroresDeCampo(resultado.erroresDeCampo ?? {});
    setError(resultado.error ?? null);

    if (resultado.sesion) navigate(destino, { replace: true });
  };

  return (
    <ScreenContainer>
      <Card title="Iniciar sesion">
        {error && <ErrorState message={error.mensaje} />}

        <form onSubmit={enviar}>
          <TextField
            label="Correo electronico"
            type="email"
            autoComplete="username"
            value={correo}
            onChange={(evento) => setCorreo(evento.target.value)}
            error={erroresDeCampo.email}
          />
          <TextField
            label="Contrasena"
            type="password"
            autoComplete="current-password"
            value={contrasena}
            onChange={(evento) => setContrasena(evento.target.value)}
            error={erroresDeCampo.contrasena}
          />
          <PrimaryButton title="Entrar" type="submit" loading={enviando} />
        </form>
      </Card>
    </ScreenContainer>
  );
}
