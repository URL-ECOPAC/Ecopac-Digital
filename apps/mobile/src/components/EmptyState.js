import { StyleSheet, Text, View } from "react-native";
import { colors, labels, spacing, typography } from "@ecopac/ui-tokens";
import PrimaryButton from "./PrimaryButton";

/**
 * Estado vacio. Espejo de apps/web/src/components/EmptyState.jsx.
 *
 * El boton solo aparece si vienen `actionLabel` Y `onAction`: un boton sin handler no hace
 * nada y uno sin texto no dice que hace.
 */
export default function EmptyState({ message = labels.sinResultados, actionLabel, onAction }) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{message}</Text>
      {actionLabel && onAction ? (
        <PrimaryButton title={actionLabel} onPress={onAction} style={styles.boton} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  text: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.md,
    color: colors.textMuted,
    textAlign: "center",
  },
  boton: {
    marginTop: spacing.md,
    alignSelf: "stretch",
  },
});
