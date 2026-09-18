import { KeyRound, Mail, Save, ShieldCheck } from "lucide-react";

import {
  TIPOS_DE_CAMPO,
  etiquetaDeRol,
  nombreCompletoDe,
  useEspecialidadesDePerfil,
  usePerfilPropio,
} from "@ecopac/shared";

import {
  Card,
  ErrorState,
  MultiSelector,
  PageHeader,
  PrimaryButton,
  ScreenContainer,
  Selector,
  StatusChip,
  TextField,
} from "../components";
import { useSesionCompartida } from "../contexto/SesionProvider";
import "./perfil.css";

// Pantalla de perfil propio y cambio de contrasena (issue #102). Solo presentacion: los datos, la
// edicion, la reverificacion de contrasena y el refresco de la sesion compartida salen de
// usePerfilPropio(); las especialidades, de useEspecialidadesDePerfil(). Las etiquetas, el tipo y
// el orden de los campos salen de CAMPOS_USUARIO via camposDePerfilPropio(): esta pantalla no
// escribe ninguna de esas etiquetas a mano, solo las de los campos de contrasena, que no tienen
// descriptor (mismo patron que NuevaContrasenaPage.jsx).
//
// LA SEGUNDA PASADA DE DISENO (issue #838). Eran dos tarjetas con una columna de inputs a ancho
// completo, sin nada que dijera de quien es el perfil que se esta mirando. Tres cambios:
//
//   1. Una cabecera de identidad: la inicial, el nombre, el correo y el chip del rol. Es lo mismo
//      que ya hace la ficha del paciente, y por el mismo motivo -- los datos de abajo se leen
//      sabiendo a quien pertenecen.
//   2. Los campos en la rejilla de dos columnas del resto de los formularios (`ec-form-grid`), en
//      vez de una columna larga que obliga a desplazar.
//   3. Las especialidades dejan de ser una lista de solo lectura: puedeGestionarEspecialidades()
//      ya permitia a cualquiera editar las de su propio perfil (permisos.js) y esta pantalla era
//      la unica que no lo ofrecia, asi que un medico tenia que pedirle a la administradora que le
//      corrigiera las suyas.
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
    contrasena,
    setCampoDeContrasena,
    erroresDeContrasena,
    cambiandoContrasena,
    errorGlobalDeContrasena,
    contrasenaCambiada,
    cambiarContrasena,
  } = usePerfilPropio({ usuario, perfil, refrescarPerfil });

  const {
    especialidades,
    catalogo: catalogoDeEspecialidades,
    editable: puedeEditarEspecialidades,
    hayCambios: hayCambiosDeEspecialidades,
    error: errorDeEspecialidades,
    cargando: cargandoEspecialidades,
    enviando: guardandoEspecialidades,
    setEspecialidades,
    guardar: guardarEspecialidades,
  } = useEspecialidadesDePerfil(usuario?.id, {
    rol: perfil?.rol,
    idSesionActual: usuario?.id,
  });

  const nombreCompleto = nombreCompletoDe(perfil ?? {}) || "Tu perfil";
  const inicial = (perfil?.nombres ?? nombreCompleto).charAt(0).toUpperCase();

  // El campo de especialidades del descriptor se dibuja aparte, con su propio control y su propio
  // guardado: no es una columna de `perfiles`, es otra tabla (ver useEspecialidadesDePerfil).
  const camposDeDatos = campos.filter((campo) => campo.tipo !== TIPOS_DE_CAMPO.ETIQUETAS);

  return (
    <ScreenContainer>
      <PageHeader title="Mi perfil" subtitle="Tus datos de contacto y tu contraseña de acceso" />

      <Card style={{ marginBottom: "1rem" }}>
        <div className="perfil-identidad">
          <span className="perfil-avatar" aria-hidden="true">
            {inicial}
          </span>
          <div className="perfil-identidad-textos">
            <h2 className="perfil-nombre">{nombreCompleto}</h2>
            {perfil?.email && (
              <p className="perfil-correo">
                <Mail size={14} aria-hidden="true" />
                {perfil.email}
              </p>
            )}
            <div className="perfil-chips">
              {valores.rol && <StatusChip status="activo" label={etiquetaDeRol(valores.rol)} />}
              {especialidades.map((nombre) => (
                <span className="ec-chip" key={nombre}>
                  {nombre}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Card title="Datos personales">
        {errorGlobal && <ErrorState message={errorGlobal} />}

        <form onSubmit={guardarPerfil} noValidate>
          <div className="ec-form-grid">
            {camposDeDatos.map((campo) => {
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
          </div>

          <div className="ec-form-pie">
            <PrimaryButton
              title="Guardar cambios"
              type="submit"
              loading={guardando}
              icon={<Save size={16} aria-hidden="true" />}
            />
          </div>
          {guardadoExitoso && <p className="text-success mt-2 mb-0">Perfil actualizado.</p>}
        </form>
      </Card>

      <div className="mt-4">
        <Card
          title="Especialidades"
          subtitle="Las que aparecen junto a tu nombre en el cuadro de turnos"
        >
          {errorDeEspecialidades && <ErrorState message={errorDeEspecialidades.mensaje} />}

          {cargandoEspecialidades ? (
            <p className="text-body-secondary mb-0">Cargando...</p>
          ) : puedeEditarEspecialidades ? (
            <>
              <MultiSelector
                label="Tus especialidades"
                value={especialidades}
                options={catalogoDeEspecialidades}
                onChange={setEspecialidades}
                permiteLibre
                placeholder="Elegir de las que ya existen"
                placeholderLibre="Escribe una y pulsa Agregar"
                disabled={guardandoEspecialidades}
              />
              <div className="ec-form-pie">
                <PrimaryButton
                  title="Guardar especialidades"
                  onClick={guardarEspecialidades}
                  loading={guardandoEspecialidades}
                  disabled={!hayCambiosDeEspecialidades}
                  icon={<Save size={16} aria-hidden="true" />}
                />
              </div>
            </>
          ) : especialidades.length === 0 ? (
            <p className="text-body-secondary mb-0">Sin especialidades asignadas.</p>
          ) : (
            <div className="d-flex flex-wrap gap-2">
              {especialidades.map((nombre) => (
                <StatusChip key={nombre} status={nombre} />
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="mt-4">
        <Card title="Cambiar contraseña" subtitle="Se te pedirá tu contraseña actual">
          {errorGlobalDeContrasena && <ErrorState message={errorGlobalDeContrasena} />}

          <form onSubmit={cambiarContrasena} noValidate>
            <div className="ec-form-grid">
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
            </div>

            <p className="perfil-nota">
              <ShieldCheck size={14} aria-hidden="true" />
              Tu sesión se cierra sola tras 30 minutos sin actividad.
            </p>

            <div className="ec-form-pie">
              <PrimaryButton
                title="Cambiar contraseña"
                type="submit"
                loading={cambiandoContrasena}
                icon={<KeyRound size={16} aria-hidden="true" />}
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
