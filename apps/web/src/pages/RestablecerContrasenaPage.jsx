import { Link } from "react-router-dom";
import { useRestablecerContrasena } from "@ecopac/shared";
import { AuthAlert, AuthButton, AuthField, AuthLayout } from "../components/auth";

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
    <AuthLayout
      title="Restablecer contraseña"
      subtitle="Te enviaremos un enlace para crear una nueva"
    >
      {mensajeExito ? (
        <AuthAlert variant="success">
          Si el correo electrónico existe en nuestro sistema, recibirás un enlace con las
          instrucciones para restablecer tu contraseña.
        </AuthAlert>
      ) : (
        <form
          onSubmit={solicitarRestablecimiento}
          noValidate
          style={{ display: "flex", flexDirection: "column", gap: "18px" }}
        >
          <AuthField
            label="Correo electrónico"
            type="email"
            autoComplete="email"
            placeholder="ej. usuario@ecopac.org"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            error={errorCampo}
            disabled={enviando}
          />

          <div style={{ marginTop: "6px" }}>
            <AuthButton disabled={enviando}>{enviando ? "Enviando..." : "Enviar enlace"}</AuthButton>
          </div>
        </form>
      )}

      <div
        style={{
          marginTop: "20px",
          fontSize: "12px",
          textAlign: "center",
          color: "#64748B",
        }}
      >
        <Link to="/login" style={{ color: "#2563EB", textDecoration: "none", fontWeight: "500" }}>
          Volver al inicio de sesión
        </Link>
      </div>
    </AuthLayout>
  );
}
