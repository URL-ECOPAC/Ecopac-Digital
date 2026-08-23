import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@ecopac/ui-tokens';

/**
 * Tarjeta. Espejo de apps/web/src/components/Card.jsx.
 *
 * Base visual de las tarjetas de DataList y de cualquier bloque agrupado. Si viene
 * `onPress` la tarjeta es interactiva; si no, es un View y no captura toques.
 *
 * Un hijo que sea texto suelto se envuelve en <Text>. En la web <Card>texto</Card> es
 * valido y aqui React Native lanza "Text strings must be rendered within a <Text>
 * component": envolverlo aqui es lo que permite escribir la misma linea en las dos
 * plataformas, que es el proposito del catalogo.
 */
export default function Card({ children, title, onPress, style }) {
  const esTextoSuelto = typeof children === 'string' || typeof children === 'number';

  const contenido = (
    <>
      {title ? <Text style={styles.titulo}>{title}</Text> : null}
      {esTextoSuelto ? <Text style={styles.texto}>{children}</Text> : children}
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
  texto: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.md,
    color: colors.text,
  },
  titulo: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
});
