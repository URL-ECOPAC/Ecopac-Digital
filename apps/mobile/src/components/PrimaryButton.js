import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { colors, radii, spacing, typography } from "@ecopac/ui-tokens";

const MIN_TOUCH_HEIGHT = 48;

export default function PrimaryButton({
  title,
  onPress,
  disabled = false,
  loading = false,
  style,
}) {
  const isInactive = disabled || loading;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        isInactive && styles.buttonDisabled,
        pressed && !isInactive && styles.buttonPressed,
        style,
      ]}
      onPress={onPress}
      disabled={isInactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: isInactive, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator color={colors.background} />
      ) : (
        <Text style={styles.text}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: MIN_TOUCH_HEIGHT,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonDisabled: {
    backgroundColor: colors.secondary,
  },
  text: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.background,
  },
});
