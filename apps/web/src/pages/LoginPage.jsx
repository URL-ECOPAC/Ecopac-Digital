import { useEffect, useState } from "react";
import { Navigate, useLocation, Link } from "react-router-dom";
import { ESTADOS_DE_RESTAURACION, olvidarUltimaActividad, useInicioSesion } from "@ecopac/shared";
import { almacenamientoWeb } from "../almacenamiento";
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

  const cerradaPorInactividad = location.state?.motivo === "inactividad";
  const mostrandoFormulario = estadoRestauracion !== ESTADOS_DE_RESTAURACION.CARGANDO && !haySesion;

  // Con el formulario a la vista no hay sesion que proteger: se olvida la ultima actividad de la
  // sesion anterior. Sin esto, quien vuelve a entrar despues de que su sesion vencio arrastraria la
  // marca vieja y el temporizador de inactividad lo sacaria en cuanto terminara de entrar.
  useEffect(() => {
    if (mostrandoFormulario) olvidarUltimaActividad(almacenamientoWeb);
  }, [mostrandoFormulario]);

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
      {cerradaPorInactividad && !errorDelHook && (
        <AuthAlert variant="info">
          Tu sesión se cerró por inactividad. Vuelve a iniciar sesión para continuar.
        </AuthAlert>
      )}

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
            fontSize: "var(--texto-xs)",
            textAlign: "center",
            color: "#64748B",
          }}
        >
          <Link
            to="/restablecer-contrasena"
            style={{ color: "#2563EB", textDecoration: "none", fontWeight: "var(--peso-medium)" }}
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
}
