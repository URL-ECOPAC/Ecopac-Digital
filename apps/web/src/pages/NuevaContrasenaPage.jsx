import React, { useState } from "react";
import { Navigate } from "react-router-dom";
import { useNuevaContrasena } from "@ecopac/shared";
import { Card, ErrorState, PrimaryButton, ScreenContainer, TextField } from "../components";

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
    <ScreenContainer>
      <Card title="Nueva contraseña">
        {errorGlobal && <ErrorState message={errorGlobal} />}

        <form onSubmit={actualizarContrasena} noValidate>
          <div className="position-relative mb-3">
            <TextField
              label="Nueva contraseña"
              type={verPassword ? "text" : "password"}
              autoComplete="new-password"
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              error={erroresDeCampo?.contrasena}
              disabled={enviando}
            />
            <button
              type="button"
              className="btn btn-link btn-sm position-absolute text-decoration-none text-muted"
              style={{
                right: "12px",
                top: erroresDeCampo?.contrasena ? "32px" : "38px",
                zIndex: 5,
                fontSize: "0.85rem",
              }}
              onClick={() => setVerPassword(!verPassword)}
              tabIndex={-1}
            >
              {verPassword ? "Ocultar" : "Mostrar"}
            </button>
          </div>

          <TextField
            label="Confirmar contraseña"
            type={verPassword ? "text" : "password"}
            autoComplete="new-password"
            value={confirmarContrasena}
            onChange={(e) => setConfirmarContrasena(e.target.value)}
            error={erroresDeCampo?.confirmarContrasena}
            disabled={enviando}
          />

          <div className="mt-4">
            <PrimaryButton
              title={enviando ? "Guardando..." : "Guardar nueva contraseña"}
              type="submit"
              disabled={enviando}
            />
          </div>
        </form>
      </Card>
    </ScreenContainer>
  );
}
