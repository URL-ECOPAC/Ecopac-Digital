import { StyleSheet, Text, View } from "react-native";
import { colors, labels, spacing, typography } from "@ecopac/ui-tokens";
import SecondaryButton from "./SecondaryButton";

/**
 * Estado de error. Espejo de apps/web/src/components/ErrorState.jsx, que usa
 * Alert variant="danger"; aqui el equivalente es un bloque tenido con colors.danger.
 */
export default function ErrorState({ message = labels.errorDeConexion, onRetry }) {
  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Ha ocurrido un problema</Text>
      <Text style={styles.mensaje}>{message}</Text>
      {onRetry ? (
        <SecondaryButton title="Reintentar" onPress={onRetry} style={styles.boton} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderRadius: spacing.xs,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.surface,
  },
  titulo: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.danger,
    marginBottom: spacing.xs,
  },
  mensaje: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    color: colors.text,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  boton: {
    alignSelf: "stretch",
  },
});
