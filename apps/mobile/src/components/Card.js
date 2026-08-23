import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@ecopac/ui-tokens';

/**
 * Tarjeta. Espejo de apps/web/src/components/Card.jsx.
 *
 * Base visual de las tarjetas de DataList y de cualquier bloque agrupado. Si viene
 * `onPress` la tarjeta es interactiva; si no, es un View y no captura toques.
 */
export default function Card({ children, title, onPress, style }) {
  const contenido = (
    <>
      {title ? <Text style={styles.titulo}>{title}</Text> : null}
      {children}
    </>
  );

  if (typeof onPress !== 'function') {
    return <View style={[styles.card, style]}>{contenido}</View>;
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed, style]}
      onPress={onPress}
      accessibilityRole="button"
    >
      {contenido}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  cardPressed: {
    opacity: 0.85,
  },
  titulo: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
});
