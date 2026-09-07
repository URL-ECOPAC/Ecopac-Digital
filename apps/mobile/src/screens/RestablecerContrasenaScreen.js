import * as Linking from "expo-linking";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "@ecopac/ui-tokens";
import { useRestablecerContrasena } from "@ecopac/shared";

import { Card, PrimaryButton, ScreenContainer, TextField } from "../components";

// Mismo texto y mismo flujo que apps/web/src/pages/RestablecerContrasenaPage.jsx: un unico
// mensaje de exito, exista o no la cuenta (issue #644, anti-enumeracion OWASP A07).
export default function RestablecerContrasenaScreen({ navigation }) {
  const { correo, setCorreo, enviando, mensajeExito, errorCampo, solicitarRestablecimiento } =
    useRestablecerContrasena({
      urlDeRetorno: Linking.createURL("recuperar"),
    });

  return (
    <ScreenContainer contentContainerStyle={styles.contenido}>
      <Card style={styles.tarjeta}>
        <View style={styles.encabezado}>
          <Text style={styles.titulo}>Restablecer contraseña</Text>
          <Text style={styles.subtitulo}>Te enviaremos un enlace para crear una nueva</Text>
        </View>

        {mensajeExito ? (
          <View style={styles.exito}>
            <Text style={styles.exitoTexto}>
              Si el correo electrónico existe en nuestro sistema, recibirás un enlace con las
              instrucciones para restablecer tu contraseña.
            </Text>
          </View>
        ) : (
          <>
            <TextField
              label="Correo electrónico"
              value={correo}
              onChangeText={setCorreo}
              error={errorCampo}
              editable={!enviando}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="emailAddress"
              autoComplete="email"
              returnKeyType="done"
              onSubmitEditing={solicitarRestablecimiento}
            />

            <PrimaryButton
              title="Enviar enlace"
              onPress={solicitarRestablecimiento}
              loading={enviando}
              disabled={enviando}
              style={styles.boton}
            />
          </>
        )}

        <Pressable onPress={() => navigation.goBack()} style={styles.volver} hitSlop={8}>
          <Text style={styles.volverTexto}>Volver al inicio de sesión</Text>
        </Pressable>
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
  exito: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.success || colors.primary,
    backgroundColor: colors.surface,
  },
  exitoTexto: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    color: colors.text,
    textAlign: "center",
  },
  boton: {
    marginTop: spacing.md,
  },
  volver: {
    marginTop: spacing.lg,
    alignItems: "center",
  },
  volverTexto: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
  },
});
