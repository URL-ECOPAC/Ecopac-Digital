import { useContext, useEffect, useRef } from "react";
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "@ecopac/ui-tokens";

const MIN_TOUCH_HEIGHT = 48;
const ANCHO_MAXIMO = 380;

/**
 * Panel que entra desde la derecha (el "side sheet" de Material 3). Lo usan la barra de filtros y
 * el menu de una seccion con muchas opciones: en un telefono, lo que no es la accion de todos los
 * dias se guarda aqui en vez de llenar la pantalla de botones (docs/DISENO-MOVIL.md, regla 3).
 *
 * Ocupa casi todo el alto, con su propio scroll, y `pie` queda fijo abajo aunque el contenido sea
 * largo. El boton atras de Android y tocar el fondo lo cierran (`onClose`).
 *
 * @param {{ visible: boolean, onClose: () => void, title: string, children: import("react").ReactNode, pie?: import("react").ReactNode }} props
 */
export default function PanelLateral({ visible, onClose, title, children, pie }) {
  const { width } = useWindowDimensions();
  // El contexto y no useSafeAreaInsets(): sin SafeAreaProvider (una prueba de pantalla) aquel
  // lanza, y aqui basta con no dejar margen.
  const margenes = useContext(SafeAreaInsetsContext) ?? { top: 0, bottom: 0 };
  const ancho = Math.min(ANCHO_MAXIMO, Math.round(width * 0.88));
  const desplazamiento = useRef(new Animated.Value(ancho)).current;

  // Entra desde la derecha cada vez que se abre.
  useEffect(() => {
    if (!visible) return;
    desplazamiento.setValue(ancho);
    Animated.timing(desplazamiento, { toValue: 0, duration: 220, useNativeDriver: true }).start();
  }, [visible, ancho, desplazamiento]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.raiz}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={`Cerrar ${title}`}
        >
          <View style={styles.fondo} />
        </Pressable>

        <Animated.View
          style={[
            styles.panel,
            {
              width: ancho,
              paddingTop: margenes.top + spacing.sm,
              paddingBottom: margenes.bottom + spacing.md,
              transform: [{ translateX: desplazamiento }],
            },
          ]}
          accessibilityViewIsModal
        >
          <View style={styles.cabecera}>
            <Text style={styles.titulo}>{title}</Text>
            <Pressable
              onPress={onClose}
              style={styles.cerrar}
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.cuerpo}
            contentContainerStyle={styles.cuerpoContenido}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>

          {pie ? <View style={styles.pie}>{pie}</View> : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1, flexDirection: "row", justifyContent: "flex-end" },
  fondo: { flex: 1, backgroundColor: colors.text, opacity: 0.4 },
  panel: {
    height: "100%",
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.lg,
    borderBottomLeftRadius: radii.lg,
  },
  cabecera: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
    minWidth: MIN_TOUCH_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  cuerpo: { flex: 1 },
  cuerpoContenido: { padding: spacing.md },
  pie: {
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
