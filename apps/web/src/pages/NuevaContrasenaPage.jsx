import { useEffect, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { establecerSesionDeRecuperacion, useNuevaContrasena } from "@ecopac/shared";
import {
  AuthAlert,
  AuthButton,
  AuthField,
  AuthLayout,
  AuthPasswordToggle,
} from "../components/auth";

export default function NuevaContrasenaPage() {
  const {
    contrasena,
    setContrasena,
    confirmarContrasena,
    setConfirmarContrasena,
    enviando,
    errorGlobal,
    erroresDeCampo,
    exito,
    actualizarContrasena,
  } = useNuevaContrasena();

  // Un estado por campo (issue #864): antes el segundo campo compartia el del primero, asi que
  // no se podia ver solo la confirmacion para comprobar donde estaba la diferencia, que es
  // justo lo que se necesita cuando el formulario dice que las dos no coinciden.
  const [verContrasena, setVerContrasena] = useState(false);
  const [verConfirmacion, setVerConfirmacion] = useState(false);

  // ISSUE #864. A esta pantalla se llega por dos caminos que no son lo mismo para quien la lee:
  //
  //   - "Olvide mi contrasena": ya tenia una cuenta y una contrasena, y esta recuperando el
  //     acceso.
  //   - Una invitacion: es su primer dia, nunca tuvo contrasena, y lo que esta haciendo es
  //     estrenar la cuenta. Decirle "elige una contrasena para tu cuenta" despues de un correo
  //     que dice "restablece tu contrasena" es pedirle que restablezca algo que nunca existio.
  //
  // Quien lo distingue es la propia invitacion: invitar-usuario manda el correo a
  // `${WEB_URL}/nueva-contrasena?origen=invitacion`. Sin ese parametro -- el caso de
  // "olvide mi contrasena", y el de una invitacion vieja enviada antes de este cambio -- se
  // sigue leyendo como restablecimiento, que es el texto que ya estaba.
  const [parametros] = useSearchParams();
  const esInvitacion = parametros.get("origen") === "invitacion";

  // ISSUE #864. Antes esta pantalla daba por hecho que la sesion ya era la del enlace, porque
  // supabase-js lee el fragmento de la URL solo (`detectSessionInUrl`). **Eso solo pasa si no
  // hay ya una sesion abierta.** Si la hay, el fragmento se queda sin procesar y
  // `updateUser({ password })` cambia la contrasena de QUIEN ESTUVIERA EN SESION.
  //
  // Comprobado de punta a punta en local: la administradora invita a alguien y, sin cerrar su
  // sesion, abre el enlace en el mismo navegador. La pantalla se dibuja igual, pero la
  // contrasena que cambia es la suya; la persona invitada se queda sin ninguna, y ni el correo
  // ni la pantalla dicen nada. Es la clase de defecto que no se nota hasta que alguien no puede
  // entrar y nadie sabe por que.
  //
  // Asi que la sesion del enlace se fija a mano, siempre, antes de tocar nada. El fragmento es
  // un detalle del navegador -- por eso se lee aqui y no en packages/shared -- y se limpia de la
  // barra de direcciones en cuanto se usa, para no dejar un token a la vista ni en el historial.
  const [sesionDelEnlaceLista, setSesionDelEnlaceLista] = useState(false);

  useEffect(() => {
    const fragmento = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const accessToken = fragmento.get("access_token");
    const refreshToken = fragmento.get("refresh_token");

    if (!accessToken || !refreshToken) {
      setSesionDelEnlaceLista(true);
      return;
    }

    let cancelado = false;
    establecerSesionDeRecuperacion(accessToken, refreshToken).finally(() => {
      if (cancelado) return;
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      setSesionDelEnlaceLista(true);
    });

    return () => {
      cancelado = true;
    };
  }, []);

  const titulo = esInvitacion ? "Te damos la bienvenida" : "Nueva contraseña";
  const subtitulo = esInvitacion
    ? "Elige la contraseña con la que vas a entrar a Ecopac Digital"
    : "Elige una contraseña para tu cuenta";

  // La navegacion vive aqui y no en el hook: packages/shared no puede depender de
  // react-router-dom (docs/ARQUITECTURA-FRONTEND.md). El hook solo avisa de que la contrasena
  // quedo guardada y de que ya se cerro la sesion de recuperacion.
  if (exito) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          mensaje: esInvitacion
            ? "Tu contraseña quedó guardada. Inicia sesión para entrar."
            : "Contraseña actualizada. Inicia sesión con la nueva.",
        }}
      />
    );
  }

  return (
    <AuthLayout title={titulo} subtitle={subtitulo}>
      {errorGlobal && <AuthAlert variant="error">{errorGlobal}</AuthAlert>}

      <form
        onSubmit={actualizarContrasena}
        noValidate
        style={{ display: "flex", flexDirection: "column", gap: "18px" }}
      >
        <AuthField
          label="Nueva contraseña"
          type={verContrasena ? "text" : "password"}
          autoComplete="new-password"
          placeholder="••••••••"
          value={contrasena}
          onChange={(e) => setContrasena(e.target.value)}
          error={erroresDeCampo?.contrasena}
          disabled={enviando}
          rightAdornment={
            <AuthPasswordToggle
              visible={verContrasena}
              onToggle={() => setVerContrasena(!verContrasena)}
            />
          }
        />

        <AuthField
          label="Confirmar contraseña"
          type={verConfirmacion ? "text" : "password"}
          autoComplete="new-password"
          placeholder="••••••••"
          value={confirmarContrasena}
          onChange={(e) => setConfirmarContrasena(e.target.value)}
          error={erroresDeCampo?.confirmarContrasena}
          disabled={enviando}
          rightAdornment={
            <AuthPasswordToggle
              visible={verConfirmacion}
              onToggle={() => setVerConfirmacion(!verConfirmacion)}
            />
          }
        />

        <div style={{ marginTop: "6px" }}>
          {/* Hasta que la sesion del enlace este puesta no se deja guardar: enviar antes
              cambiaria la contrasena de quien estuviera en sesion, que es el defecto que este
              efecto corrige. */}
          <AuthButton disabled={enviando || !sesionDelEnlaceLista}>
            {enviando ? "Guardando..." : "Guardar nueva contraseña"}
          </AuthButton>
        </div>
      </form>
    </AuthLayout>
  );
}
