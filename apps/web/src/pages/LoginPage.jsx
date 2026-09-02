import { useState } from "react";
import { Navigate, useLocation, Link } from "react-router-dom";
import { ESTADOS_DE_RESTAURACION, useInicioSesion } from "@ecopac/shared";
import { useSesionCompartida } from "../contexto/SesionProvider";
import {
  AuthAlert,
  AuthButton,
  AuthField,
  AuthLayout,
  AuthPasswordToggle,
} from "../components/auth";

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

  const [verPassword, setVerPassword] = useState(false);
  const [erroresLocales, setErroresLocales] = useState({});

  if (estadoRestauracion === ESTADOS_DE_RESTAURACION.CARGANDO) {
    return (
      <div
        style={{
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#F8FAFC",
          color: "#16A34A",
          fontFamily: "sans-serif",
        }}
      >
        Cargando EcoPac...
      </div>
    );
  }

  if (haySesion) {
    return <Navigate to={destinoPorDefecto || "/"} replace />;
  }

  const errores = { ...erroresDelHook, ...erroresLocales };

  const ManejarEnvioFormulario = (e) => {
    e.preventDefault();
    const nuevosErrores = {};
    if (!correo?.trim()) nuevosErrores.correo = "El correo electrónico es requerido.";
    if (!contrasena) nuevosErrores.contrasena = "La contraseña es requerida.";

    if (Object.keys(nuevosErrores).length) {
      setErroresLocales(nuevosErrores);
      return;
    }

    setErroresLocales({});
    ejecutarLogin(e);
  };

  return (
    <AuthLayout title="Iniciar sesión" subtitle="Ingresa a la plataforma de gestión">
      {errorDelHook && (
        <AuthAlert variant="error">{errorDelHook.mensaje || errorDelHook}</AuthAlert>
      )}

      <form
        onSubmit={ManejarEnvioFormulario}
        noValidate
        style={{ display: "flex", flexDirection: "column", gap: "18px" }}
      >
        <AuthField
          label="Correo electrónico"
          type="email"
          autoComplete="username"
          placeholder="ej. usuario@ecopac.org"
          value={correo}
          onChange={(e) => {
            setCorreo(e.target.value);
            if (erroresLocales.correo) setErroresLocales((p) => ({ ...p, correo: null }));
          }}
          error={errores?.correo || errores?.email}
          disabled={enviando}
        />

        <AuthField
          label="Contraseña"
          type={verPassword ? "text" : "password"}
          autoComplete="current-password"
          placeholder="••••••••"
          value={contrasena}
          onChange={(e) => {
            setContrasena(e.target.value);
            if (erroresLocales.contrasena) setErroresLocales((p) => ({ ...p, contrasena: null }));
          }}
          error={errores?.contrasena}
          disabled={enviando}
          rightAdornment={
            <AuthPasswordToggle
              visible={verPassword}
              onToggle={() => setVerPassword(!verPassword)}
            />
          }
        />

        <div style={{ marginTop: "6px" }}>
          <AuthButton disabled={enviando}>
            {enviando ? "Ingresando..." : "Iniciar Sesión"}
          </AuthButton>
        </div>

        {/* Aqui habia un enlace "¿No tienes cuenta?" hacia /registro. Se quito con la issue
            #508: la ruta no existia en App.jsx, y anunciaba un auto-registro que el servidor
            ahora rechaza. En este sistema las cuentas las crea la administradora. */}
        <div
          style={{
            marginTop: "8px",
            fontSize: "12px",
            textAlign: "center",
            color: "#64748B",
          }}
        >
          <Link
            to="/restablecer-contrasena"
            style={{ color: "#2563EB", textDecoration: "none", fontWeight: "500" }}
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
}
