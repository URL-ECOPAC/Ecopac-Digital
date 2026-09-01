
import { Link } from "react-router-dom";
import { useRestablecerContrasena } from "@ecopac/shared";
import { Card, PrimaryButton, ScreenContainer, TextField } from "../components";

export default function RestablecerContrasenaPage() {
  const {
    correo,
    setCorreo,
    enviando,
    mensajeExito,
    errorCampo,
    solicitarRestablecimiento,
    // La URL de retorno la arma la app y no el hook: packages/shared no puede tocar `window`
    // (docs/ARQUITECTURA-FRONTEND.md), porque el mismo hook lo consume la app movil.
  } = useRestablecerContrasena({
    urlDeRetorno: `${window.location.origin}/nueva-contrasena`,
  });

  return (
    <ScreenContainer>
      <Card title="Restablecer contraseña">
        {mensajeExito ? (
          <div className="alert alert-success" role="alert">
            Si el correo electrónico existe en nuestro sistema, recibirás un enlace con las
            instrucciones para restablecer tu contraseña.
          </div>
        ) : (
          <form onSubmit={solicitarRestablecimiento} noValidate>
            <p className="text-muted small mb-3">
              Ingresa tu correo electrónico registrado para enviarte un enlace de recuperación.
            </p>

            <TextField
              label="Correo electrónico"
              type="email"
              autoComplete="email"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              error={errorCampo}
              disabled={enviando}
            />

            <div className="mt-4">
              <PrimaryButton
                title={enviando ? "Enviando..." : "Enviar enlace"}
                type="submit"
                disabled={enviando}
              />
            </div>
          </form>
        )}

        <div className="mt-3 text-center">
          <Link to="/login" className="btn btn-link btn-sm text-decoration-none">
            Volver al inicio de sesión
          </Link>
        </div>
      </Card>
    </ScreenContainer>
  );
}
