import { forwardRef, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { colors, spacing, typography } from "@ecopac/ui-tokens";

// El personal llena formularios con una mano y a veces con guantes,
// por lo que el area tactil minima recomendada (Material/HIG) es 48dp.
const MIN_TOUCH_HEIGHT = 48;

/**
 * Campo de texto controlado. Acepta cualquier prop nativa de TextInput
 * (value, onChangeText, keyboardType, secureTextEntry, etc.)
 *
 * Reenvia el ref al TextInput interno para que una pantalla pueda enfocarlo
 * a mano (por ejemplo, saltar al siguiente campo con returnKeyType="next").
 */
const TextField = forwardRef(function TextField({ label, error, style, ...inputProps }, ref) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={[styles.container, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        ref={ref}
        style={[styles.input, isFocused && styles.inputFocused, error && styles.inputError]}
        placeholderTextColor={colors.textMuted}
        {...inputProps}
        onFocus={(event) => {
          setIsFocused(true);
          inputProps.onFocus?.(event);
        }}
        onBlur={(event) => {
          setIsFocused(false);
          inputProps.onBlur?.(event);
        }}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
});

export default TextField;

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  input: {
    minHeight: MIN_TOUCH_HEIGHT,
    borderWidth: 1,
    borderColor: colors.secondary,
    borderRadius: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.md,
    color: colors.text,
    backgroundColor: colors.background,
  },
  inputFocused: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  inputError: {
    borderColor: colors.danger,
  },
  errorText: {
    marginTop: spacing.xs,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.xs,
    color: colors.danger,
  },
});
