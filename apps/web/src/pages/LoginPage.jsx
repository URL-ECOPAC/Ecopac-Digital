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
  const { estadoRestauracion, haySesion, error: errorDeSesion } = useSesionCompartida();

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
  } = useInicioSesion();

  const [verPassword, setVerPassword] = useState(false);
  const [erroresLocales, setErroresLocales] = useState({});

  const cerradaPorInactividad = location.state?.motivo === "inactividad";
  // ISSUE #864: NuevaContrasenaPage navega aqui con un mensaje ("tu contrasena quedo guardada")
  // y esta pantalla nunca lo pintaba. Peor desde que se muestra el error de la sesion: como
  // cambiar la contrasena cierra la sesion de recuperacion, lo que se veia era un
  // "Tu sesion expiro" en rojo justo despues de una operacion que salio bien.
  const mensajeDeLaNavegacion = location.state?.mensaje ?? null;
  const mostrandoFormulario = estadoRestauracion !== ESTADOS_DE_RESTAURACION.CARGANDO && !haySesion;

  // ISSUE #864, punto 4. Intentar entrar con una cuenta desactivada no decia NADA: el formulario
  // se vaciaba y volvia a quedar como al principio. La razon es una carrera entre este componente
  // y la sesion compartida:
  //
  //   1. signInWithPassword() acierta -- la contrasena es correcta, lo que esta desactivado es el
  //      perfil, no la cuenta de auth -- y Supabase emite SIGNED_IN.
  //   2. haySesion pasa a true, y el <Navigate> de mas abajo DESMONTA esta pantalla.
  //   3. useSesion termina de evaluar el perfil, lo ve inactivo, cierra la sesion y avisa.
  //   4. Se vuelve a /login, pero con LoginPage montada de nuevo: el error que useInicioSesion
  //      habia guardado se fue con el componente anterior.
  //
  // Se arregla por los dos lados, porque son dos caminos distintos:
  //
  // - Intentar entrar con una cuenta desactivada: lo resuelve el `!enviando` del <Navigate> de
  //   mas abajo, que evita el desmonte. El mensaje es el generico de iniciarSesion() -- "el
  //   correo o la contrasena no son correctos" --, y es a proposito: distinguirlo revelaria que
  //   ese correo existe (OWASP A07, ver packages/shared/api/sesion.js).
  // - Que a alguien lo desactiven CON LA SESION ABIERTA: ahi useSesion cierra la sesion y deja el
  //   aviso especifico en `error`, y esta pantalla nunca lo pintaba. Como ahi ya habia una sesion
  //   valida, no hay nada que enumerar y el mensaje si puede decir la razon.
  //
  // El del formulario gana: es el del intento que la persona acaba de hacer.
  // Precedencia: primero el intento que la persona acaba de hacer, y si no, lo que traiga la
  // navegacion. El error de la sesion es el ultimo recurso, para el caso de a quien desactivan
  // con la sesion abierta -- pero nunca por encima de un mensaje que ya explica que paso.
  const errorAMostrar =
    errorDelHook ?? (mostrandoFormulario && !mensajeDeLaNavegacion ? errorDeSesion : null);

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
          backgroundColor: "var(--color-background)",
          color: "var(--color-success)",
        }}
      >
        Cargando EcoPac...
      </div>
    );
  }

  // `!enviando` es la otra mitad del arreglo del punto 4 (issue #864). Con una cuenta
  // desactivada, signInWithPassword acierta y `haySesion` pasa a true A MITAD del intento; sin
  // esta guarda, ese instante desmonta la pantalla y se pierde el error que iniciarSesion acaba
  // de devolver. Mientras se esta enviando no se navega: o el intento termina bien y se navega un
  // tick despues (cuando `enviando` vuelve a false), o termina mal y el aviso queda a la vista.
  if (haySesion && !enviando) {
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
      {mensajeDeLaNavegacion && !errorAMostrar && (
        <AuthAlert variant="success">{mensajeDeLaNavegacion}</AuthAlert>
      )}

      {cerradaPorInactividad && !errorAMostrar && !mensajeDeLaNavegacion && (
        <AuthAlert variant="info">
          Tu sesión se cerró por inactividad. Vuelve a iniciar sesión para continuar.
        </AuthAlert>
      )}

      {errorAMostrar && (
        <AuthAlert variant="error">{errorAMostrar.mensaje || errorAMostrar}</AuthAlert>
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
            color: "var(--color-text-muted)",
          }}
        >
          <Link
            to="/restablecer-contrasena"
            style={{
              color: "var(--color-info)",
              textDecoration: "none",
              fontWeight: "var(--peso-medium)",
            }}
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
}
