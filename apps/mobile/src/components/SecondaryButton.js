import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { rotuloSinSigno } from "@ecopac/shared";
import { colors, radii, spacing, typography } from "@ecopac/ui-tokens";
import { iconoDeAccion } from "./iconoDeAccion";

const MIN_TOUCH_HEIGHT = 48;

/**
 * Boton de accion secundaria (ej. "Cancelar", "Volver", "Editar").
 *
 * Espejo de apps/web/src/components/SecondaryButton.jsx: mismo estilo outline y las mismas
 * props, salvo el nombre del evento (`onPress` aqui, `onClick` en web).
 *
 * `variant` distingue las tres jerarquias de accion secundaria: "outline" (la alternativa
 * principal, en verde), "neutra" (la que no tiene intencion propia -"Cancelar", "Cerrar"-, en
 * gris) y "peligro" (borrar, anular, rechazar).
 */
const COLOR_POR_VARIANTE = {
  outline: colors.primary,
  neutra: colors.secondary,
  peligro: colors.danger,
};

const ALTO_POR_TAMANO = {
  sm: 36,
  md: MIN_TOUCH_HEIGHT,
  lg: 56,
};

export default function SecondaryButton({
  title,
  onPress,
  disabled = false,
  loading = false,
  variant = "outline",
  size = "md",
  icon,
  block = false,
  style,
}) {
  const inactivo = disabled || loading;
  const acento = COLOR_POR_VARIANTE[variant] ?? colors.primary;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        { borderColor: acento, minHeight: ALTO_POR_TAMANO[size] ?? MIN_TOUCH_HEIGHT },
        block && styles.block,
        inactivo && styles.buttonDisabled,
        pressed && !inactivo && styles.buttonPressed,
        style,
      ]}
      onPress={onPress}
      disabled={inactivo}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactivo, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator color={acento} />
      ) : (
        <View style={styles.contenido}>
          {iconoDeAccion(title, icon, acento)}
          <Text
            style={[
              styles.text,
              { color: acento },
              size === "sm" && styles.textSm,
              inactivo && styles.textDisabled,
            ]}
          >
            {rotuloSinSigno(title)}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radii.md,
    borderWidth: 1,
    backgroundColor: colors.background,
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
    opacity: 0.7,
  },
  buttonDisabled: {
    borderColor: colors.secondary,
  },
  text: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  textSm: {
    fontSize: typography.sizes.sm,
  },
  textDisabled: {
    color: colors.secondary,
  },
});
