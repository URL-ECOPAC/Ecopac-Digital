import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, spacing, typography } from '@ecopac/ui-tokens';

const MIN_TOUCH_HEIGHT = 48;

/**
 * Boton de accion secundaria (ej. "Cancelar", "Volver").
 * Estilo tipo outline para diferenciarse visualmente de PrimaryButton.
 */
export default function SecondaryButton({ title, onPress, disabled = false, style }) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.buttonPressed,
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
    >
      <Text style={[styles.text, disabled && styles.textDisabled]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: MIN_TOUCH_HEIGHT,
    borderRadius: spacing.xs,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonDisabled: {
    borderColor: colors.secondary,
  },
  text: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
  },
  textDisabled: {
    color: colors.secondary,
  },
});
