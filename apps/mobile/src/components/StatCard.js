import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii, shadows, spacing, typography } from "@ecopac/ui-tokens";

/**
 * Tarjeta de indicador: un rotulo, una cifra y un pie.
 *
 * Espejo de apps/web/src/components/StatCard.jsx. La diferencia de nombre del evento es la que
 * el contrato admite: aqui `onPress`, en web `onClick`.
 *
 * `accent` se recibe como un color ya resuelto de @ecopac/ui-tokens (`colors.warning`,
 * `moduleAccents.inventario`), no como una cadena de CSS: React Native no entiende var().
 */
export default function StatCard({
  label,
  value,
  caption,
  accent = colors.primary,
  esTexto = false,
  onPress,
  style,
}) {
  const contenido = (
    <>
      <Text style={[styles.etiqueta, { color: accent }]}>{String(label).toUpperCase()}</Text>
      <Text style={[styles.valor, esTexto && styles.valorTexto]}>{value}</Text>
      {caption ? <Text style={styles.pie}>{caption}</Text> : null}
    </>
  );

  if (typeof onPress === "function") {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.tarjeta, pressed && styles.presionada, style]}
      >
        {contenido}
      </Pressable>
    );
  }

  return <View style={[styles.tarjeta, style]}>{contenido}</View>;
}

const styles = StyleSheet.create({
  tarjeta: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: 2,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...shadows.sm.movil,
  },
  presionada: {
    opacity: 0.85,
  },
  etiqueta: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.xxs,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.8,
  },
  valor: {
    color: colors.text,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
  },
  valorTexto: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  pie: {
    color: colors.textMuted,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.xs,
  },
});
