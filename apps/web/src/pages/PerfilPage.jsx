import { TIPOS_DE_CAMPO, etiquetaDeRol, usePerfilPropio } from "@ecopac/shared";

import {
  Card,
  ErrorState,
  PrimaryButton,
  ScreenContainer,
  Selector,
  StatusChip,
  TextField,
} from "../components";
import { useSesionCompartida } from "../contexto/SesionProvider";

// Pantalla de perfil propio y cambio de contrasena (issue #102). Solo presentacion: los datos,
// la edicion, la reverificacion de contrasena y el refresco de la sesion compartida salen de
// usePerfilPropio(), en packages/shared/usuarios/. Las etiquetas, el tipo y el orden de los
// campos de perfil (nombre, apellido, correo, telefono, rol, especialidades) salen de
// CAMPOS_USUARIO via camposDePerfilPropio(): esta pantalla no escribe ninguna de esas etiquetas
// a mano, solo las de los campos de contrasena, que no tienen descriptor (mismo patron que
// NuevaContrasenaPage.jsx).
//
// La version movil de esta misma pantalla es la #110 y deberia consumir el mismo hook y los
// mismos campos; lo unico que cambia es que se dibuja con los componentes de apps/mobile.
export default function PerfilPage() {
  const { usuario, perfil, refrescarPerfil } = useSesionCompartida();

  const {
    campos,
    valores,
    setCampo,
    erroresDeCampo,
    guardando,
    errorGlobal,
    guardadoExitoso,
    guardarPerfil,
    especialidades,
    cargandoEspecialidades,
    contrasena,
    setCampoDeContrasena,
    erroresDeContrasena,
    cambiandoContrasena,
    errorGlobalDeContrasena,
    contrasenaCambiada,
    cambiarContrasena,
  } = usePerfilPropio({ usuario, perfil, refrescarPerfil });

  return (
    <ScreenContainer>
      <Card title="Mi perfil">
        {errorGlobal && <ErrorState message={errorGlobal} />}

        <form onSubmit={guardarPerfil} noValidate>
          {campos.map((campo) => {
            if (campo.tipo === TIPOS_DE_CAMPO.ETIQUETAS) {
              return (
                <div key={campo.id} className="mb-3">
                  <label className="form-label d-block">{campo.label}</label>
                  {cargandoEspecialidades ? (
                    <span className="text-muted">Cargando...</span>
                  ) : especialidades.length === 0 ? (
                    <span className="text-muted">Sin especialidades asignadas.</span>
                  ) : (
                    <div className="d-flex flex-wrap gap-2">
                      {especialidades.map((nombre) => (
                        <StatusChip key={nombre} status={nombre} />
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            if (campo.id === "rol" && !campo.editable) {
              return (
                <TextField
                  key={campo.id}
                  label={campo.label}
                  value={etiquetaDeRol(valores.rol)}
                  disabled
                />
              );
            }

            if (campo.tipo === TIPOS_DE_CAMPO.SELECT) {
              return (
                <Selector
                  key={campo.id}
                  label={campo.label}
                  value={valores[campo.id]}
                  options={campo.opciones}
                  onSelect={(valor) => setCampo(campo.id, valor)}
                  error={erroresDeCampo?.[campo.id]}
                  disabled={guardando}
                />
              );
            }

            return (
              <TextField
                key={campo.id}
                label={campo.label}
                value={valores[campo.id] ?? ""}
                onChange={
                  campo.editable ? (evento) => setCampo(campo.id, evento.target.value) : undefined
                }
                error={erroresDeCampo?.[campo.id]}
                disabled={!campo.editable || guardando}
              />
            );
          })}

          <div className="mt-3">
            <PrimaryButton
              title={guardando ? "Guardando..." : "Guardar cambios"}
              type="submit"
              disabled={guardando}
              loading={guardando}
            />
          </div>
          {guardadoExitoso && <p className="text-success mt-2 mb-0">Perfil actualizado.</p>}
        </form>
      </Card>

      <div className="mt-4">
        <Card title="Cambiar contraseña">
          {errorGlobalDeContrasena && <ErrorState message={errorGlobalDeContrasena} />}

          <form onSubmit={cambiarContrasena} noValidate>
            <TextField
              label="Contraseña actual"
              type="password"
              autoComplete="current-password"
              value={contrasena.actual}
              onChange={(evento) => setCampoDeContrasena("actual", evento.target.value)}
              error={erroresDeContrasena?.actual}
              disabled={cambiandoContrasena}
            />
            <TextField
              label="Contraseña nueva"
              type="password"
              autoComplete="new-password"
              value={contrasena.nueva}
              onChange={(evento) => setCampoDeContrasena("nueva", evento.target.value)}
              error={erroresDeContrasena?.nueva}
              disabled={cambiandoContrasena}
            />
            <TextField
              label="Confirmar contraseña nueva"
              type="password"
              autoComplete="new-password"
              value={contrasena.confirmarNueva}
              onChange={(evento) => setCampoDeContrasena("confirmarNueva", evento.target.value)}
              error={erroresDeContrasena?.confirmarNueva}
              disabled={cambiandoContrasena}
            />

            <div className="mt-3">
              <PrimaryButton
                title={cambiandoContrasena ? "Guardando..." : "Cambiar contraseña"}
                type="submit"
                disabled={cambiandoContrasena}
                loading={cambiandoContrasena}
              />
            </div>
            {contrasenaCambiada && (
              <p className="text-success mt-2 mb-0">Contraseña actualizada.</p>
            )}
          </form>
        </Card>
      </div>
    </ScreenContainer>
  );
}
