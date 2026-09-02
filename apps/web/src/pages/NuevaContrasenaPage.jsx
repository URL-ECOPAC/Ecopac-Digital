import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useNuevaContrasena } from "@ecopac/shared";
import { AuthAlert, AuthButton, AuthField, AuthLayout, AuthPasswordToggle } from "../components/auth";

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

  const [verPassword, setVerPassword] = useState(false);

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
          type={verPassword ? "text" : "password"}
          autoComplete="new-password"
          placeholder="••••••••"
          value={contrasena}
          onChange={(e) => setContrasena(e.target.value)}
          error={erroresDeCampo?.contrasena}
          disabled={enviando}
          rightAdornment={
            <AuthPasswordToggle visible={verPassword} onToggle={() => setVerPassword(!verPassword)} />
          }
        />

        <AuthField
          label="Confirmar contraseña"
          type={verPassword ? "text" : "password"}
          autoComplete="new-password"
          placeholder="••••••••"
          value={confirmarContrasena}
          onChange={(e) => setConfirmarContrasena(e.target.value)}
          error={erroresDeCampo?.confirmarContrasena}
          disabled={enviando}
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
