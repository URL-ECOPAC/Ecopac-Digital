import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, statusColors, typography } from "@ecopac/ui-tokens";

import SecondaryButton from "./SecondaryButton";

const MIN_TOUCH_HEIGHT = 48;
const ANCHO_DE_COLUMNA = 280;

/**
 * Tablero kanban. Espejo de apps/web/src/components/KanbanBoard.jsx, con las mismas props:
 * `columnas` ({ id, titulo, tarjetas }), `renderTarjeta`, `onMover(id, origenId, destinoId)`,
 * `mensajeVacio`, `columnaAtenuada` y `destinosDe(tarjeta, columnaId)`.
 *
 * POR QUE SE REESCRIBIO (issue #840, H2)
 *
 * Recibia otras props (`proyectos`, `etapas`, `onCambiarEtapa`) y pintaba adentro los datos de un
 * proyecto, asi que no servia para nada mas: el tablero de jornadas de la #843 le pasaba
 * `columnas` y la pantalla reventaba al abrirse. Ahora no sabe que muestra, igual que el de web.
 *
 * COMO SE MUEVE UNA TARJETA
 *
 * Cada tarjeta llevaba un boton "Mover". En la web se arrastra; en un telefono, arrastrar una
 * tarjeta dentro de columnas que ya se desplazan en horizontal choca con el propio
 * desplazamiento y no se puede hacer con una mano. El gesto es MANTENER PRESIONADA la tarjeta,
 * que abre la lista de etapas a las que puede ir (docs/DISENO-MOVIL.md). Sin boton que ocupe
 * espacio en cada tarjeta, y con el pulgar.
 *
 * Quien usa lector de pantalla no depende del gesto: cada tarjeta declara una accion de
 * accesibilidad por destino ("Mover a En curso"), que VoiceOver y TalkBack ofrecen en su menu de
 * acciones.
 *
 * `destinosDe` dice a que columnas puede ir una tarjeta (por ejemplo, las transiciones validas de
 * su estado). Sin el, cualquier otra columna.
 */
export default function KanbanBoard({
  columnas = [],
  renderTarjeta,
  onMover,
  mensajeVacio = "Sin tarjetas",
  columnaAtenuada,
  destinosDe,
}) {
  const [enMovimiento, setEnMovimiento] = useState(null);

  const destinosPosibles = (tarjeta, columnaId) => {
    const ids = destinosDe
      ? destinosDe(tarjeta, columnaId)
      : columnas.map((columna) => columna.id).filter((id) => id !== columnaId);
    return columnas.filter((columna) => ids.includes(columna.id));
  };

  const mover = (tarjeta, origenId, destinoId) => {
    setEnMovimiento(null);
    if (!destinoId || destinoId === origenId) return;
    onMover?.(tarjeta.id, origenId, destinoId);
  };

  const destinosDelModal = enMovimiento
    ? destinosPosibles(enMovimiento.tarjeta, enMovimiento.columnaId)
    : [];

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {columnas.map((columna) => {
          const tarjetas = columna.tarjetas ?? [];
          const color = statusColors[columna.id] ?? colors.secondary;

          return (
            <View
              key={columna.id}
              style={[styles.columna, columnaAtenuada?.(columna.id) && styles.columnaAtenuada]}
            >
              <View style={styles.cabecera}>
                <View style={[styles.punto, { backgroundColor: color }]} />
                <Text style={styles.titulo}>{columna.titulo}</Text>
                <Text style={styles.cuenta}>{tarjetas.length}</Text>
              </View>

              {tarjetas.length === 0 ? (
                <Text style={styles.vacio}>{mensajeVacio}</Text>
              ) : (
                tarjetas.map((tarjeta) => {
                  const destinos = onMover ? destinosPosibles(tarjeta, columna.id) : [];
                  return (
                    <Pressable
                      key={tarjeta.id}
                      onLongPress={
                        destinos.length > 0
                          ? () => setEnMovimiento({ tarjeta, columnaId: columna.id })
                          : undefined
                      }
                      accessibilityHint={
                        destinos.length > 0
                          ? "Mantén presionada la tarjeta para moverla de etapa"
                          : undefined
                      }
                      accessibilityActions={destinos.map((destino) => ({
                        name: destino.id,
                        label: `Mover a ${destino.titulo}`,
                      }))}
                      onAccessibilityAction={(evento) =>
                        mover(tarjeta, columna.id, evento.nativeEvent.actionName)
                      }
                      style={({ pressed }) => [styles.tarjeta, pressed && styles.presionada]}
                    >
                      {renderTarjeta?.(tarjeta)}
                    </Pressable>
                  );
                })
              )}
            </View>
          );
        })}
      </ScrollView>

      <Modal
        visible={Boolean(enMovimiento)}
        transparent
        animationType="fade"
        onRequestClose={() => setEnMovimiento(null)}
      >
        <View style={styles.fondo}>
          {/* El mismo velo que Modal.js: tocar fuera de la hoja la cierra. */}
          <Pressable
            style={styles.velo}
            onPress={() => setEnMovimiento(null)}
            accessibilityLabel="Cerrar"
          />
          <View style={styles.hoja}>
            <Text style={styles.hojaTitulo}>Mover a</Text>
            {destinosDelModal.map((destino) => (
              <Pressable
                key={destino.id}
                accessibilityRole="button"
                onPress={() => mover(enMovimiento.tarjeta, enMovimiento.columnaId, destino.id)}
                style={({ pressed }) => [styles.opcion, pressed && styles.presionada]}
              >
                <View
                  style={[
                    styles.punto,
                    { backgroundColor: statusColors[destino.id] ?? colors.secondary },
                  ]}
                />
                <Text style={styles.opcionTexto}>{destino.titulo}</Text>
              </Pressable>
            ))}
            <SecondaryButton
              title="Cancelar"
              onPress={() => setEnMovimiento(null)}
              style={styles.cancelar}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  columna: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.sm,
    marginRight: spacing.sm,
    padding: spacing.sm,
    width: ANCHO_DE_COLUMNA,
  },
  columnaAtenuada: {
    opacity: 0.85,
  },
  cabecera: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  punto: {
    borderRadius: radii.pill,
    height: spacing.sm,
    width: spacing.sm,
  },
  titulo: {
    color: colors.text,
    flex: 1,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  cuenta: {
    color: colors.textMuted,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  vacio: {
    borderColor: colors.border,
    borderRadius: radii.sm,
    borderStyle: "dashed",
    borderWidth: 1,
    color: colors.textMuted,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    padding: spacing.lg,
    textAlign: "center",
  },
  tarjeta: {
    borderRadius: radii.md,
  },
  presionada: {
    opacity: 0.7,
  },
  fondo: {
    flex: 1,
    justifyContent: "flex-end",
  },
  velo: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.text,
    opacity: 0.5,
  },
  hoja: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    gap: spacing.xs,
    padding: spacing.lg,
  },
  hojaTitulo: {
    color: colors.text,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.sm,
  },
  opcion: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: MIN_TOUCH_HEIGHT,
    paddingHorizontal: spacing.md,
  },
  opcionTexto: {
    color: colors.text,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.md,
  },
  cancelar: {
    marginTop: spacing.sm,
  },
});
