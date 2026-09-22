import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useNuevaContrasena } from "@ecopac/shared";
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

  // La navegacion vive aqui y no en el hook: packages/shared no puede depender de
  // react-router-dom (docs/ARQUITECTURA-FRONTEND.md). El hook solo avisa de que la contrasena
  // quedo guardada y de que ya se cerro la sesion de recuperacion.
  if (exito) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ mensaje: "Contraseña actualizada. Inicia sesión con la nueva." }}
      />
    );
  }

  return (
    <AuthLayout title="Nueva contraseña" subtitle="Elige una contraseña para tu cuenta">
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
          <AuthButton disabled={enviando}>
            {enviando ? "Guardando..." : "Guardar nueva contraseña"}
          </AuthButton>
        </div>
      </form>
    </AuthLayout>
  );
}
