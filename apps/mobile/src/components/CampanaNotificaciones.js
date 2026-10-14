import { Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { colors, radii, spacing, typography } from "@ecopac/ui-tokens";

import { useCantidadDeNotificaciones } from "../contexto/NotificacionesProvider";
import { ROUTES } from "../navigation/rutas";
import IconoDeModulo from "./IconoDeModulo";

// Campana de la cabecera movil (issue #755), a la par del nombre y el rol que muestra cada stack.
// Abre la ventana de notificaciones (NotificacionesScreen, en el Root). El numero es el de no
// leidas y va en warning, igual que la campana de la web: pide atencion pero no bloquea nada
// (docs/DISENO.md). Sin ninguna sin leer, la campana queda sola.
export default function CampanaNotificaciones() {
  const navigation = useNavigation();
  const cantidad = useCantidadDeNotificaciones();

  return (
    <Pressable
      onPress={() => navigation.navigate(ROUTES.NOTIFICACIONES)}
      accessibilityRole="button"
      accessibilityLabel={
        cantidad > 0
          ? `Notificaciones: ${cantidad} sin leer`
          : "Notificaciones: sin notificaciones nuevas"
      }
      hitSlop={spacing.sm}
      style={styles.boton}
    >
      <IconoDeModulo nombre="Bell" color={colors.secondary} size={22} />
      {cantidad > 0 ? (
        <View style={styles.contador}>
          <Text style={styles.textoContador}>{cantidad > 99 ? "99+" : cantidad}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  boton: {
    alignItems: "center",
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  contador: {
    alignItems: "center",
    backgroundColor: colors.warning,
    borderRadius: radii.pill,
    minWidth: 18,
    paddingHorizontal: spacing.xs,
    position: "absolute",
    right: 0,
    top: 2,
  },
  textoContador: {
    color: colors.surface,
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.xxs,
    fontWeight: typography.weights.bold,
  },
});
