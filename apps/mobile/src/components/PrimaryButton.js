import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "@ecopac/ui-tokens";

const MIN_TOUCH_HEIGHT = 48;

/**
 * Boton de accion principal.
 *
 * Espejo de apps/web/src/components/PrimaryButton.jsx, con la unica diferencia de nombre que el
 * contrato admite: aqui `onPress`, en web `onClick`.
 *
 * `variant`, `size`, `icon` y `block` existen aqui aunque la unica pantalla que hoy los necesita
 * sea de web: el contrato del catalogo dice que los dos lados aceptan las mismas props, y una
 * pantalla que se porte de web a movil no tiene que descubrir a mitad de camino que la mitad de
 * sus botones no se puede dibujar (docs/ARQUITECTURA-FRONTEND.md, "El catalogo de componentes").
 */
const COLOR_POR_VARIANTE = {
  primary: colors.primary,
  danger: colors.danger,
  warning: colors.warning,
  success: colors.success,
};

const ALTO_POR_TAMANO = {
  sm: 36,
  md: MIN_TOUCH_HEIGHT,
  lg: 56,
};

export default function PrimaryButton({
  title,
  onPress,
  disabled = false,
  loading = false,
  variant = "primary",
  size = "md",
  icon = null,
  block = false,
  style,
}) {
  const isInactive = disabled || loading;
  const fondo = COLOR_POR_VARIANTE[variant] ?? colors.primary;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: fondo, minHeight: ALTO_POR_TAMANO[size] ?? MIN_TOUCH_HEIGHT },
        block && styles.block,
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
        <View style={styles.contenido}>
          {icon}
          <Text style={[styles.text, size === "sm" && styles.textSm]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  block: {
    alignSelf: "stretch",
  },
  contenido: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
    justifyContent: "center",
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
  textSm: {
    fontSize: typography.sizes.sm,
  },
});
