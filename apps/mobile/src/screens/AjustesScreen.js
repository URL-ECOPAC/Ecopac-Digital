import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "@ecopac/ui-tokens";
import {
  TIPOS_DE_CAMPO,
  etiquetaDeRol,
  usePerfilPropio,
  valoresInicialesDePerfil,
} from "@ecopac/shared";

import {
  Card,
  ErrorState,
  Modal,
  PrimaryButton,
  ScreenContainer,
  SecondaryButton,
  Selector,
  StatusChip,
  TextField,
  UsuarioActivo,
} from "../components";
import { useRegistroSinGuardar } from "../contexto/RegistroSinGuardarProvider";
import { useSesionCompartida } from "../contexto/SesionProvider";

// Id fijo: solo hay un formulario de perfil propio montado a la vez (issue #645).
const ID_FORMULARIO = "perfil-propio";

// Pantalla de Ajustes + perfil propio y cambio de contrasena (issue #645, espejo de la #102).
// Solo presentacion: los datos, la edicion, la reverificacion de contrasena y el refresco de la
// sesion compartida salen de usePerfilPropio(), en packages/shared/usuarios/. Las etiquetas, el
// tipo y el orden de los campos de perfil salen de CAMPOS_USUARIO via camposDePerfilPropio():
// esta pantalla no escribe ninguna de esas etiquetas a mano, solo las de los campos de
// contrasena, que no tienen descriptor (mismo patron que apps/web/src/pages/PerfilPage.jsx).
export default function AjustesScreen() {
  const { usuario, perfil, refrescarPerfil, logout } = useSesionCompartida();
  const { hayAlgoSinGuardar, registrar, desregistrar } = useRegistroSinGuardar();
  const [confirmando, setConfirmando] = useState(false);
  const [verContrasena, setVerContrasena] = useState(false);

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

  const sinCambiosDePerfil =
    JSON.stringify(valores) === JSON.stringify(valoresInicialesDePerfil(perfil));
  const sinCambiosDeContrasena =
    !contrasena.actual && !contrasena.nueva && !contrasena.confirmarNueva;
  const hayCambios = !sinCambiosDePerfil || !sinCambiosDeContrasena;

  // El formulario de perfil tambien cuenta para el aviso de cambios sin guardar de la #110,
  // mismo patron que ya usa TriajeScreen.js: se registra mientras haya algo sin guardar y se
  // desregistra solo, sin depender de que la persona toque un boton de guardar antes de irse.
  useEffect(() => {
    if (!hayCambios) return;
    registrar(ID_FORMULARIO);
    return () => desregistrar(ID_FORMULARIO);
  }, [hayCambios, registrar, desregistrar]);

  // Issue #110, criterio 2: un solo dialogo, y solo cuando hace falta. Si no hay nada sin
  // guardar en ninguna pantalla registrada, cierra directo -sin esto el criterio 1 (cerrar
  // sesion en dos toques) se rompe para el caso comun, que es no tener nada sin guardar.
  const pedirCierre = () => {
    if (hayAlgoSinGuardar()) {
      setConfirmando(true);
      return;
    }
    logout();
  };

  const cerrarSinGuardar = () => {
    setConfirmando(false);
    logout();
  };

  return (
    <ScreenContainer contentContainerStyle={styles.contenido}>
      <Text style={styles.titulo}>Ajustes</Text>
      <UsuarioActivo compacto={false} />

      <Card title="Mi perfil">
        {errorGlobal ? <ErrorState message={errorGlobal} /> : null}

        {campos.map((campo) => {
          if (campo.tipo === TIPOS_DE_CAMPO.ETIQUETAS) {
            return (
              <View key={campo.id} style={styles.campoEtiquetas}>
                <Text style={styles.labelEtiquetas}>{campo.label}</Text>
                {cargandoEspecialidades ? (
                  <Text style={styles.textoMuted}>Cargando...</Text>
                ) : especialidades.length === 0 ? (
                  <Text style={styles.textoMuted}>Sin especialidades asignadas.</Text>
                ) : (
                  <View style={styles.listaEtiquetas}>
                    {especialidades.map((nombre) => (
                      <StatusChip key={nombre} status={nombre} />
                    ))}
                  </View>
                )}
              </View>
            );
          }

          if (campo.id === "rol" && !campo.editable) {
            return (
              <TextField
                key={campo.id}
                label={campo.label}
                value={etiquetaDeRol(valores.rol)}
                editable={false}
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
              onChangeText={campo.editable ? (texto) => setCampo(campo.id, texto) : undefined}
              error={erroresDeCampo?.[campo.id]}
              editable={campo.editable && !guardando}
            />
          );
        })}

        <PrimaryButton
          title="Guardar cambios"
          onPress={guardarPerfil}
          loading={guardando}
          disabled={guardando}
          style={styles.boton}
        />
        {guardadoExitoso ? <Text style={styles.textoExito}>Perfil actualizado.</Text> : null}
      </Card>

      <Card title="Cambiar contraseña">
        {errorGlobalDeContrasena ? <ErrorState message={errorGlobalDeContrasena} /> : null}

        <View style={styles.encabezadoContrasena}>
          <Text style={styles.labelContrasena}>Contraseña actual</Text>
          <Pressable onPress={() => setVerContrasena((valor) => !valor)} hitSlop={8}>
            <Text style={styles.toggleContrasena}>{verContrasena ? "Ocultar" : "Mostrar"}</Text>
          </Pressable>
        </View>
        <TextField
          value={contrasena.actual}
          onChangeText={(texto) => setCampoDeContrasena("actual", texto)}
          error={erroresDeContrasena?.actual}
          editable={!cambiandoContrasena}
          secureTextEntry={!verContrasena}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="password"
          autoComplete="current-password"
        />
        <TextField
          label="Contraseña nueva"
          value={contrasena.nueva}
          onChangeText={(texto) => setCampoDeContrasena("nueva", texto)}
          error={erroresDeContrasena?.nueva}
          editable={!cambiandoContrasena}
          secureTextEntry={!verContrasena}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="newPassword"
          autoComplete="password-new"
        />
        <TextField
          label="Confirmar contraseña nueva"
          value={contrasena.confirmarNueva}
          onChangeText={(texto) => setCampoDeContrasena("confirmarNueva", texto)}
          error={erroresDeContrasena?.confirmarNueva}
          editable={!cambiandoContrasena}
          secureTextEntry={!verContrasena}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="newPassword"
          autoComplete="password-new"
        />

        <PrimaryButton
          title="Cambiar contraseña"
          onPress={cambiarContrasena}
          loading={cambiandoContrasena}
          disabled={cambiandoContrasena}
          style={styles.boton}
        />
        {contrasenaCambiada ? <Text style={styles.textoExito}>Contraseña actualizada.</Text> : null}
      </Card>

      <PrimaryButton title="Cerrar sesión" onPress={pedirCierre} />

      <Modal visible={confirmando} onClose={() => setConfirmando(false)}>
        {/* Sin `title`: el encabezado del Modal trae su propio boton "Cerrar", redundante con
            "Seguir editando" de aqui abajo -las dos hacen lo mismo-, asi que el titulo se pinta
            a mano en vez de dejar que Modal dibuje su cabecera con ese boton de mas. */}
        <Text style={styles.tituloModal}>Hay cambios sin guardar</Text>
        <Text style={styles.textoModal}>
          Si cierras sesión ahora se perderán los cambios hechos.
        </Text>
        <View style={styles.accionesModal}>
          <SecondaryButton
            title="Seguir editando"
            onPress={() => setConfirmando(false)}
            style={styles.botonModal}
          />
          <PrimaryButton
            title="Cerrar sesión sin guardar"
            onPress={cerrarSinGuardar}
            style={styles.botonModal}
          />
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  contenido: {
    gap: spacing.lg,
    paddingBottom: spacing.xl,
  },
  titulo: {
    color: colors.text,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
  },
  campoEtiquetas: {
    marginBottom: spacing.md,
  },
  labelEtiquetas: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  listaEtiquetas: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  textoMuted: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
  },
  encabezadoContrasena: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  labelContrasena: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.text,
  },
  toggleContrasena: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
  },
  textoExito: {
    marginTop: spacing.sm,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    color: colors.success || colors.primary,
    textAlign: "center",
  },
  boton: {
    marginTop: spacing.sm,
  },
  tituloModal: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  textoModal: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    color: colors.text,
    marginBottom: spacing.md,
  },
  accionesModal: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  botonModal: {
    flex: 1,
  },
});
