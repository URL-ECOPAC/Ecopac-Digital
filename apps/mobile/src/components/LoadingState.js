import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, labels, spacing, typography } from '@ecopac/ui-tokens';

/**
 * Estado de carga. Espejo de apps/web/src/components/LoadingState.jsx.
 *
 * Lo usa DataList mientras `cargando` es true, o cualquier pantalla que espera datos.
 */
export default function LoadingState({ message = labels.cargando }) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  text: {
    marginTop: spacing.md,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.textMuted,
  },
});
