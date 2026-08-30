import { Modal as ModalNativo, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "@ecopac/ui-tokens";

const MIN_TOUCH_HEIGHT = 48;

/**
 * Dialogo modal. Espejo de apps/web/src/components/Modal.jsx, con las mismas props.
 *
 * Diferencia deliberada de plataforma: en web va centrado y aqui sube desde abajo como HOJA
 * INFERIOR. Es el mismo patron que Selector.js ya implementa por dentro (Modal transparente
 * mas una View con la hoja), y en un telefono deja el contenido al alcance del pulgar.
 *
 * `onRequestClose` es lo que hace que el boton atras de Android cierre la hoja; sin eso, la
 * unica salida seria tocar el fondo y el boton fisico no haria nada.
 */
export default function Modal({ visible = false, onClose, title, children }) {
  return (
    <ModalNativo visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        {/* Capa de fondo separada del contenido: asi la opacidad solo afecta al fondo y no
            oscurece la hoja ni su texto. */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button">
          <View style={styles.backdrop} />
        </Pressable>

        <View style={styles.sheet}>
          {title ? (
            <View style={styles.cabecera}>
              <Text style={styles.titulo}>{title}</Text>
              <Pressable onPress={onClose} style={styles.cerrar} accessibilityRole="button">
                <Text style={styles.cerrarTexto}>Cerrar</Text>
              </Pressable>
            </View>
          ) : null}
          {children}
        </View>
      </View>
    </ModalNativo>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  backdrop: { flex: 1, backgroundColor: colors.text, opacity: 0.5 },
  sheet: {
    maxHeight: "85%",
    backgroundColor: colors.background,
    borderTopLeftRadius: spacing.md,
    borderTopRightRadius: spacing.md,
    padding: spacing.md,
  },
  cabecera: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  titulo: {
    flexShrink: 1,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  cerrar: {
    minHeight: MIN_TOUCH_HEIGHT,
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  cerrarTexto: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
  },
});
