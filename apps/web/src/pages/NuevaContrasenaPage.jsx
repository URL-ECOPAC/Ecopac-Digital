import React, { useState } from 'react';
import { useNuevaContrasena } from '@ecopac/shared';
import {
  Card,
  ErrorState,
  PrimaryButton,
  ScreenContainer,
  TextField,
} from '../components';

export default function NuevaContrasenaPage() {
  const {
    contrasena,
    setContrasena,
    confirmarContrasena,
    setConfirmarContrasena,
    enviando,
    errorGlobal,
    erroresDeCampo,
    actualizarContrasena,
  } = useNuevaContrasena();

  const [verPassword, setVerPassword] = useState(false);

  return (
    <ScreenContainer>
      <Card title="Nueva contraseña">
        {errorGlobal && <ErrorState message={errorGlobal} />}

        <form onSubmit={actualizarContrasena} noValidate>
          <div className="position-relative mb-3">
            <TextField
              label="Nueva contraseña"
              type={verPassword ? 'text' : 'password'}
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
                right: '12px',
                top: erroresDeCampo?.contrasena ? '32px' : '38px',
                zIndex: 5,
                fontSize: '0.85rem',
              }}
              onClick={() => setVerPassword(!verPassword)}
              tabIndex={-1}
            >
              {verPassword ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>

          <TextField
            label="Confirmar contraseña"
            type={verPassword ? 'text' : 'password'}
            autoComplete="new-password"
            value={confirmarContrasena}
            onChange={(e) => setConfirmarContrasena(e.target.value)}
            error={erroresDeCampo?.confirmarContrasena}
            disabled={enviando}
          />

          <div className="mt-4">
            <PrimaryButton
              title={enviando ? 'Guardando...' : 'Guardar nueva contraseña'}
              type="submit"
              disabled={enviando}
            />
          </div>
        </form>
      </Card>
    </ScreenContainer>
  );
}