import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "@ecopac/ui-tokens";
import { useNuevaContrasena } from "@ecopac/shared";

import { Card, PrimaryButton, ScreenContainer, TextField } from "../components";

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
  const [verContrasena, setVerContrasena] = useState(false);

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

        <View style={styles.encabezadoContrasena}>
          <Text style={styles.labelContrasena}>Nueva contraseña</Text>
          <Pressable onPress={() => setVerContrasena((valor) => !valor)} hitSlop={8}>
            <Text style={styles.toggleContrasena}>{verContrasena ? "Ocultar" : "Mostrar"}</Text>
          </Pressable>
        </View>
        <TextField
          value={contrasena}
          onChangeText={setContrasena}
          error={erroresDeCampo?.contrasena}
          editable={!enviando}
          secureTextEntry={!verContrasena}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="newPassword"
          autoComplete="password-new"
          returnKeyType="next"
          onSubmitEditing={() => campoConfirmar.current?.focus()}
          blurOnSubmit={false}
        />

        <TextField
          ref={campoConfirmar}
          label="Confirmar contraseña"
          value={confirmarContrasena}
          onChangeText={setConfirmarContrasena}
          error={erroresDeCampo?.confirmarContrasena}
          editable={!enviando}
          secureTextEntry={!verContrasena}
          autoCapitalize="none"
          autoCorrect={false}
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
  boton: {
    marginTop: spacing.md,
  },
});
