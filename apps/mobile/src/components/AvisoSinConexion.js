import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, typography } from "@ecopac/ui-tokens";

/**
 * Franja fija arriba de todo cuando el telefono se queda sin red (issue #762). Espejo de
 * apps/web/src/components/AvisoSinConexion.jsx, con la misma prop.
 *
 * Es el aviso que mas importa del sistema: la app movil se usa en comunidades rurales, donde la
 * senal se cae a media jornada. Sin el, el primer indicio de que no habia red era un guardado que
 * fallaba despues de escribir una consulta entera -o una lista vacia que se leia como "no hay
 * datos"-.
 *
 * Que se puede hacer sin red esta en docs/SEGURIDAD.md, "Fallos de red": leer lo que ya esta en
 * pantalla si; guardar no, y la app no lo encola. Por eso el texto dice que no se guarde, no que
 * "se sincronizara despues".
 *
 * Ocupa el margen superior del telefono (la muesca, la barra de estado). Las pantallas con
 * ScreenContainer usan el SafeAreaView de react-native-safe-area-context, que mide cuanto del area
 * insegura les queda encima y no duplica ese margen. Las que abren con la cabecera nativa del stack
 * (las de PANTALLAS_DEL_ROOT) si dejan un margen de mas mientras dura el aviso: se prefirio eso a
 * superponer la franja y tapar el boton de volver.
 *
 * @param {{ enLinea: boolean }} props
 */
export default function AvisoSinConexion({ enLinea }) {
  const margenes = useSafeAreaInsets();
  if (enLinea) return null;

  return (
    <View
      style={[styles.franja, { paddingTop: margenes.top + spacing.sm }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Ionicons name="cloud-offline-outline" size={18} color={colors.warning} />
      <Text style={styles.texto}>
        <Text style={styles.titulo}>Sin conexión. </Text>
        Lo que guardes ahora no llegará a la base de datos: espera a recuperar la señal antes de
        registrar datos nuevos.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  franja: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 2,
    borderBottomColor: colors.warning,
  },
  texto: {
    flex: 1,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.sm,
    color: colors.text,
  },
  titulo: {
    fontWeight: typography.weights.bold,
  },
});
