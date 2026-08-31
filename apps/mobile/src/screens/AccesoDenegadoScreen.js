import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "@ecopac/ui-tokens";

export default function AccesoDenegadoScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Acceso denegado</Text>
      <Text style={styles.mensaje}>
        No tienes los permisos necesarios para acceder a esta sección.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  titulo: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.error || "#D32F2F",
    marginBottom: spacing.sm,
  },
  mensaje: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.md,
    color: colors.textMuted,
    textAlign: "center",
  },
});
