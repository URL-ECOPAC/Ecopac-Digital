import { useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "@ecopac/ui-tokens";
import { useNuevaContrasena } from "@ecopac/shared";

import { Card, PasswordField, PrimaryButton, ScreenContainer } from "../components";

/**
 * Pantalla que muestra App.js mientras `estaEnRecuperacion` es verdadero (issue #644): llega
 * aqui sin pasar por el AuthStack normal, porque tiene que aparecer sin importar si ya hay
 * sesion o no. `alTerminar` la pasa App.js y la devuelve a Login cuando la sesion de
 * recuperacion termina (exito o cierre por cuenta desactivada, ver useNuevaContrasena.js).
 */
export default function NuevaContrasenaScreen({ alTerminar }) {
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

  const campoConfirmar = useRef(null);

  useEffect(() => {
    if (exito) {
      alTerminar?.();
    }
  }, [exito, alTerminar]);

  return (
    <ScreenContainer contentContainerStyle={styles.contenido}>
      <Card style={styles.tarjeta}>
        <View style={styles.encabezado}>
          <Text style={styles.titulo}>Nueva contraseña</Text>
          <Text style={styles.subtitulo}>Elige una contraseña para tu cuenta</Text>
        </View>

        {errorGlobal ? (
          <View style={styles.errorGeneral}>
            <Text style={styles.errorGeneralTexto}>{errorGlobal}</Text>
          </View>
        ) : null}

        {/* ISSUE #864. Un estado de visibilidad POR CAMPO. Antes los dos compartian
            `verContrasena`, asi que no se podia ver solo la confirmacion para comprobar donde
            estaba la diferencia, que es justo lo que hace falta cuando el formulario dice que
            las dos no coinciden. Mismo arreglo que en la web. */}
        <PasswordField
          label="Nueva contraseña"
          value={contrasena}
          onChangeText={setContrasena}
          error={erroresDeCampo?.contrasena}
          editable={!enviando}
          textContentType="newPassword"
          autoComplete="password-new"
          returnKeyType="next"
          onSubmitEditing={() => campoConfirmar.current?.focus()}
          blurOnSubmit={false}
        />

        <PasswordField
          ref={campoConfirmar}
          label="Confirmar contraseña"
          value={confirmarContrasena}
          onChangeText={setConfirmarContrasena}
          error={erroresDeCampo?.confirmarContrasena}
          editable={!enviando}
          textContentType="newPassword"
          autoComplete="password-new"
          returnKeyType="done"
          onSubmitEditing={actualizarContrasena}
        />

        <PrimaryButton
          title="Guardar nueva contraseña"
          onPress={actualizarContrasena}
          loading={enviando}
          disabled={enviando}
          style={styles.boton}
        />
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  contenido: {
    justifyContent: "center",
  },
  tarjeta: {
    padding: spacing.lg,
  },
  encabezado: {
    marginBottom: spacing.xl,
    alignItems: "center",
  },
  titulo: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    textAlign: "center",
  },
  subtitulo: {
    marginTop: spacing.xs,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.md,
    color: colors.textMuted,
    textAlign: "center",
  },
  errorGeneral: {
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.surface,
  },
  errorGeneralTexto: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    color: colors.danger,
    textAlign: "center",
  },
  boton: {
    marginTop: spacing.md,
  },
});
