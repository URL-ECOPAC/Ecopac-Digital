import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@ecopac/ui-tokens';
import Modal from './Modal';

const MIN_TOUCH_HEIGHT = 48;
const ANCHO_COLUMNA = 280;

/**
 * Tablero kanban. Espejo de apps/web/src/components/KanbanBoard.jsx, con las mismas props.
 *
 * No sabe cuantas columnas hay ni que representan: las declara el modulo que lo usa, que es
 * lo que permite que jornadas lo use con tres etapas y pacientes con cinco sin tocarlo.
 *
 * Diferencia deliberada con la web, que fija el contrato: aqui la tarjeta se mueve con un
 * boton "Mover" que abre una hoja con las columnas destino, NO arrastrando. Arrastrar dentro
 * de un ScrollView tactil compite con el gesto de desplazamiento y falla a menudo; un boton
 * acierta siempre, y ademas funciona para quien usa lector de pantalla.
 */
export default function KanbanBoard({ columnas = [], renderTarjeta, onMover }) {
  const [moviendo, setMoviendo] = useState(null);

  const elegirDestino = (destinoId) => {
    if (moviendo && destinoId !== moviendo.columnaId) {
      onMover?.(moviendo.tarjeta.id, moviendo.columnaId, destinoId);
    }
    setMoviendo(null);
  };

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {columnas.map((columna) => (
          <View key={columna.id} style={styles.columna}>
            <Text style={styles.titulo}>
              {columna.titulo} {(columna.tarjetas ?? []).length}
            </Text>

            <View style={styles.tarjetas}>
              {(columna.tarjetas ?? []).map((tarjeta) => (
                <View key={tarjeta.id}>
                  {renderTarjeta?.(tarjeta)}
                  <Pressable
                    style={({ pressed }) => [styles.mover, pressed && styles.moverPressed]}
                    onPress={() => setMoviendo({ tarjeta, columnaId: columna.id })}
                    accessibilityRole="button"
                    accessibilityLabel={`Mover a otra columna`}
                  >
                    <Text style={styles.moverTexto}>Mover</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      <Modal
        visible={moviendo !== null}
        onClose={() => setMoviendo(null)}
        title="Mover a"
      >
        {columnas
          .filter((columna) => columna.id !== moviendo?.columnaId)
          .map((columna) => (
            <Pressable
              key={columna.id}
              style={({ pressed }) => [styles.destino, pressed && styles.destinoPressed]}
              onPress={() => elegirDestino(columna.id)}
              accessibilityRole="button"
            >
              <Text style={styles.destinoTexto}>{columna.titulo}</Text>
            </Pressable>
          ))}
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  columna: {
    width: ANCHO_COLUMNA,
    marginRight: spacing.md,
    padding: spacing.sm,
    borderRadius: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  titulo: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  tarjetas: { gap: spacing.sm },
  mover: {
    minHeight: MIN_TOUCH_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  moverPressed: { opacity: 0.6 },
  moverTexto: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
  },
  destino: {
    minHeight: MIN_TOUCH_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: spacing.xs,
  },
  destinoPressed: { backgroundColor: colors.surface },
  destinoTexto: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.md,
    color: colors.text,
  },
});
